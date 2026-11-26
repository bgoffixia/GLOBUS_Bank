import { createConnection, type Socket } from "node:net";
import { connect, type TLSSocket } from "node:tls";

type SmtpEmailInput = {
  apiKey: string;
  senderAddress: string;
  recipientAddress: string;
  subject: string;
  text: string;
  html?: string;
  senderName?: string;
  messageId?: string;
};

const SMTP_HOST = process.env.RESEND_SMTP_HOST?.trim() || "smtp.resend.com";
const SMTP_PORT = Number(process.env.RESEND_SMTP_PORT || 587);
const SMTP_USERNAME = process.env.RESEND_SMTP_USERNAME?.trim() || "resend";
const SMTP_TIMEOUT_MS = 15_000;

type SmtpSocket = Socket | TLSSocket;

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
      const lines = buffer.split(/\r?\n/);
      const finalLine = lines.find((line) => /^\d{3} /.test(line));
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
  const [localPart, domain, ...extra] = address.split("@");
  const localPattern = /^[A-Za-z0-9!#$%&'*+/=?^_{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_{|}~-]+)*$/;
  const domainPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
  if (address.length > 254 || extra.length > 0 || !localPart || localPart.length > 64 ||
      !domain || domain.length > 253 || !localPattern.test(localPart) ||
      !domainPattern.test(domain) || /[\r\n<>]/.test(address)) {
    throw new Error(`Invalid ${label} email address for SMTP delivery.`);
  }
  return address;
}

export async function sendResendSmtpEmail(input: SmtpEmailInput): Promise<void> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new Error("Resend SMTP API key is not configured.");
  if (!Number.isInteger(SMTP_PORT) || SMTP_PORT < 1 || SMTP_PORT > 65535) {
    throw new Error("Invalid Resend SMTP port.");
  }
  const sender = assertMailbox(input.senderAddress, "sender");
  const recipient = assertMailbox(input.recipientAddress, "recipient");
  if (/[\r\n]/.test(input.subject)) throw new Error("Invalid email subject.");
  const senderName = (input.senderName || "DUTSTAR BANK").replace(/[\r\n<>"]/g, "").slice(0, 80);
  const messageId = input.messageId?.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 120);
  const body = [
    `From: ${senderName} <${sender}>`,
    `To: <${recipient}>`,
    `Subject: ${input.subject}`,
    ...(messageId ? [`Message-ID: <${messageId}@infomail.click>`] : []),
    "MIME-Version: 1.0",
    ...(input.html ? [
      'Content-Type: multipart/alternative; boundary="dutstar-mail-boundary"',
      "",
      "--dutstar-mail-boundary",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      input.text.replace(/\r?\n/g, "\r\n"),
      "--dutstar-mail-boundary",
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      input.html.replace(/\r?\n/g, "\r\n"),
      "--dutstar-mail-boundary--",
    ] : [
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      input.text.replace(/\r?\n/g, "\r\n"),
    ]),
  ].join("\r\n").replace(/(^|\r\n)\./g, "$1..");

  let socket: SmtpSocket | undefined;
  try {
    const plainSocket = createConnection({ host: SMTP_HOST, port: SMTP_PORT });
    socket = plainSocket;
    plainSocket.setTimeout(SMTP_TIMEOUT_MS);
    await new Promise<void>((resolve, reject) => {
      plainSocket.once("connect", resolve);
      plainSocket.once("error", reject);
    });
    const greeting = await readReply(plainSocket);
    if (greeting.code !== 220) throw new Error(`Resend SMTP greeting failed (${greeting.code}).`);
    await command(plainSocket, "EHLO dutstar-bank", [250]);
    await command(plainSocket, "STARTTLS", [220]);

    const secureSocket = connect({ socket: plainSocket, servername: SMTP_HOST, minVersion: "TLSv1.2" });
    socket = secureSocket;
    secureSocket.setTimeout(SMTP_TIMEOUT_MS);
    await new Promise<void>((resolve, reject) => {
      secureSocket.once("secureConnect", resolve);
      secureSocket.once("error", reject);
    });
    await command(secureSocket, "EHLO dutstar-bank", [250]);
    const credentials = Buffer.from(`\0${SMTP_USERNAME}\0${apiKey}`, "utf8").toString("base64");
    await command(secureSocket, `AUTH PLAIN ${credentials}`, [235]);
    await command(secureSocket, `MAIL FROM:<${sender}>`, [250]);
    await command(secureSocket, `RCPT TO:<${recipient}>`, [250, 251]);
    await command(secureSocket, "DATA", [354]);
    const acceptedReply = readReply(secureSocket);
    secureSocket.write(`${body}\r\n.\r\n`);
    const accepted = await acceptedReply;
    if (accepted.code !== 250) {
      throw new Error(`Resend SMTP rejected the email (${accepted.code}): ${accepted.message.slice(0, 240)}`);
    }
    await command(secureSocket, "QUIT", [221]);
  } finally {
    socket?.end();
  }
}

export async function sendVaultPasscodeResetEmail(input: SmtpEmailInput): Promise<void> {
  return sendResendSmtpEmail({ ...input, senderName: "DUTSTAR BANK Security" });
}
