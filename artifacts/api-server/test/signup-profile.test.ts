import assert from "node:assert/strict";
import test from "node:test";
import { SaveSignupProfileBody, UpdateBankProfileBody } from "@workspace/api-zod";
import { sanitizeSignupProfileDetails } from "../src/lib/signup-profile";

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

test("provided optional text is retained without format checks; invalid dates are skipped", () => {
  assert.deepEqual(
    sanitizeSignupProfileDetails({
      phone: "phone me",
      country: "Nigeri@",
      cityOfOrigin: "A".repeat(101),
      dateOfBirth: "2023-02-30",
      occupation: "Student / part-time",
    }),
    {
      phone: "phone me",
      country: "Nigeri@",
      cityOfOrigin: "A".repeat(101),
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
      phone: "+1 55",
    }),
    { phone: "+1 55" },
  );
});
