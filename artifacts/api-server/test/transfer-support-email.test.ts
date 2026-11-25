import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("transfer alerts always include a transfer-specific support URL and optional email contact", () => {
  const source = readFileSync(new URL("../src/lib/transfer-notifications.ts", import.meta.url), "utf8");
  assert.match(source, /GLOBUS_DEFAULT_SUPPORT_URL/);
  assert.match(source, /new URL\(configuredDefaultSupportUrl \?\? "\/support", origin\)/);
  assert.match(source, /defaultSupportUrl\.searchParams\.set\("transfer", input\.reference\)/);
  assert.match(source, /custom\.searchParams\.set\("transfer", input\.reference\)/);
  assert.match(source, /GLOBUS_SUPPORT_EMAIL/);
  assert.match(source, /mailto:/);
  assert.match(source, /Email support/);
});

test("operations settings expose and validate global support URL and email", () => {
  const routes = readFileSync(new URL("../src/routes/bankAdmin.ts", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../../../lib/db/src/schema/bank.ts", import.meta.url), "utf8");
  assert.match(routes, /defaultSupportUrl: settings\.defaultSupportUrl/);
  assert.match(routes, /supportEmail: settings\.supportEmail/);
  assert.match(routes, /normalizeSupportUrl\(parsed\.data\.defaultSupportUrl\)/);
  assert.match(routes, /parsed\.data\.supportEmail/);
  assert.match(schema, /defaultSupportUrl: text\("default_support_url"\)/);
  assert.match(schema, /supportEmail: text\("support_email"\)/);
});
