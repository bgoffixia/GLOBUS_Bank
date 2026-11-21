export type SanitizedSignupProfileDetails = {
  address?: string;
  phone?: string;
  country?: string;
  cityOfOrigin?: string;
  dateOfBirth?: string;
  occupation?: string;
};

const PLACE_TEXT_PATTERN = /^[\p{L}\p{M}\p{N} .,'’()&/-]+$/u;

function validText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed &&
    trimmed.length <= maxLength &&
    PLACE_TEXT_PATTERN.test(trimmed)
    ? trimmed
    : undefined;
}

function validOccupation(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed &&
    trimmed.length <= maxLength &&
    /[\p{L}\p{N}]/u.test(trimmed) &&
    !/[\p{Cc}\p{Cf}]/u.test(trimmed)
    ? trimmed
    : undefined;
}

function validAddress(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed &&
    trimmed.length <= 1024 &&
    /[\p{L}\p{N}]/u.test(trimmed) &&
    !/[\p{Cc}\p{Cf}]/u.test(trimmed)
    ? trimmed
    : undefined;
}

function validPhone(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  const digitCount = trimmed.replace(/\D/g, "").length;
  return trimmed &&
    trimmed.length <= 1024 &&
    /^\+?[0-9(). -]+$/.test(trimmed) &&
    digitCount >= 7 &&
    digitCount <= 15
    ? trimmed
    : undefined;
}

export function normalizeRequiredProfileName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed &&
    trimmed.length <= 80 &&
    /\p{L}/u.test(trimmed) &&
    !/[\p{Cc}\p{Cf}]/u.test(trimmed)
    ? trimmed
    : undefined;
}

function validDateOfBirth(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    value > new Date().toISOString().slice(0, 10)
  ) {
    return undefined;
  }
  return value;
}

export function sanitizeSignupProfileDetails(
  input: Record<string, unknown>,
): SanitizedSignupProfileDetails {
  const details: SanitizedSignupProfileDetails = {};

  const address = validAddress(input.address);
  if (address) details.address = address;

  const phone = validPhone(input.phone);
  if (phone) details.phone = phone;

  const country = validText(input.country, 1024);
  if (country) details.country = country;

  const cityOfOrigin = validText(input.cityOfOrigin, 1024);
  if (cityOfOrigin) details.cityOfOrigin = cityOfOrigin;

  const dateOfBirth = validDateOfBirth(input.dateOfBirth);
  if (dateOfBirth) details.dateOfBirth = dateOfBirth;

  const occupation = validOccupation(input.occupation, 1024);
  if (occupation) details.occupation = occupation;

  return details;
}

export type SanitizedBankProfileUpdateDetails = {
  address?: string | null;
  phone?: string | null;
  country?: string | null;
  cityOfOrigin?: string | null;
  dateOfBirth?: string | null;
  occupation?: string | null;
};

export function sanitizeBankProfileUpdateDetails(
  input: Record<string, unknown>,
): SanitizedBankProfileUpdateDetails {
  const sanitized = sanitizeSignupProfileDetails(input);
  const updates: SanitizedBankProfileUpdateDetails = {};
  const fields = [
    "address",
    "phone",
    "country",
    "cityOfOrigin",
    "dateOfBirth",
    "occupation",
  ] as const;

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    if (input[field] === null) {
      updates[field] = null;
    } else if (sanitized[field] !== undefined) {
      updates[field] = sanitized[field];
    }
  }

  return updates;
}
