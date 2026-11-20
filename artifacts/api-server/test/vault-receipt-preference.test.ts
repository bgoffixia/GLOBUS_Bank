import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { test } from "node:test";
import { UpdateBankVaultReceiptPreferenceBody } from "@workspace/api-zod";
import { bankTransactionsTable } from "@workspace/db";
import { toBankTransaction } from "../src/lib/bank";
import bankRouter from "../src/routes/bank";

test("receipt preference accepts only the five supported layouts", () => {
  for (const preferredReceiptTemplate of [
    "standard",
    "bank_grade",
    "journey",
    "ledger",
    "statement",
  ]) {
    assert.equal(
      UpdateBankVaultReceiptPreferenceBody.safeParse({
        preferredReceiptTemplate,
      }).success,
      true,
    );
  }
  assert.equal(
    UpdateBankVaultReceiptPreferenceBody.safeParse({
      preferredReceiptTemplate: "unsupported-layout",
    }).success,
    false,
  );
});

test("transaction history returns the receipt layout snapshot stored with the transaction", () => {
  const transaction = {
    id: "10000000-0000-4000-8000-000000000001",
    reference: "GB-RECEIPT-HISTORY",
    type: "external_transfer",
    status: "completed",
    receiptTemplate: "ledger",
    fromUserId: "member-test",
    toUserId: null,
    description: "International wire transfer",
    counterparty: "Test bank · ****5678 · Nigeria",
    currency: "USD",
    amountMinor: 1200n,
    feeMinor: 0n,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  } as typeof bankTransactionsTable.$inferSelect;

  const response = toBankTransaction(transaction, "member-test");
  assert.equal(response.receiptTemplate, "ledger");
});

test("receipt preference endpoints deny unauthenticated reads and writes", async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const authHandler = Object.assign(
      () => ({ userId: null, tokenType: "session_token", sessionClaims: {} }),
      { [Symbol.for("@clerk/express.auth")]: true },
    );
    (req as unknown as { auth: typeof authHandler }).auth = authHandler;
    next();
  });
  app.use("/api", bankRouter);

  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/bank/vault/receipt-preference`;

  try {
    const read = await fetch(url);
    assert.equal(read.status, 401);
    const update = await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ preferredReceiptTemplate: "standard" }),
    });
    assert.equal(update.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
