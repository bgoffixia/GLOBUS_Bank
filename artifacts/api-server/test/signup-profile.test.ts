import assert from "node:assert/strict";
import test from "node:test";
import { SaveSignupProfileBody, UpdateBankProfileBody } from "@workspace/api-zod";
import {
  normalizeRequiredProfileName,
  sanitizeBankProfileUpdateDetails,
  sanitizeSignupProfileDetails,
} from "../src/lib/signup-profile";

test("accepts required names with each supplied optional registration field", () => {
  const parsed = SaveSignupProfileBody.safeParse({
    firstName: "Ada",
    lastName: "Mensah",
    phone: "+233 24 123 4567",
    country: "Ghana",
    cityOfOrigin: "Accra",
    dateOfBirth: "1992-03-14",
    occupation: "Product designer",
  });
  assert.equal(parsed.success, true);
});

test("accepts required names when all additional profile fields are omitted", () => {
  const parsed = SaveSignupProfileBody.safeParse({
    firstName: "Ada",
    lastName: "Mensah",
  });
  assert.equal(parsed.success, true);
});

test("blank optional profile values are omitted", () => {
  assert.deepEqual(
    sanitizeSignupProfileDetails({
      phone: " ",
      country: "",
      cityOfOrigin: "   ",
      dateOfBirth: "",
      occupation: "",
    }),
    {},
  );
});

test("valid optional values are trimmed and kept", () => {
  assert.deepEqual(
    sanitizeSignupProfileDetails({
      phone: "+233 24 123 4567",
      country: " Ghana ",
      cityOfOrigin: " Accra ",
      dateOfBirth: "1992-03-14",
      occupation: " Product designer ",
    }),
    {
      phone: "+233 24 123 4567",
      country: "Ghana",
      cityOfOrigin: "Accra",
      dateOfBirth: "1992-03-14",
      occupation: "Product designer",
    },
  );
});

test("invalid optional formats are skipped while valid profile details are kept", () => {
  assert.deepEqual(
    sanitizeSignupProfileDetails({
      phone: "phone me",
      country: "Nigeri@",
      cityOfOrigin: "A".repeat(1025),
      dateOfBirth: "2023-02-30",
      occupation: "Student / part-time",
    }),
    {
      occupation: "Student / part-time",
    },
  );
});

test("profile updates accept omitted optional details and explicit clearing values", () => {
  assert.equal(
    UpdateBankProfileBody.safeParse({
      firstName: "Ada",
      lastName: "Mensah",
    }).success,
    true,
  );
  assert.equal(
    UpdateBankProfileBody.safeParse({
      firstName: "Ada",
      lastName: "Mensah",
      phone: null,
      country: null,
      cityOfOrigin: null,
      dateOfBirth: null,
      occupation: null,
    }).success,
    true,
  );
  assert.equal(
    UpdateBankProfileBody.safeParse({
      firstName: "Ada",
      lastName: "Mensah",
      phone: "phone me",
      country: "Nigeri@",
      dateOfBirth: "not-a-date",
    }).success,
    true,
  );
});

test("invalid optional dates are ignored without rejecting other supplied details", () => {
  assert.deepEqual(
    sanitizeSignupProfileDetails({
      dateOfBirth: "2999-01-01",
      phone: "+1 555 234 5678",
    }),
    { phone: "+1 555 234 5678" },
  );
});

test("profile update ignores invalid optional values but allows explicit clearing", () => {
  assert.deepEqual(
    sanitizeBankProfileUpdateDetails({
      phone: "phone me",
      country: null,
      cityOfOrigin: "Accra",
      dateOfBirth: "not-a-date",
      occupation: null,
    }),
    {
      country: null,
      cityOfOrigin: "Accra",
      occupation: null,
    },
  );
});

test("required profile names are trimmed and blank or overlong names are rejected", () => {
  assert.equal(normalizeRequiredProfileName(" Ada "), "Ada");
  assert.equal(normalizeRequiredProfileName("  "), undefined);
  assert.equal(normalizeRequiredProfileName("A".repeat(81)), undefined);
  assert.equal(normalizeRequiredProfileName("Ada\u0000"), undefined);
});
