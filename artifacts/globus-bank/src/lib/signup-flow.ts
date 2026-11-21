export type SignupProgressStage = 'optional-profile' | 'verify';
export type SignupResumeStage = 'details' | SignupProgressStage | 'dashboard';

export type OptionalSignupProfile = {
  address?: string;
  phone?: string;
  country?: string;
  cityOfOrigin?: string;
  dateOfBirth?: string;
  occupation?: string;
};

export type SignupProfileDraft = OptionalSignupProfile & {
  emailAddress: string;
  firstName: string;
  lastName: string;
  acceptedTerms?: true;
};

export type RequiredSignupDetailsInput = {
  firstName: string;
  lastName: string;
  username: string;
  emailAddress: string;
  password: string;
  hasPassword?: boolean;
  acceptedTerms: boolean;
  legalAcceptanceRequired: boolean;
  clerkMissingFields?: readonly string[];
};

type SignupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const SIGNUP_PROGRESS_STORAGE_KEY = 'globus-bank:signup-progress:v1';
const SIGNUP_PROFILE_DRAFT_STORAGE_KEY = 'globus-bank:signup-profile-draft:v1';
let inMemorySignupProfileDraft: SignupProfileDraft | null = null;
const PLACE_TEXT_PATTERN = /^[\p{L}\p{M}\p{N} .,'’()&/-]+$/u;

function getBrowserSessionStorage(): SignupStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function optionalText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed &&
    trimmed.length <= maxLength &&
    PLACE_TEXT_PATTERN.test(trimmed)
    ? trimmed
    : undefined;
}

function optionalOccupation(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed &&
    trimmed.length <= 1024 &&
    /[\p{L}\p{N}]/u.test(trimmed) &&
    !/[\p{Cc}\p{Cf}]/u.test(trimmed)
    ? trimmed
    : undefined;
}

function optionalAddress(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed &&
    trimmed.length <= 1024 &&
    /[\p{L}\p{N}]/u.test(trimmed) &&
    !/[\p{Cc}\p{Cf}]/u.test(trimmed)
    ? trimmed
    : undefined;
}

function optionalPhone(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  const digitCount = trimmed.replace(/\D/g, '').length;
  return trimmed &&
    trimmed.length <= 1024 &&
    /^\+?[0-9(). -]+$/.test(trimmed) &&
    digitCount >= 7 &&
    digitCount <= 15
    ? trimmed
    : undefined;
}

function isValidDateOfBirth(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value <= new Date().toISOString().slice(0, 10);
}

export function sanitizeOptionalSignupProfile(
  input: Partial<Record<keyof OptionalSignupProfile, unknown>>,
): OptionalSignupProfile {
  const normalized: OptionalSignupProfile = {};

  const address = optionalAddress(input.address);
  if (address) normalized.address = address;

  const phone = optionalPhone(input.phone);
  if (phone) normalized.phone = phone;

  const country = optionalText(input.country, 1024);
  if (country) normalized.country = country;

  const cityOfOrigin = optionalText(input.cityOfOrigin, 1024);
  if (cityOfOrigin) normalized.cityOfOrigin = cityOfOrigin;

  if (isValidDateOfBirth(input.dateOfBirth)) {
    normalized.dateOfBirth = input.dateOfBirth as string;
  }

  const occupation = optionalOccupation(input.occupation);
  if (occupation) normalized.occupation = occupation;

  return normalized;
}

export function persistSignupProgress(
  signupId: string | null | undefined,
  stage: SignupProgressStage,
  storage = getBrowserSessionStorage(),
) {
  if (!signupId || !storage) return;
  try {
    storage.setItem(
      SIGNUP_PROGRESS_STORAGE_KEY,
      JSON.stringify({ signupId, stage }),
    );
  } catch {
    // The live Clerk state remains the fallback when browser storage is unavailable.
  }
}

export function readSignupProgress(
  signupId: string | null | undefined,
  storage = getBrowserSessionStorage(),
): SignupProgressStage | null {
  if (!signupId || !storage) return null;
  try {
    const raw = storage.getItem(SIGNUP_PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { signupId?: unknown; stage?: unknown };
    if (saved.signupId !== signupId) {
      storage.removeItem(SIGNUP_PROGRESS_STORAGE_KEY);
      return null;
    }
    if (saved.stage === 'verify' || saved.stage === 'optional-profile') {
      return saved.stage;
    }
    // Resume users who had reached the former post-verification profile screen.
    return saved.stage === 'profile' ? 'verify' : null;
  } catch {
    return null;
  }
}

export function clearSignupProgress(
  signupId: string | null | undefined,
  storage = getBrowserSessionStorage(),
) {
  if (!signupId || !storage) return;
  try {
    const raw = storage.getItem(SIGNUP_PROGRESS_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as { signupId?: unknown };
    if (saved.signupId === signupId) {
      storage.removeItem(SIGNUP_PROGRESS_STORAGE_KEY);
    }
  } catch {
    // A stale or unavailable marker must not interrupt sign-up.
  }
}

export function persistSignupProfileDraft(
  draft: SignupProfileDraft,
  storage = getBrowserSessionStorage(),
) {
  const emailAddress = draft.emailAddress.trim().toLowerCase();
  const firstName = draft.firstName.trim();
  const lastName = draft.lastName.trim();
  if (!emailAddress || !firstName || !lastName) return false;

  inMemorySignupProfileDraft = {
    emailAddress,
    firstName,
    lastName,
    ...sanitizeOptionalSignupProfile(draft),
    ...(draft.acceptedTerms === true ? { acceptedTerms: true as const } : {}),
  };
  if (!storage) return false;
  try {
    storage.setItem(
      SIGNUP_PROFILE_DRAFT_STORAGE_KEY,
      JSON.stringify(inMemorySignupProfileDraft),
    );
    return true;
  } catch {
    return false;
  }
}

export function readSignupProfileDraft(
  storage = getBrowserSessionStorage(),
): SignupProfileDraft | null {
  if (inMemorySignupProfileDraft) return inMemorySignupProfileDraft;
  if (!storage) return null;
  try {
    const raw = storage.getItem(SIGNUP_PROFILE_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<SignupProfileDraft>;
    if (
      typeof draft.emailAddress !== 'string' ||
      typeof draft.firstName !== 'string' ||
      typeof draft.lastName !== 'string' ||
      !draft.emailAddress.trim() ||
      !draft.firstName.trim() ||
      !draft.lastName.trim()
    ) {
      storage.removeItem(SIGNUP_PROFILE_DRAFT_STORAGE_KEY);
      return null;
    }
    inMemorySignupProfileDraft = {
      emailAddress: draft.emailAddress.trim().toLowerCase(),
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      ...sanitizeOptionalSignupProfile(draft),
      ...(draft.acceptedTerms === true ? { acceptedTerms: true as const } : {}),
    };
    return inMemorySignupProfileDraft;
  } catch {
    return null;
  }
}

export function clearSignupProfileDraft(
  storage = getBrowserSessionStorage(),
) {
  inMemorySignupProfileDraft = null;
  try {
    storage?.removeItem(SIGNUP_PROFILE_DRAFT_STORAGE_KEY);
  } catch {
    // Retaining a stale browser-only draft must not affect account access.
  }
}

export function resolveSignupResumeStage({
  isSignedIn,
  emailVerified,
  clerkStatus,
  persistedStage,
  missingFields = [],
}: {
  isSignedIn: boolean;
  emailVerified: boolean;
  clerkStatus: 'missing_requirements' | 'complete' | 'abandoned';
  persistedStage: SignupProgressStage | null;
  missingFields?: readonly string[];
}): SignupResumeStage {
  if (isSignedIn) return 'dashboard';
  if (hasRequiredSignupDetailsMissing(missingFields)) return 'details';
  if (persistedStage === 'optional-profile') return 'optional-profile';
  if (persistedStage === 'verify' || emailVerified) return 'verify';
  if (clerkStatus === 'complete') return 'optional-profile';
  return 'details';
}

const signupFieldLabels: Record<string, string> = {
  first_name: 'first name',
  last_name: 'last name',
  username: 'username',
  email_address: 'email address',
  password: 'password',
  legal_accepted: 'account terms',
  phone_number: 'phone number',
};

const preVerificationRequiredFields = [
  'first_name',
  'last_name',
  'username',
  'email_address',
  'password',
  'legal_accepted',
] as const;

export function getMissingRequiredSignupDetails(
  input: RequiredSignupDetailsInput,
): string[] {
  const missing: string[] = [];
  const normalizedEmail = input.emailAddress.trim();

  if (!input.firstName.trim()) missing.push('first_name');
  if (!input.lastName.trim()) missing.push('last_name');
  if (!/^(?=.*[A-Za-z])[A-Za-z0-9_-]{6,12}$/.test(input.username.trim())) {
    missing.push('username');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    missing.push('email_address');
  }
  if (input.password.length < 8 && !input.hasPassword) missing.push('password');
  if (input.legalAcceptanceRequired && !input.acceptedTerms) {
    missing.push('legal_accepted');
  }

  for (const field of input.clerkMissingFields ?? []) {
    // Phone remains an optional profile detail and is not an email-verification gate.
    if (field === 'phone_number') continue;
    if (preVerificationRequiredFields.includes(field as typeof preVerificationRequiredFields[number])) {
      missing.push(field);
    } else {
      missing.push(signupFieldLabels[field] ?? 'additional required account details');
    }
  }

  return [...new Set(missing)].map((field) => signupFieldLabels[field] ?? field);
}

export function hasRequiredSignupDetailsMissing(
  missingFields: readonly string[],
): boolean {
  return missingFields.some((field) =>
    preVerificationRequiredFields.includes(field as typeof preVerificationRequiredFields[number]),
  );
}

export function requiredSignupDetailsMessage(
  missingLabels: readonly string[],
  emailVerified = false,
): string {
  const labels = [...new Set(missingLabels)];
  const details = labels.length === 1
    ? labels[0]
    : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return emailVerified
    ? `Your email is verified. Please review and resubmit your ${details} to finish setting up your account.`
    : `Complete your ${details} before email verification.`;
}

export async function verifyEmailCode(
  verify: () => Promise<{ error: { message?: string } | null }>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const result = await verify();
    if (result.error) {
      return {
        ok: false,
        message: result.error.message || 'That code could not be verified. Check it and try again.',
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: 'We could not verify that code right now. Check your connection and try again.',
    };
  }
}

export async function clearLocalSignupAttempt(
  resetAttempt: () => Promise<{ error: { message?: string } | null }>,
  clearProgress: () => void,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const result = await resetAttempt();
    if (result.error) {
      return {
        ok: false,
        message: result.error.message || 'This unfinished sign-up could not be cleared. You can retry or use account recovery.',
      };
    }
    clearProgress();
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: 'This unfinished sign-up could not be cleared. You can retry or use account recovery.',
    };
  }
}

export function signupCreationErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'We could not start your account. Retry, or sign in and use account recovery if you already have an account.';
  }

  const value = error as {
    code?: unknown;
    errors?: Array<{ code?: unknown }> | null;
    message?: unknown;
  };
  const codes = [
    value.code,
    ...(Array.isArray(value.errors) ? value.errors.map((entry) => entry?.code) : []),
  ].filter((code): code is string => typeof code === 'string');
  if (codes.some((code) =>
    ['form_identifier_exists', 'identifier_exists', 'email_address_taken'].includes(code)
  )) {
    return 'We could not continue sign-up with these details. Try signing in or use account recovery. If the attempt was unfinished, start over and retry with the same email.';
  }

  return typeof value.message === 'string' && value.message
    ? value.message
    : 'We could not start your account. Retry, or sign in and use account recovery if you already have an account.';
}

export function getMissingSignupNameUpdates(
  missingFields: readonly string[],
  firstName: string,
  lastName: string,
): { firstName?: string; lastName?: string } {
  const updates: { firstName?: string; lastName?: string } = {};
  if (missingFields.includes('first_name') && firstName.trim()) {
    updates.firstName = firstName.trim();
  }
  if (missingFields.includes('last_name') && lastName.trim()) {
    updates.lastName = lastName.trim();
  }
  return updates;
}

export async function syncMissingSignupNames(
  missingFields: readonly string[],
  firstName: string,
  lastName: string,
  update: (values: { firstName?: string; lastName?: string }) => Promise<{
    error: { message?: string } | null;
  }>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const values = getMissingSignupNameUpdates(missingFields, firstName, lastName);
  if (Object.keys(values).length === 0) return { ok: true };

  try {
    const result = await update(values);
    if (result.error) {
      return {
        ok: false,
        message: result.error.message || 'Clerk could not save the required name details. Check them and try again.',
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: 'Clerk could not save the required name details right now. Check your connection and try again.',
    };
  }
}

export async function finalizeVerifiedSignup(
  finalize: () => Promise<{ error: { message?: string } | null }>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const result = await finalize();
    if (result.error) {
      return {
        ok: false,
        message: result.error.message || 'Your verified account could not be activated. Review any remaining required account details and try again.',
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: 'Your verified account could not be activated right now. Check your connection and try again.',
    };
  }
}

export async function finalizeSignupAndOpenDashboard(
  finalize: () => Promise<{ error: { message?: string } | null }>,
  clearProgress: () => void,
  openDashboard: () => void,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await finalizeVerifiedSignup(finalize);
  if (!result.ok) return result;
  clearProgress();
  openDashboard();
  return { ok: true };
}

export function getSignupFinalizationBlocker({
  status,
  createdSessionId,
  missingFields,
}: {
  status: 'missing_requirements' | 'complete' | 'abandoned' | string;
  createdSessionId: string | null | undefined;
  missingFields: readonly string[];
}): { ready: true } | { ready: false; message: string } {
  if (status === 'complete' && createdSessionId) return { ready: true };

  if (missingFields.length > 0) {
    const labels = [...new Set(missingFields.map((field) => signupFieldLabels[field]))]
      .filter((label): label is string => Boolean(label));
    if (labels.length > 0) {
      const phoneRequirement = missingFields.includes('phone_number')
        ? ' Phone verification is not part of this sign-up flow, so use sign-in or account recovery, or ask Globus support to review that requirement.'
        : '';
      return {
        ready: false,
        message: `${requiredSignupDetailsMessage(labels, true)}${phoneRequirement}`,
      };
    }
    return {
      ready: false,
      message: 'Your email is verified, but Clerk still needs additional account information. Review the required details to finish setup.',
    };
  }

  if (status === 'complete') {
    return {
      ready: false,
      message: 'Your email is verified, but no sign-in session was created. Try signing in or use account recovery if an account was already created.',
    };
  }

  return {
    ready: false,
    message: 'Your email is verified, but account setup is not complete yet. Review the required details and try again.',
  };
}

export async function finalizeSignupWhenSessionReady(
  state: {
    status: 'missing_requirements' | 'complete' | 'abandoned' | string;
    createdSessionId: string | null | undefined;
    missingFields: readonly string[];
  },
  finalize: () => Promise<{ error: { message?: string } | null }>,
  clearProgress: () => void,
  openDashboard: () => void,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const readiness = getSignupFinalizationBlocker(state);
  if (!readiness.ready) return { ok: false, message: readiness.message };

  return finalizeSignupAndOpenDashboard(finalize, clearProgress, openDashboard);
}

export async function saveSignupProfileWithoutBlocking(
  saveProfile: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await saveProfile();
    return true;
  } catch {
    return false;
  }
}

export async function sendEmailVerificationAfterOptionalDetails(
  persistDetails: () => boolean,
  sendCode: () => Promise<{ error: { message?: string } | null }>,
): Promise<
  | { ok: true; detailsRetained: boolean }
  | { ok: false; detailsRetained: boolean; message: string }
> {
  let detailsRetained = false;
  try {
    detailsRetained = persistDetails();
  } catch {
    // In-memory form state still lets the user continue to verification.
  }

  try {
    const result = await sendCode();
    if (result.error) {
      return {
        ok: false,
        detailsRetained,
        message: result.error.message || 'The email verification code could not be sent. Please try again.',
      };
    }
    return { ok: true, detailsRetained };
  } catch {
    return {
      ok: false,
      detailsRetained,
      message: 'The email verification code could not be sent. Check your connection and try again.',
    };
  }
}

export async function sendEmailVerificationAfterRequiredDetails(
  requiredDetails: RequiredSignupDetailsInput,
  persistDetails: () => boolean,
  sendCode: () => Promise<{ error: { message?: string } | null }>,
): Promise<
  | { ok: true; detailsRetained: boolean; missingRequiredFields: [] }
  | { ok: false; detailsRetained: boolean; message: string; missingRequiredFields: string[] }
> {
  const missingRequiredFields = getMissingRequiredSignupDetails(requiredDetails);
  if (missingRequiredFields.length) {
    return {
      ok: false,
      detailsRetained: false,
      message: requiredSignupDetailsMessage(missingRequiredFields),
      missingRequiredFields,
    };
  }

  const result = await sendEmailVerificationAfterOptionalDetails(
    persistDetails,
    sendCode,
  );
  return result.ok
    ? { ...result, missingRequiredFields: [] }
    : { ...result, missingRequiredFields: [] };
}
