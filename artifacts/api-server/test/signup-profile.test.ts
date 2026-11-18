import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeSignupProfileDetails } from "../src/lib/signup-profile";

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

test("malformed optional values are discarded without discarding valid fields", () => {
  assert.deepEqual(
    sanitizeSignupProfileDetails({
      phone: "phone me",
      country: "Nigeri@",
      cityOfOrigin: "A".repeat(101),
      dateOfBirth: "2023-02-30",
      occupation: "Student / part-time",
    }),
    { occupation: "Student / part-time" },
  );
});

test("future birth dates and impossible phone lengths are ignored", () => {
  assert.deepEqual(
    sanitizeSignupProfileDetails({
      dateOfBirth: "2999-01-01",
      phone: "+1 55",
    }),
    {},
  );
});
