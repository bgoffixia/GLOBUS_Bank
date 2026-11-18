import { test, expect } from '@playwright/test';
import {
  clearSignupProfileDraft,
  clearSignupProgress,
  clearLocalSignupAttempt,
  finalizeSignupAndOpenDashboard,
  finalizeSignupWhenSessionReady,
  getSignupFinalizationBlocker,
  persistSignupProfileDraft,
  persistSignupProgress,
  readSignupProfileDraft,
  readSignupProgress,
  resolveSignupResumeStage,
  sanitizeOptionalSignupProfile,
  signupCreationErrorMessage,
  saveSignupProfileWithoutBlocking,
  sendEmailVerificationAfterOptionalDetails,
  verifyEmailCode,
} from '../src/lib/signup-flow';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

test('step one advances to optional details before email verification', () => {
  expect(
    resolveSignupResumeStage({
      isSignedIn: false,
      emailVerified: false,
      clerkStatus: 'missing_requirements',
      persistedStage: null,
    }),
  ).toBe('details');

  expect(
    resolveSignupResumeStage({
      isSignedIn: false,
      emailVerified: false,
      clerkStatus: 'missing_requirements',
      persistedStage: 'optional-profile',
    }),
  ).toBe('optional-profile');

  expect(
    resolveSignupResumeStage({
      isSignedIn: false,
      emailVerified: false,
      clerkStatus: 'missing_requirements',
      persistedStage: 'verify',
    }),
  ).toBe('verify');
});

test('optional fields can all be omitted and do not add empty values', () => {
  expect(sanitizeOptionalSignupProfile({})).toEqual({});
  expect(
    sanitizeOptionalSignupProfile({
      phone: '   ',
      country: '',
      cityOfOrigin: ' ',
      dateOfBirth: '',
      occupation: '',
    }),
  ).toEqual({});
});

test('valid optional profile values are trimmed and retained', () => {
  expect(
    sanitizeOptionalSignupProfile({
      country: ' Ghana ',
      cityOfOrigin: ' Accra ',
      dateOfBirth: '1992-03-14',
      occupation: ' Product designer ',
      phone: '+233 24 123 4567',
    }),
  ).toEqual({
    country: 'Ghana',
    cityOfOrigin: 'Accra',
    dateOfBirth: '1992-03-14',
    occupation: 'Product designer',
    phone: '+233 24 123 4567',
  });
});

test('malformed or invalid optional values are discarded independently', () => {
  expect(
    sanitizeOptionalSignupProfile({
      country: 'Nigeri@',
      cityOfOrigin: 'A'.repeat(101),
      dateOfBirth: '2023-02-30',
      occupation: 'Engineer / Analyst',
      phone: 'call me',
    }),
  ).toEqual({ occupation: 'Engineer / Analyst' });

  expect(
    sanitizeOptionalSignupProfile({
      dateOfBirth: '2999-01-01',
      phone: '+1 55',
    }),
  ).toEqual({});
});

test('step and optional profile draft survive refresh and clear after saving', () => {
  const storage = createStorage();
  persistSignupProgress('signup-123', 'optional-profile', storage);
  expect(readSignupProgress('signup-123', storage)).toBe('optional-profile');
  expect(readSignupProgress('signup-other', storage)).toBeNull();

  const draft = {
    emailAddress: 'member@example.test',
    firstName: 'Ada',
    lastName: 'Mensah',
    country: 'Ghana',
    cityOfOrigin: 'Accra',
    dateOfBirth: '1992-03-14',
    occupation: 'Product designer',
    phone: '+233 24 123 4567',
  };
  expect(persistSignupProfileDraft(draft, storage)).toBe(true);
  clearSignupProfileDraft();
  expect(readSignupProfileDraft(storage)).toEqual(draft);

  persistSignupProgress('signup-123', 'verify', storage);
  expect(readSignupProgress('signup-123', storage)).toBe('verify');
  clearSignupProgress('signup-123', storage);
  expect(readSignupProgress('signup-123', storage)).toBeNull();
  clearSignupProfileDraft(storage);
  expect(readSignupProfileDraft(storage)).toBeNull();
});

test('verification email is sent only after optional details are staged', async () => {
  const calls: string[] = [];
  const result = await sendEmailVerificationAfterOptionalDetails(
    () => {
      calls.push('persist-optional-details');
      return true;
    },
    async () => {
      calls.push('send-email-code');
      return { error: null };
    },
  );

  expect(result).toEqual({ ok: true, detailsRetained: true });
  expect(calls).toEqual(['persist-optional-details', 'send-email-code']);
});

test('verification code errors keep the user on a retryable step', async () => {
  const result = await verifyEmailCode(async () => ({
    error: { message: 'The code has expired.' },
  }));

  expect(result).toEqual({ ok: false, message: 'The code has expired.' });
});

test('clears the current local Clerk attempt and progress before retrying', async () => {
  const actions: string[] = [];
  const result = await clearLocalSignupAttempt(
    async () => {
      actions.push('reset-current-attempt');
      return { error: null };
    },
    () => actions.push('clear-progress'),
  );
  expect(result).toEqual({ ok: true });
  expect(actions).toEqual(['reset-current-attempt', 'clear-progress']);
});

test('keeps a failed reset retryable and reports a useful recovery path', async () => {
  const actions: string[] = [];
  const result = await clearLocalSignupAttempt(
    async () => ({ error: { message: 'Temporary Clerk error.' } }),
    () => actions.push('clear-progress'),
  );
  expect(result).toEqual({ ok: false, message: 'Temporary Clerk error.' });
  expect(actions).toEqual([]);
});

test('signup errors offer sign-in and recovery without revealing account existence', () => {
  const message = signupCreationErrorMessage({
    errors: [{ code: 'form_identifier_exists' }],
  });
  expect(message).toContain('signing in or use account recovery');
  expect(message).toContain('start over');
  expect(message).not.toContain('already registered');
});

test('successful finalization clears progress and navigates directly to the dashboard', async () => {
  const steps: string[] = [];
  const result = await finalizeSignupAndOpenDashboard(
    async () => {
      steps.push('finalize-clerk-session');
      return { error: null };
    },
    () => steps.push('clear-signup-step'),
    () => steps.push('open-dashboard'),
  );

  expect(result).toEqual({ ok: true });
  expect(steps).toEqual([
    'finalize-clerk-session',
    'clear-signup-step',
    'open-dashboard',
  ]);
});

test('failed Clerk finalization does not redirect to the dashboard', async () => {
  const navigations: string[] = [];
  const result = await finalizeSignupAndOpenDashboard(
    async () => ({ error: { message: 'Verification is incomplete.' } }),
    () => navigations.push('clear'),
    () => navigations.push('dashboard'),
  );

  expect(result).toEqual({
    ok: false,
    message: 'Verification is incomplete.',
  });
  expect(navigations).toEqual([]);
});

test('does not finalize a verified sign-up until Clerk has a created session', async () => {
  let finalizeCalled = false;
  const navigations: string[] = [];
  const result = await finalizeSignupWhenSessionReady(
    {
      status: 'missing_requirements',
      createdSessionId: null,
      missingFields: ['username'],
    },
    async () => {
      finalizeCalled = true;
      return { error: null };
    },
    () => navigations.push('clear'),
    () => navigations.push('dashboard'),
  );

  expect(result).toEqual({
    ok: false,
    message: 'Your email is verified, but Clerk still needs username. Review the required details to finish setting up your account.',
  });
  expect(finalizeCalled).toBe(false);
  expect(navigations).toEqual([]);
});

test('completed sign-up without a session gets an account recovery message', () => {
  const result = getSignupFinalizationBlocker({
    status: 'complete',
    createdSessionId: null,
    missingFields: [],
  });
  expect(result.ready).toBe(false);
  if (!result.ready) {
    expect(result.message).toContain('no sign-in session was created');
    expect(result.message).toContain('account recovery');
  }
});

test('identifies a Clerk phone requirement without silently making phone auth part of signup', () => {
  const result = getSignupFinalizationBlocker({
    status: 'missing_requirements',
    createdSessionId: null,
    missingFields: ['phone_number'],
  });
  expect(result.ready).toBe(false);
  if (!result.ready) {
    expect(result.message).toContain('phone number');
    expect(result.message).toContain('Phone verification is not part of this sign-up flow');
    expect(result.message).toContain('account recovery');
  }
});

test('only a completed sign-up with a session can be finalized', () => {
  expect(
    getSignupFinalizationBlocker({
      status: 'complete',
      createdSessionId: 'sess_created_123',
      missingFields: [],
    }),
  ).toEqual({ ready: true });
});

test('profile persistence errors never block a verified session and retain the draft', async () => {
  const storage = createStorage();
  const draft = {
    emailAddress: 'member@example.test',
    firstName: 'Ada',
    lastName: 'Mensah',
    cityOfOrigin: 'Accra',
  };
  persistSignupProfileDraft(draft, storage);
  clearSignupProfileDraft();

  const saved = await saveSignupProfileWithoutBlocking(async () => {
    throw new Error('database unavailable');
  });

  expect(saved).toBe(false);
  expect(readSignupProfileDraft(storage)).toEqual(draft);
});

test('signed-in customers resume directly at their dashboard', () => {
  expect(
    resolveSignupResumeStage({
      isSignedIn: true,
      emailVerified: true,
      clerkStatus: 'complete',
      persistedStage: 'verify',
    }),
  ).toBe('dashboard');
});
