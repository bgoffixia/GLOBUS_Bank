export type SignupProgressStage = 'optional-profile' | 'verify';
export type SignupResumeStage = 'details' | SignupProgressStage | 'dashboard';

export type OptionalSignupProfile = {
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

type SignupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const SIGNUP_PROGRESS_STORAGE_KEY = 'globus-bank:signup-progress:v1';
const SIGNUP_PROFILE_DRAFT_STORAGE_KEY = 'globus-bank:signup-profile-draft:v1';
const allowedText = /^[\p{L}\p{M}\p{N}\s.'’&(),/-]+$/u;
const allowedPhone = /^[+0-9().\-\s]+$/;
let inMemorySignupProfileDraft: SignupProfileDraft | null = null;

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
  if (!trimmed || trimmed.length > maxLength || !allowedText.test(trimmed)) {
    return undefined;
  }
  return trimmed;
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

  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const phoneDigits = phone.replace(/\D/g, '');
  if (phone && phone.length <= 32 && allowedPhone.test(phone) &&
      phoneDigits.length >= 7 && phoneDigits.length <= 15) {
    normalized.phone = phone;
  }

  const country = optionalText(input.country, 80);
  if (country) normalized.country = country;

  const cityOfOrigin = optionalText(input.cityOfOrigin, 100);
  if (cityOfOrigin) normalized.cityOfOrigin = cityOfOrigin;

  if (isValidDateOfBirth(input.dateOfBirth)) {
    normalized.dateOfBirth = input.dateOfBirth as string;
  }

  const occupation = optionalText(input.occupation, 100);
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
}: {
  isSignedIn: boolean;
  emailVerified: boolean;
  clerkStatus: 'missing_requirements' | 'complete' | 'abandoned';
  persistedStage: SignupProgressStage | null;
}): SignupResumeStage {
  if (isSignedIn) return 'dashboard';
  if (persistedStage === 'optional-profile') return 'optional-profile';
  if (persistedStage === 'verify' || emailVerified) return 'verify';
  if (clerkStatus === 'complete') return 'optional-profile';
  return 'details';
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
