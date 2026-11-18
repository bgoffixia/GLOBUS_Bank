export type SignInIdentifierMode = 'customerId' | 'email' | 'username' | 'phone';
export type SignInValidationField = 'identifier' | 'password';

export type SignInValidationError = {
  field: SignInValidationField;
  message: string;
};

export type SignInValidationInput = {
  mode: SignInIdentifierMode | null;
  identifier: string;
  password: string;
  usernameMinLength: number;
  usernameMaxLength: number;
};

export function getSignInIdentifierModes(
  emailEnabled: boolean,
  usernameEnabled: boolean,
  phoneEnabled = false,
): SignInIdentifierMode[] {
  return [
    ...(emailEnabled ? (['customerId', 'email'] as const) : []),
    ...(usernameEnabled ? (['username'] as const) : []),
    ...(phoneEnabled ? (['phone'] as const) : []),
  ];
}

export function resolveSignInIdentifierMode(
  preferredMode: SignInIdentifierMode,
  supportedModes: SignInIdentifierMode[],
): SignInIdentifierMode | null {
  return supportedModes.includes(preferredMode)
    ? preferredMode
    : supportedModes[0] ?? null;
}

export function supportsEmailCodeSignIn(
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
  mode,
  identifier,
  password,
  usernameMinLength,
  usernameMaxLength,
}: SignInValidationInput): SignInValidationError | null {
  const value = identifier.trim();
  if (!mode) {
    return {
      field: 'identifier',
      message: 'No supported identifier sign-in is enabled. Contact Globus support.',
    };
  }

  if (mode === 'customerId') {
    if (!value) {
      return { field: 'identifier', message: 'Enter your Customer ID.' };
    }
    if (!/^[A-Za-z0-9]{7}$/.test(value)) {
      return {
        field: 'identifier',
        message: 'Enter a seven-character Customer ID using letters and numbers.',
      };
    }
  } else if (mode === 'email') {
    if (!value) {
      return { field: 'identifier', message: 'Enter your email address.' };
    }
    if (!/^[^\s@]+@[^\s@]+$/.test(value)) {
      return { field: 'identifier', message: 'Enter a valid email address.' };
    }
  } else if (mode === 'phone') {
    if (!value) {
      return { field: 'identifier', message: 'Enter your phone number.' };
    }
  } else {
    if (!value) {
      return { field: 'identifier', message: 'Enter your username.' };
    }
    if (value.length < usernameMinLength || value.length > usernameMaxLength) {
      return {
        field: 'identifier',
        message: `Username must be between ${usernameMinLength} and ${usernameMaxLength} characters.`,
      };
    }
  }

  if (!password) {
    return { field: 'password', message: 'Enter your password.' };
  }

  return null;
}
