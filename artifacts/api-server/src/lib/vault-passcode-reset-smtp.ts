type ResendTransactionalEmailInput = {
  apiKey: string;
  senderAddress: string;
  recipientAddress: string;
  subject: string;
  text: string;
  html?: string;
  senderName?: string;
  messageId?: string;
};

function assertMailbox(value: string, label: string): string {
  const address = value.trim();
  const [localPart, domain, ...extra] = address.split("@");
  const localPattern = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
  const domainPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
  if (address.length > 254 || extra.length > 0 || !localPart ||
      localPart.length > 64 || !domain || domain.length > 253 ||
      !localPattern.test(localPart) || !domainPattern.test(domain) ||
      /[\r\n<>]/.test(address)) {
    throw new Error(`Invalid ${label} email address.`);
  }
  return address;
}

/**
 * Resend HTTPS API transport. Cloudflare Workers use fetch() for outbound
 * email delivery; this avoids relying on raw SMTP TCP sockets in the Worker.
 */
export async function sendResendTransactionalEmail(
  input: ResendTransactionalEmailInput,
): Promise<void> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new Error("Resend API key is not configured.");
  const sender = assertMailbox(input.senderAddress, "sender");
  const recipient = assertMailbox(input.recipientAddress, "recipient");
  if (/[\r\n]/.test(input.subject)) throw new Error("Invalid email subject.");

  const senderName = (input.senderName || "DUTSTAR BANK")
    .replace(/[\r\n<>"]/g, "")
    .slice(0, 80);
  const payload: Record<string, unknown> = {
    from: `${senderName} <${sender}>`,
    to: [recipient],
    subject: input.subject,
    text: input.text,
  };
  if (input.html) payload.html = input.html;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const idempotencyKey = input.messageId?.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 120);
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    // Avoid logging or surfacing API response bodies that may contain
    // provider diagnostics. The status code is sufficient for safe triage.
    throw new Error(`Resend rejected the email (HTTP ${response.status}).`);
  }
}

export async function sendVaultPasscodeResetEmail(
  input: ResendTransactionalEmailInput,
): Promise<void> {
  return sendResendTransactionalEmail({
    ...input,
    senderName: "DUTSTAR BANK Security",
  });
}
