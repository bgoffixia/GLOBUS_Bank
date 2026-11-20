import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ReceiptTemplate } from "@workspace/api-zod";
import { withCustomerReceiptTemplate } from "../src/lib/customer-receipt-template";

const transactionRouteFiles = [
  new URL("../src/routes/bank.ts", import.meta.url),
  new URL("../src/routes/bankAdmin.ts", import.meta.url),
  new URL("../src/lib/vault-subscriber-deposit.ts", import.meta.url),
];

test("a saved customer layout is snapshotted without any Vault session input", () => {
  const transaction = withCustomerReceiptTemplate(
    { reference: "GB-RECEIPT-PERSISTENCE" },
    ReceiptTemplate.transfer_ledger,
  );

  assert.equal(transaction.receiptTemplate, ReceiptTemplate.transfer_ledger);
  assert.equal(transaction.reference, "GB-RECEIPT-PERSISTENCE");
});

test("unsupported or missing preferences safely use the standard receipt", () => {
  assert.equal(
    withCustomerReceiptTemplate({}, "unsupported-layout").receiptTemplate,
    ReceiptTemplate.standard,
  );
  assert.equal(
    withCustomerReceiptTemplate({}, null).receiptTemplate,
    ReceiptTemplate.standard,
  );
});

test("every customer transaction insert snapshots the saved receipt template", () => {
  for (const file of transactionRouteFiles) {
    const source = readFileSync(file, "utf8");
    const inserts =
      source.match(/\.insert\(bankTransactionsTable\)/g)?.length ?? 0;
    const snapshots =
      source.match(/\.values\(withCustomerReceiptTemplate\(/g)?.length ?? 0;

    assert.ok(inserts > 0, `Expected transaction inserts in ${file.pathname}`);
    assert.equal(
      snapshots,
      inserts,
      `Every bank transaction insert in ${file.pathname} must snapshot the saved preference`,
    );
  }
});
