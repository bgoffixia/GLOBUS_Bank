export type CustomerProfileFields = {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  country?: string | null;
  cityOfOrigin?: string | null;
  dateOfBirth?: string | null;
  occupation?: string | null;
};

export const customerProfileFieldLabels = [
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['phone', 'Phone number'],
  ['country', 'Country of origin'],
  ['cityOfOrigin', 'City of origin'],
  ['dateOfBirth', 'Date of birth'],
  ['occupation', 'Occupation / employment status'],
] as const satisfies ReadonlyArray<
  readonly [keyof CustomerProfileFields, string]
>;

export function isProfileFieldProvided(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function getMissingCustomerProfileFields(
  profile: CustomerProfileFields | null | undefined,
): string[] {
  return customerProfileFieldLabels
    .filter(([key]) => !isProfileFieldProvided(profile?.[key]))
    .map(([, label]) => label);
}
