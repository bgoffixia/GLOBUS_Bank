import net from "node:net";
import tls from "node:tls";

type ResetEmailInput = {
  apiKey: string;
  senderAddress: string;
  recipientAddress: string;
  subject: string;
  text: string;
};

const SMTP_HOST = "smtp.resend.com";
const SMTP_PORT = 587;
const SMTP_TIMEOUT_MS = 15_000;

type SmtpSocket = net.Socket | tls.TLSSocket;

function readReply(socket: SmtpSocket): Promise<{ code: number; message: string }> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("timeout", onTimeout);
    };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onTimeout = () => { cleanup(); reject(new Error("Resend SMTP connection timed out.")); };
    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString();
      const finalLine = buffer.split(/\r?\n/).find((line) => /^\d{3} /.test(line));
      if (!finalLine) return;
      cleanup();
      resolve({ code: Number(finalLine.slice(0, 3)), message: buffer.trim() });
    };
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("timeout", onTimeout);
  });
}

async function command(socket: SmtpSocket, value: string, expected: number[]): Promise<void> {
  const response = readReply(socket);
  socket.write(`${value}\r\n`);
  const reply = await response;
  if (!expected.includes(reply.code)) {
    throw new Error(`Resend SMTP command failed (${reply.code}): ${reply.message.slice(0, 240)}`);
  }
}

function assertMailbox(value: string, label: string): string {
  const address = value.trim();
  const pattern = /^[A-Za-z0-9!#$%&'*+\/= ?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/= ?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
  if (address.length > 254 || !pattern.test(address) || /[\r\n<>]/.test(address)) {
    throw new Error(`Invalid ${label} email address for SMTP delivery.`);
  }
  return address;
}

export async function sendVaultPasscodeResetEmail(input: ResetEmailInput): Promise<void> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new Error("Resend SMTP API key is not configured.");
  const sender = assertMailbox(input.senderAddress, "sender");
  const recipient = assertMailbox(input.recipientAddress, "recipient");
  if (/[\r\n]/.test(input.subject)) throw new Error("Invalid reset email subject.");

  const body = [
    `From: GLOBUS BANK Security <${sender}>`,
    `To: <${recipient}>`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text.replace(/\r?\n/g, "\r\n"),
  ].join("\r\n").replace(/(^|\r\n)\./g, "$1..");

  let socket: SmtpSocket | undefined;
  try {
    const plainSocket = net.createConnection({ host: SMTP_HOST, port: SMTP_PORT });
    socket = plainSocket;
    plainSocket.setTimeout(SMTP_TIMEOUT_MS);
    await new Promise<void>((resolve, reject) => {
      plainSocket.once("connect", resolve);
      plainSocket.once("error", reject);
    });

    const greeting = await readReply(plainSocket);
    if (greeting.code !== 220) throw new Error(`Resend SMTP greeting failed (${greeting.code}).`);
    await command(plainSocket, "EHLO globus.website", [250]);
    await command(plainSocket, "STARTTLS", [220]);

    const secureSocket = tls.connect({ socket: plainSocket, servername: SMTP_HOST, minVersion: "TLSv1.2" });
    socket = secureSocket;
    secureSocket.setTimeout(SMTP_TIMEOUT_MS);
    await new Promise<void>((resolve, reject) => {
      secureSocket.once("secureConnect", resolve);
      secureSocket.once("error", reject);
    });

    await command(secureSocket, "EHLO globus.website", [250]);
    const credentials = Buffer.from(`\0resend\0${apiKey}`, "utf8").toString("base64");
    await command(secureSocket, `AUTH PLAIN ${credentials}`, [235]);
    await command(secureSocket, `MAIL FROM:<${sender}>`, [250]);
    await command(secureSocket, `RCPT TO:<${recipient}>`, [250, 251]);
    await command(secureSocket, "DATA", [354]);

    const acceptedReply = readReply(secureSocket);
    secureSocket.write(`${body}\r\n.\r\n`);
    const accepted = await acceptedReply;
    if (accepted.code !== 250) {
      throw new Error(`Resend SMTP rejected the reset email (${accepted.code}): ${accepted.message.slice(0, 240)}`);
    }
    await command(secureSocket, "QUIT", [221]);
  } finally {
    socket?.end();
  }
}
