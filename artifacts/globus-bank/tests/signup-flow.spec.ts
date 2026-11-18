import { test, expect } from '@playwright/test';
import {
  buildBankProfileInput,
  clearSignupProgress,
  finalizeSignupAndSaveProfile,
  getProfileCompletionError,
  isBankProfileComplete,
  persistSignupProgress,
  readSignupProgress,
  resolveSignupResumeStage,
  verifyEmailCodeAndContinue,
} from '../src/lib/signup-flow';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

test('verified email continues to profile while Clerk still reports missing requirements', async () => {
  const verified = await verifyEmailCodeAndContinue(async () => ({ error: null }));

  expect(verified).toEqual({ ok: true, nextStage: 'profile' });
  expect(
    resolveSignupResumeStage({
      isSignedIn: false,
      profileComplete: false,
      emailVerified: true,
      clerkStatus: 'missing_requirements',
      persistedStage: null,
    }),
  ).toBe('profile');
});

test('missing profile fields give a specific next step and block submission', () => {
  expect(
    getProfileCompletionError({
      firstName: 'Amina',
      lastName: 'Okafor',
      phone: '',
      country: 'Nigeria',
      dateOfBirth: '1990-01-01',
      acceptedTerms: true,
    }),
  ).toBe('Enter your phone number to continue.');

  expect(
    getProfileCompletionError({
      firstName: 'Amina',
      lastName: 'Okafor',
      phone: '+2348000000000',
      country: 'Nigeria',
      dateOfBirth: '1990-01-01',
      acceptedTerms: false,
    }),
  ).toBe('Accept the account terms to finish setting up your profile.');

  expect(
    isBankProfileComplete({
      firstName: 'Amina',
      lastName: 'Okafor',
      phone: '+2348000000000',
      country: 'Nigeria',
      dateOfBirth: '1990-01-01',
    }),
  ).toBe(true);
  expect(isBankProfileComplete({ phone: null, country: null })).toBe(false);
});

test('profile completion sends all required details and account-term acceptance to the API', () => {
  expect(
    buildBankProfileInput({
      firstName: ' Amina ',
      lastName: ' Okafor ',
      phone: ' +2348000000000 ',
      country: ' Nigeria ',
      dateOfBirth: '1990-01-01',
    }),
  ).toEqual({
    firstName: 'Amina',
    lastName: 'Okafor',
    phone: '+2348000000000',
    country: 'Nigeria',
    dateOfBirth: '1990-01-01',
    acceptedTerms: true,
  });
});

test('refresh and return navigation restore the verified profile step for the same Clerk sign-up', () => {
  const storage = createStorage();
  persistSignupProgress('signup-123', 'profile', storage);

  expect(readSignupProgress('signup-123', storage)).toBe('profile');
  expect(readSignupProgress('signup-other', storage)).toBeNull();

  persistSignupProgress('signup-123', 'verify', storage);
  expect(
    resolveSignupResumeStage({
      isSignedIn: false,
      profileComplete: false,
      emailVerified: false,
      clerkStatus: 'missing_requirements',
      persistedStage: readSignupProgress('signup-123', storage),
    }),
  ).toBe('verify');

  persistSignupProgress('signup-123', 'profile', storage);
  expect(
    resolveSignupResumeStage({
      isSignedIn: false,
      profileComplete: false,
      emailVerified: false,
      clerkStatus: 'missing_requirements',
      persistedStage: readSignupProgress('signup-123', storage),
    }),
  ).toBe('profile');
  clearSignupProgress('signup-123', storage);
  expect(readSignupProgress('signup-123', storage)).toBeNull();
});

test('successful finalization saves profile fields in order before completing onboarding', async () => {
  const steps: string[] = [];
  const result = await finalizeSignupAndSaveProfile(
    async () => {
      steps.push('finalize');
      return { error: null };
    },
    async () => {
      steps.push('save-profile');
    },
  );

  expect(result).toEqual({ ok: true });
  expect(steps).toEqual(['finalize', 'save-profile']);
});

test('API or database save failures keep profile completion retryable', async () => {
  const result = await finalizeSignupAndSaveProfile(
    async () => ({ error: null }),
    async () => {
      throw new Error('database unavailable');
    },
  );

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.kind).toBe('profile');
    expect(result.message).toContain('Your details are still on this page');
    expect(result.message).toContain('select Continue to retry');
    expect(result.message).not.toContain('contact support');
  }
});

test('email verification errors remain on the code step with a retryable message', async () => {
  const result = await verifyEmailCodeAndContinue(async () => ({
    error: { message: 'The code has expired.' },
  }));

  expect(result).toEqual({ ok: false, message: 'The code has expired.' });
});
