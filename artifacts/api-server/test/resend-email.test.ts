import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { sendResendEmail } from "../src/lib/resend-email";
import {
  customerEmailSenderHeader,
  normalizeCustomerEmailSenderDisplayName,
  normalizeCustomerEmailSenderLocalPart,
} from "../src/lib/customer-email-sender";
import {
  isPushCategoryEnabled,
  normalizeSupportLabel,
  normalizeSupportUrl,
  renderSupportFooter,
} from "../src/lib/transfer-notifications";
import { isPrivateDataEncryptionConfigured } from "../src/lib/private-data";

const apiKeyEnv = "RESEND_API_KEY";
const encryptionKeyEnv = "BANK_DETAILS_ENCRYPTION_KEY";

test("private-data encryption readiness validates without returning the key", () => {
  const previousKey = process.env[encryptionKeyEnv];
  try {
    delete process.env[encryptionKeyEnv];
    assert.equal(isPrivateDataEncryptionConfigured(), false);
    process.env[encryptionKeyEnv] = "too-short";
    assert.equal(isPrivateDataEncryptionConfigured(), false);
    process.env[encryptionKeyEnv] = "x".repeat(32);
    assert.equal(isPrivateDataEncryptionConfigured(), true);
  } finally {
    if (previousKey === undefined) delete process.env[encryptionKeyEnv];
    else process.env[encryptionKeyEnv] = previousKey;
  }
});

test("customer transfer-email sender headers use the configured name and fixed domain", () => {
  assert.deepEqual(normalizeCustomerEmailSenderLocalPart("  Jane.Doe-7 "), {
    valid: true,
    value: "jane.doe-7",
  });
  assert.deepEqual(normalizeCustomerEmailSenderLocalPart("security"), {
    valid: false,
    value: null,
  });
  assert.deepEqual(normalizeCustomerEmailSenderLocalPart("bad..dots"), {
    valid: false,
    value: null,
  });
  assert.equal(
    customerEmailSenderHeader("jane.doe-7"),
    '"GLOBUS BANK" <jane.doe-7@globus.website>',
  );
  assert.equal(
    customerEmailSenderHeader("jane.doe-7", '  Globus "Client" Alerts  '),
    '"Globus \\"Client\\" Alerts" <jane.doe-7@globus.website>',
  );
});

test("transfer-alert display names are trimmed and reject header injection", () => {
  assert.equal(
    normalizeCustomerEmailSenderDisplayName("  Globus Client Alerts  "),
    "Globus Client Alerts",
  );
  assert.equal(normalizeCustomerEmailSenderDisplayName(" "), null);
  assert.equal(normalizeCustomerEmailSenderDisplayName("Name\r\nBcc: victim@example.test"), null);
  assert.equal(normalizeCustomerEmailSenderDisplayName(`x${"\u007f"}y`), null);
  assert.equal(normalizeCustomerEmailSenderDisplayName("<alerts@example.test>"), null);
  assert.equal(normalizeCustomerEmailSenderDisplayName("x".repeat(81)), null);
  assert.equal(
    customerEmailSenderHeader("jane.doe-7", "Name\r\nBcc: victim@example.test"),
    '"GLOBUS BANK" <jane.doe-7@globus.website>',
  );
});

test("admin sender-name setting is allowlisted, persisted, audited, and used by transfer alerts", () => {
  const adminRoutes = readFileSync(
    new URL("../src/routes/bankAdmin.ts", import.meta.url),
    "utf8",
  );
  const transferAlerts = readFileSync(
    new URL("../src/lib/transfer-notifications.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    adminRoutes,
    /router\.put\("\/bank\/admin\/settings", requireAdmin/,
  );
  assert.match(
    adminRoutes,
    /customerEmailSenderDisplayName,\s*fundingLimit:/,
  );
  assert.match(
    adminRoutes,
    /set:\s*\{\s*customerEmailSenderDisplayName,/,
  );
  assert.match(
    adminRoutes,
    /reason:\s*`Transfer-alert display name \$\{settings\.customerEmailSenderDisplayName\}/,
  );
  assert.match(
    transferAlerts,
    /bankAdminSettingsTable\.customerEmailSenderDisplayName/,
  );
  assert.match(
    transferAlerts,
    /customerEmailSenderHeader\([\s\S]*?senderDisplayName/,
  );
});

const message = {
  from: "Globus Bank <alerts@example.test>",
  to: "recipient@example.test",
  subject: "Transfer update",
  text: "Test message",
  html: "<p>Test message</p>",
};

test("normalizes only safe HTTPS support URLs", () => {
  assert.equal(
    normalizeSupportUrl(" https://support.example.test/help "),
    "https://support.example.test/help",
  );
  assert.equal(normalizeSupportUrl("http://support.example.test"), null);
  assert.equal(normalizeSupportUrl("javascript:alert(1)"), null);
  assert.equal(
    normalizeSupportUrl("https://user:password@support.example.test"),
    null,
  );
  assert.equal(normalizeSupportUrl("x".repeat(501)), null);
});

test("custom footer labels are normalized and safely rendered", () => {
  assert.equal(normalizeSupportLabel("  Get account help  "), "Get account help");
  assert.equal(normalizeSupportLabel("   "), null);
  assert.equal(normalizeSupportLabel("x".repeat(41)), null);
  assert.equal(normalizeSupportLabel("Help\nSupport"), null);
  assert.deepEqual(
    renderSupportFooter("https://support.example.test/help", "<Help & support>"),
    {
      text: "<Help & support>: https://support.example.test/help",
      html: '<footer style="padding:16px 28px 20px;border-top:1px solid #e7ecee;text-align:center"><a href="https://support.example.test/help" style="color:#356e75;font-size:13px;font-weight:700;text-decoration:none">&lt;Help &amp; support&gt;</a></footer>',
    },
  );
  assert.equal(renderSupportFooter(null, "Help").html, "");
});

test("push delivery rules honor each customer's alert category choices", () => {
  const preferences = {
    transferEnabled: true,
    walletEnabled: false,
    securityEnabled: true,
  };
  assert.equal(isPushCategoryEnabled("transfer", preferences), true);
  assert.equal(isPushCategoryEnabled("wallet", preferences), false);
  assert.equal(isPushCategoryEnabled("security", preferences), true);
});

test("sends mail through the Resend API using the server-side secret", async () => {
  const previousKey = process.env[apiKeyEnv];
  const previousFetch = globalThis.fetch;
  process.env[apiKeyEnv] = "test-resend-secret";
  let capturedRequest: Request | undefined;
  globalThis.fetch = (async (input, init) => {
    capturedRequest = new Request(input, init);
    return new Response(JSON.stringify({ id: "test-email-id" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    assert.equal(await sendResendEmail(message, "test-idempotency-key"), true);
    assert.equal(capturedRequest?.url, "https://api.resend.com/emails");
    assert.equal(capturedRequest?.method, "POST");
    assert.equal(
      capturedRequest?.headers.get("authorization"),
      "Bearer test-resend-secret",
    );
    assert.equal(
      capturedRequest?.headers.get("idempotency-key"),
      "test-idempotency-key",
    );
    assert.deepEqual(await capturedRequest?.json(), message);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env[apiKeyEnv];
    else process.env[apiKeyEnv] = previousKey;
  }
});

test("does not attempt delivery without a Resend API key", async () => {
  const previousKey = process.env[apiKeyEnv];
  const previousFetch = globalThis.fetch;
  delete process.env[apiKeyEnv];
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  try {
    assert.equal(await sendResendEmail(message, "test-idempotency-key"), false);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env[apiKeyEnv];
    else process.env[apiKeyEnv] = previousKey;
  }
});

test("retries sender-domain rejection with the configured verified sender", async () => {
  const previousKey = process.env[apiKeyEnv];
  const previousFetch = globalThis.fetch;
  process.env[apiKeyEnv] = "test-resend-secret";
  const requests: Request[] = [];
  globalThis.fetch = (async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    return requests.length === 1
      ? new Response(JSON.stringify({ message: "Sender domain not authorized" }), { status: 403 })
      : new Response(JSON.stringify({ id: "fallback-email-id" }), { status: 200 });
  }) as typeof fetch;

  try {
    const fallback = { ...message, from: "GLOBUS BANK <verified@globus.website>" };
    assert.equal(await sendResendEmail(message, "fallback-test-key", fallback), true);
    assert.equal(requests.length, 2);
    assert.equal((await requests[0].json()).from, message.from);
    assert.equal((await requests[1].json()).from, fallback.from);
    assert.equal(
      requests[1].headers.get("idempotency-key"),
      "fallback-test-key-verified-sender-fallback",
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env[apiKeyEnv];
    else process.env[apiKeyEnv] = previousKey;
  }
});

test("does not retry a Resend authentication failure with a fallback sender", async () => {
  const previousKey = process.env[apiKeyEnv];
  const previousFetch = globalThis.fetch;
  process.env[apiKeyEnv] = "test-resend-secret";
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ message: "Invalid API key" }), { status: 401 });
  }) as typeof fetch;

  try {
    assert.equal(await sendResendEmail(message, "fallback-auth-test", message), false);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env[apiKeyEnv];
    else process.env[apiKeyEnv] = previousKey;
  }
});

test("reports Resend rejection as an unsuccessful delivery", async () => {
  const previousKey = process.env[apiKeyEnv];
  const previousFetch = globalThis.fetch;
  process.env[apiKeyEnv] = "test-resend-secret";
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ message: "Rejected" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  try {
    assert.equal(await sendResendEmail(message, "test-idempotency-key"), false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env[apiKeyEnv];
    else process.env[apiKeyEnv] = previousKey;
  }
});


test("admin test-email cooldown is per administrator and returns the remaining wait", () => {
  const source = readFileSync(
    new URL("../src/routes/bankAdmin.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /keyGenerator:\s*\(req\)\s*=>\s*getAuth\(req\)\.userId/);
  assert.match(source, /req\.rateLimit\?\.resetTime/);
  assert.match(source, /retryAfterSeconds/);
  assert.match(source, /setHeader\("Retry-After"/);
});
