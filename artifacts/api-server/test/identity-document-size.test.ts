import assert from "node:assert/strict";
import { test } from "node:test";
import type { File } from "@google-cloud/storage";
import { validateUploadedIdentityDocument } from "../src/lib/identityDocumentStorage";

const maxSizeBytes = 10 * 1024 * 1024;

function mockPdf(size: number): File {
  return {
    getMetadata: async () => [{ size: String(size) }],
    download: async () => [Buffer.from("%PDF-1.7")],
  } as unknown as File;
}

test("stored identity documents accept small valid PDFs and the exact 10 MB limit", async () => {
  assert.equal(
    await validateUploadedIdentityDocument(mockPdf(8), "application/pdf", 8),
    true,
  );
  assert.equal(
    await validateUploadedIdentityDocument(
      mockPdf(maxSizeBytes),
      "application/pdf",
      maxSizeBytes,
    ),
    true,
  );
});

test("stored identity documents reject empty and over-limit files", async () => {
  assert.equal(
    await validateUploadedIdentityDocument(mockPdf(0), "application/pdf", 0),
    false,
  );
  assert.equal(
    await validateUploadedIdentityDocument(
      mockPdf(maxSizeBytes + 1),
      "application/pdf",
      maxSizeBytes + 1,
    ),
    false,
  );
});
