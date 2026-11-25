type ResendEmailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

async function postResendEmail(
  apiKey: string,
  message: ResendEmailMessage,
  idempotencyKey: string,
): Promise<Response> {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(15_000),
  });
}

export async function sendResendEmail(
  message: ResendEmailMessage,
  idempotencyKey: string,
  verifiedSenderFallback?: ResendEmailMessage,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !idempotencyKey.trim()) return false;

  try {
    const response = await postResendEmail(apiKey, message, idempotencyKey);
    if (response.ok) return true;

    // A per-customer From address can be rejected when that sender/domain is
    // not enabled in Resend. Retry only sender-validation/authorization
    // rejections with the configured, verified Globus sender. Do not retry
    // rate limits, authentication failures, or transient network errors.
    if (
      verifiedSenderFallback &&
      [400, 403, 422].includes(response.status)
    ) {
      const fallbackResponse = await postResendEmail(
        apiKey,
        verifiedSenderFallback,
        `${idempotencyKey}-verified-sender-fallback`,
      );
      if (fallbackResponse.ok) return true;
      console.warn("Resend transfer email fallback rejected", {
        status: fallbackResponse.status,
      });
      return false;
    }

    console.warn("Resend email rejected", { status: response.status });
    return false;
  } catch (error) {
    console.warn("Resend email request failed", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return false;
  }
}
