export type SignupProgressStage = 'verify' | 'profile';
export type SignupResumeStage = 'details' | SignupProgressStage | 'dashboard';

export type BankProfileCompletionFields = {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  country?: string | null;
  dateOfBirth?: string | null;
};

export type BankProfileInput = {
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  dateOfBirth: string;
  acceptedTerms: true;
};

type SignupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const SIGNUP_PROGRESS_STORAGE_KEY = 'globus-bank:signup-progress:v1';
const PROFILE_SAVE_RETRY_MESSAGE =
  'Your email is verified, but your Globus profile could not be saved. Your details are still on this page. Check your connection, then select Continue to retry.';

function getBrowserSessionStorage(): SignupStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
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
    return saved.stage === 'verify' || saved.stage === 'profile'
      ? saved.stage
      : null;
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

export function resolveSignupResumeStage({
  isSignedIn,
  profileComplete,
  emailVerified,
  clerkStatus,
  persistedStage,
}: {
  isSignedIn: boolean;
  profileComplete: boolean;
  emailVerified: boolean;
  clerkStatus: 'missing_requirements' | 'complete' | 'abandoned';
  persistedStage: SignupProgressStage | null;
}): SignupResumeStage {
  if (isSignedIn) return profileComplete ? 'dashboard' : 'profile';
  if (emailVerified || clerkStatus === 'complete' || persistedStage === 'profile') {
    return 'profile';
  }
  if (persistedStage === 'verify') return 'verify';
  return 'details';
}

export function isBankProfileComplete(
  profile: BankProfileCompletionFields | null | undefined,
) {
  return Boolean(
    profile?.firstName?.trim() &&
      profile.lastName?.trim() &&
      profile.phone?.trim() &&
      profile.country?.trim() &&
      profile.dateOfBirth,
  );
}

export function buildBankProfileInput({
  firstName,
  lastName,
  phone,
  country,
  dateOfBirth,
}: Omit<BankProfileInput, 'acceptedTerms'>): BankProfileInput {
  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: phone.trim(),
    country: country.trim(),
    dateOfBirth,
    acceptedTerms: true,
  };
}

export function getProfileCompletionError({
  firstName,
  lastName,
  phone,
  country,
  dateOfBirth,
  acceptedTerms,
}: {
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  dateOfBirth: string;
  acceptedTerms: boolean;
}) {
  if (!firstName.trim()) return 'Enter your first name to continue.';
  if (!lastName.trim()) return 'Enter your last name to continue.';
  if (!phone.trim()) return 'Enter your phone number to continue.';
  if (!country.trim()) return 'Choose your country or region to continue.';
  if (!dateOfBirth) return 'Enter your date of birth to continue.';
  if (!acceptedTerms) return 'Accept the account terms to finish setting up your profile.';
  return null;
}

export async function verifyEmailCodeAndContinue(
  verify: () => Promise<{ error: { message?: string } | null }>,
): Promise<{ ok: true; nextStage: 'profile' } | { ok: false; message: string }> {
  try {
    const result = await verify();
    if (result.error) {
      return {
        ok: false,
        message: result.error.message || 'That code could not be verified. Check it and try again.',
      };
    }
    return { ok: true, nextStage: 'profile' };
  } catch {
    return {
      ok: false,
      message: 'We could not verify that code right now. Check your connection and try again.',
    };
  }
}

export async function finalizeSignupAndSaveProfile(
  finalize: () => Promise<{ error: { message?: string } | null }>,
  saveProfile: () => Promise<unknown>,
): Promise<
  | { ok: true }
  | { ok: false; kind: 'clerk' | 'profile'; message: string }
> {
  try {
    const result = await finalize();
    if (result.error) {
      return {
        ok: false,
        kind: 'clerk',
        message: result.error.message || 'Your account could not be activated. Review the required details and try again.',
      };
    }
  } catch {
    return {
      ok: false,
      kind: 'clerk',
      message: 'Your verified account could not be activated right now. Check your connection and try again.',
    };
  }

  try {
    await saveProfile();
    return { ok: true };
  } catch {
    return { ok: false, kind: 'profile', message: PROFILE_SAVE_RETRY_MESSAGE };
  }
}
