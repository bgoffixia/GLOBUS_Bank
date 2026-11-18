export type SanitizedSignupProfileDetails = {
  phone?: string;
  country?: string;
  cityOfOrigin?: string;
  dateOfBirth?: string;
  occupation?: string;
};

const profileTextPattern = /^[\p{L}\p{M}\p{N}\s.'’&(),/-]+$/u;
const phonePattern = /^[+0-9().\-\s]+$/;

function validText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > maxLength ||
    !profileTextPattern.test(trimmed)
  ) {
    return undefined;
  }
  return trimmed;
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

  if (typeof input.phone === "string") {
    const phone = input.phone.trim();
    const digits = phone.replace(/\D/g, "");
    if (
      phone &&
      phone.length <= 32 &&
      phonePattern.test(phone) &&
      digits.length >= 7 &&
      digits.length <= 15
    ) {
      details.phone = phone;
    }
  }

  const country = validText(input.country, 80);
  if (country) details.country = country;

  const cityOfOrigin = validText(input.cityOfOrigin, 100);
  if (cityOfOrigin) details.cityOfOrigin = cityOfOrigin;

  const dateOfBirth = validDateOfBirth(input.dateOfBirth);
  if (dateOfBirth) details.dateOfBirth = dateOfBirth;

  const occupation = validText(input.occupation, 100);
  if (occupation) details.occupation = occupation;

  return details;
}
