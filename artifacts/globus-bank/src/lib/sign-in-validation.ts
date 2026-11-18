export type SignInValidationField = 'username' | 'password';

export type SignInValidationError = {
  field: SignInValidationField;
  message: string;
};

export type SignInValidationInput = {
  username: string;
  password: string;
  usernameMinLength: number;
  usernameMaxLength: number;
};

export type RecoveryLookup =
  | { type: 'customerId'; customerId: string }
  | { type: 'email'; email: string };

export type UsernameRecoveryNextStep =
  | 'reveal-username'
  | 'verify-second-factor'
  | 'blocked';

export function getUsernameRecoveryNextStep(
  status: string | null,
  hasVerificationError: boolean,
): UsernameRecoveryNextStep {
  if (hasVerificationError) return 'blocked';
  if (status === 'complete') return 'reveal-username';
  if (status === 'needs_second_factor' || status === 'needs_client_trust') {
    return 'verify-second-factor';
  }
  return 'blocked';
}

export function parseRecoveryLookup(value: string): RecoveryLookup | null {
  const trimmed = value.trim();
  if (/^[A-Za-z0-9]{7}$/.test(trimmed)) {
    return { type: 'customerId', customerId: trimmed.toUpperCase() };
  }
  if (/^[^\s@]+@[^\s@]+$/.test(trimmed)) {
    return { type: 'email', email: trimmed };
  }
  return null;
}

export function supportsEmailCodeRecovery(
  emailEnabled: boolean,
  firstFactors: string[] | undefined,
  verificationStrategies: string[] | undefined,
): boolean {
  return emailEnabled && (
    firstFactors?.includes('email_code') === true ||
    verificationStrategies?.includes('email_code') === true
  );
}

export function validateSignInCredentials({
  username,
  password,
  usernameMinLength,
  usernameMaxLength,
}: SignInValidationInput): SignInValidationError | null {
  const normalizedUsername = username.trim();
  if (!normalizedUsername) {
    return { field: 'username', message: 'Enter your username.' };
  }
  if (normalizedUsername.length < usernameMinLength || normalizedUsername.length > usernameMaxLength) {
    return {
      field: 'username',
      message: `Username must be between ${usernameMinLength} and ${usernameMaxLength} characters.`,
    };
  }
  if (!password) {
    return { field: 'password', message: 'Enter your password.' };
  }
  return null;
}
