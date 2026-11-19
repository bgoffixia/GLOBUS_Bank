import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GetBankReceiptPreferencesResponse,
  UpdateBankReceiptPreferencesBody,
} from "@workspace/api-zod";

const supportedTemplates = [
  "standard",
  "bank_payment",
  "transfer_journey",
  "transfer_ledger",
  "settlement_statement",
] as const;

test("receipt preference API accepts each of the five supported templates", () => {
  for (const preferredTemplate of supportedTemplates) {
    const input = UpdateBankReceiptPreferencesBody.parse({ preferredTemplate });
    assert.equal(input.preferredTemplate, preferredTemplate);
    assert.deepEqual(
      GetBankReceiptPreferencesResponse.parse(input),
      { preferredTemplate },
    );
  }
});

test("receipt preference API rejects unknown layouts and malformed payloads", () => {
  assert.equal(
    UpdateBankReceiptPreferencesBody.safeParse({
      preferredTemplate: "untrusted-layout",
    }).success,
    false,
  );
  assert.equal(
    UpdateBankReceiptPreferencesBody.safeParse({ preferredTemplate: null })
      .success,
    false,
  );
  assert.equal(UpdateBankReceiptPreferencesBody.safeParse({}).success, false);
});
