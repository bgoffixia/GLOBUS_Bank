import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useClerk, useSignIn, useSignUp, useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetBankDashboardQueryKey, getGetBankProfileQueryKey, useCompleteRequiredPasswordReset, useGetBankProfile, useLookupCustomerId, useUpdateBankProfile } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { authFailureMessage, signInNextStep } from '../lib/auth-errors';
import {
  clearSignupProgress,
  buildBankProfileInput,
  finalizeSignupAndSaveProfile,
  getProfileCompletionError,
  isBankProfileComplete,
  persistSignupProgress,
  readSignupProgress,
  resolveSignupResumeStage,
  verifyEmailCodeAndContinue,
} from '../lib/signup-flow';
import {
  getUsernameRecoveryNextStep,
  parseRecoveryLookup,
  supportsEmailCodeRecovery,
  validateSignInCredentials,
  type SignInValidationField,
} from '../lib/sign-in-validation';
import './auth-pages.css';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const asset = (file: string) => `${basePath}/${file}`;

type ClerkRuntimeSignInSettings = {
  loaded?: boolean;
  environment?: {
    userSettings?: {
      attributes?: Partial<Record<
        'email_address' | 'username' | 'password' | 'phone_number',
        { enabled: boolean; first_factors?: string[]; verifications?: string[] }
      >>;
      usernameSettings?: { min_length?: number; max_length?: number };
    };
  };
};

type AuthFrameProps = {
  mode: 'sign-in' | 'sign-up';
  children: ReactNode;
};

export function AuthFrame({ mode, children }: AuthFrameProps) {
  const isSignUp = mode === 'sign-up';

  return (
    <main className={`gb-auth-shell ${isSignUp ? 'gb-auth-signup-shell' : 'gb-auth-signin-shell'}`}>
      <aside className="gb-brand-panel">
        <div className="gb-brand-lockup">
          <span className="gb-mark-wrap">
            <img src={asset('globus-mark-transparent.png')} alt="" className="gb-mark" />
          </span>
          <span className="gb-wordmark-wrap">
            <img src={asset('globus-wordmark-transparent.png')} alt="Globus Bank" className="gb-wordmark" />
          </span>
        </div>
        <div className="gb-brand-copy">
          <span className="gb-eyebrow">A clearer view of your money</span>
          <h2>{isSignUp ? <>Begin with<br />a better view.</> : <>Your world.<br />In one place.</>}</h2>
          <p>
            {isSignUp
              ? 'Create your member account and bring your Globus activity into focus.'
              : 'Access your accounts, follow your balances, and move money with clarity.'}
          </p>
        </div>
        <div className="gb-world-art" aria-hidden="true">
          <span className="gb-orbit gb-orbit-one" />
          <span className="gb-orbit gb-orbit-two" />
          <span className="gb-orbit-dot" />
          <span className="gb-world-label">GLOBAL FINANCE</span>
        </div>
        <div className="gb-panel-foot">
          <span>GLOBUS BANK</span>
          <span>YOUR WORLD. OUR PRIORITY.</span>
        </div>
      </aside>

      <section className="gb-form-side">
        <div className={`gb-auth-content ${isSignUp ? 'gb-signup-content' : ''}`}>
          <div className={`gb-signup-brand${isSignUp ? '' : ' gb-signin-brand'}`}>
            <img src={asset('globus-wordmark-transparent.png')} alt="Globus Bank" />
          </div>
          {children}
          <div className="gb-signup-footer">
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
              <rect x="3.25" y="7" width="9.5" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
              <path d="M5.25 7V4.9a2.75 2.75 0 0 1 5.5 0V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span>Secured by Clerk</span>
          </div>
        </div>
      </section>
    </main>
  );
}

export function ClerkSignInForm() {
  const [, setLocation] = useLocation();
  const clerk = (window as Window & { Clerk?: ClerkRuntimeSignInSettings }).Clerk;
  const { signIn, fetchStatus } = useSignIn();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationFactor, setVerificationFactor] = useState<
    'first_email_code' | 'email_code' | 'phone_code' | 'totp' | 'backup_code' | null
  >(null);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<SignInValidationField | null>(null);
  const userSettings = clerk?.environment?.userSettings;
  const usernameIdentifierEnabled = userSettings?.attributes?.username?.enabled === true;
  const passwordSignInEnabled = userSettings?.attributes?.password?.enabled === true;
  const usernameMinLength = userSettings?.usernameSettings?.min_length ?? 1;
  const usernameMaxLength = userSettings?.usernameSettings?.max_length ?? 64;
  const busy = fetchStatus === 'fetching';
  const showFormUnavailable = !clerk?.loaded
    ? 'Loading secure sign-in options…'
    : !userSettings
      ? 'Secure sign-in options could not be loaded. Reload this page to try again.'
      : !usernameIdentifierEnabled
        ? 'Username sign-in is not enabled for this Clerk account.'
        : !passwordSignInEnabled
          ? 'Password sign-in is not enabled for this Clerk account.'
          : '';

  const clearFormError = () => {
    setError('');
    setErrorField(null);
  };

  const showFormError = (message: string, field: SignInValidationField | null = null) => {
    setError(message);
    setErrorField(field);
  };

  const finishSignIn = async () => {
    const finalized = await signIn.finalize({ navigate: () => undefined });
    if (finalized.error) {
      setError(authFailureMessage(finalized.error, 'sign-in'));
      return;
    }
    setLocation('/dashboard');
  };

  const startAdditionalVerification = async (): Promise<boolean> => {
    let factor: typeof verificationFactor = null;
    if (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') {
      const available = new Set(signIn.supportedSecondFactors.map(item => item.strategy));
      factor = (['email_code', 'phone_code', 'totp', 'backup_code'] as const)
        .find(strategy => available.has(strategy)) ?? null;
    } else if (
      signIn.status === 'needs_first_factor' &&
      signIn.supportedFirstFactors.some(item => item.strategy === 'email_code')
    ) {
      factor = 'first_email_code';
    }

    if (!factor) return false;

    let result: { error: unknown | null };
    if (factor === 'first_email_code') {
      result = await signIn.emailCode.sendCode();
    } else if (factor === 'email_code') {
      result = await signIn.mfa.sendEmailCode();
    } else if (factor === 'phone_code') {
      result = await signIn.mfa.sendPhoneCode();
    } else {
      result = { error: null };
    }
    if (result.error) {
      setError(authFailureMessage(result.error, 'verification'));
      return true;
    }

    setVerificationCode('');
    setVerificationFactor(factor);
    setError('');
    return true;
  };

  const continueSignIn = async (error: unknown, phase: 'sign-in' | 'verification') => {
    switch (signInNextStep(signIn.status, error)) {
      case 'error':
        setError(authFailureMessage(error, phase));
        return;
      case 'complete':
        await finishSignIn();
        return;
      case 'password-update':
        setError('This account needs a password update. Use Forgot password to choose a new password.');
        return;
      case 'verification':
        if (!(await startAdditionalVerification())) {
          setError('Your account requires an additional sign-in method that this page cannot complete. Contact Globus support.');
        }
        return;
      default:
        setError('Sign-in needs another verification step. Please contact Globus support.');
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateSignInCredentials({
      username,
      password,
      usernameMinLength,
      usernameMaxLength,
    });
    if (validationError) {
      showFormError(validationError.message, validationError.field);
      const focusTarget = validationError.field === 'password'
        ? 'gb-signin-password'
        : 'gb-signin-username';
      requestAnimationFrame(() => document.getElementById(focusTarget)?.focus());
      return;
    }
    clearFormError();
    try {
      const result = await signIn.password({
        identifier: username.trim(),
        password,
      });
      await continueSignIn(result.error, 'sign-in');
    } catch (error) {
      setError(authFailureMessage(error, 'sign-in'));
    }
  };

  const submitVerificationCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!verificationFactor || !verificationCode.trim()) return;
    clearFormError();
    try {
      let result: { error: unknown | null };
      if (verificationFactor === 'first_email_code') {
        result = await signIn.emailCode.verifyCode({ code: verificationCode.trim() });
      } else if (verificationFactor === 'email_code') {
        result = await signIn.mfa.verifyEmailCode({ code: verificationCode.trim() });
      } else if (verificationFactor === 'phone_code') {
        result = await signIn.mfa.verifyPhoneCode({ code: verificationCode.trim() });
      } else if (verificationFactor === 'totp') {
        result = await signIn.mfa.verifyTOTP({ code: verificationCode.trim() });
      } else {
        result = await signIn.mfa.verifyBackupCode({ code: verificationCode.trim() });
      }
      await continueSignIn(result.error, 'verification');
    } catch (error) {
      setError(authFailureMessage(error, 'verification'));
    }
  };

  return (
    <div className="gb-signin-form-wrap">
      <div className="gb-form-heading gb-signin-heading">
        <h1>Welcome back</h1>
        <p>Sign in with your username and password.</p>
      </div>
      {verificationFactor ? (
        <form className="gb-auth-form" onSubmit={submitVerificationCode}>
          <p className="gb-switch-copy">
            {verificationFactor === 'first_email_code' || verificationFactor === 'email_code'
              ? 'Enter the verification code sent to your email.'
              : verificationFactor === 'phone_code'
                ? 'Enter the verification code sent to your phone.'
                : verificationFactor === 'totp'
                  ? 'Enter the code from your authenticator app.'
                  : 'Enter one of your backup codes.'}
          </p>
          <label className="gb-field-label" htmlFor="gb-signin-verification-code">Verification code</label>
          <input
            id="gb-signin-verification-code"
            className="gb-input"
            type="text"
            autoComplete="one-time-code"
            inputMode={verificationFactor === 'backup_code' ? 'text' : 'numeric'}
            value={verificationCode}
            onChange={event => setVerificationCode(event.target.value)}
            required
          />
          {error && <p role="alert" className="gb-auth-error">{error}</p>}
          <button className="gb-primary-button" type="submit" disabled={busy || !verificationCode.trim()}>
            <span>{busy ? 'Verifying…' : 'Verify & sign in'}</span>
            <span aria-hidden="true">→</span>
          </button>
          <button
            className="gb-login-recovery-action mt-3"
            type="button"
            onClick={() => {
              void signIn.reset().catch(() => undefined);
              setVerificationFactor(null);
              setVerificationCode('');
              clearFormError();
            }}
          >
            Back to sign in
          </button>
        </form>
      ) : (
        showFormUnavailable ? (
          <p role="status" className="gb-auth-notice">{showFormUnavailable}</p>
        ) : (
          <form className="gb-auth-form" noValidate onSubmit={submit}>
            <div className="gb-field">
              <label className="gb-field-label" htmlFor="gb-signin-username">Username</label>
              <input
                id="gb-signin-username"
                className="gb-input"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                minLength={usernameMinLength}
                maxLength={usernameMaxLength}
                value={username}
                aria-invalid={errorField === 'username' ? true : undefined}
                aria-describedby={errorField === 'username' ? 'gb-signin-field-error' : undefined}
                onChange={event => {
                  clearFormError();
                  setUsername(event.target.value);
                }}
                required
              />
              {error && errorField === 'username' && (
                <p id="gb-signin-field-error" role="alert" className="gb-auth-error gb-signin-field-error">{error}</p>
              )}
            </div>
            <div className="gb-field">
              <label className="gb-field-label" htmlFor="gb-signin-password">Password</label>
              <input
                id="gb-signin-password"
                className="gb-input"
                type="password"
                autoComplete="current-password"
                value={password}
                aria-invalid={errorField === 'password' ? true : undefined}
                aria-describedby={errorField === 'password' ? 'gb-signin-field-error' : undefined}
                onChange={event => {
                  clearFormError();
                  setPassword(event.target.value);
                }}
                required
              />
              {error && errorField === 'password' && (
                <p id="gb-signin-field-error" role="alert" className="gb-auth-error gb-signin-field-error">{error}</p>
              )}
            </div>
            {error && !errorField && <p role="alert" className="gb-auth-error">{error}</p>}
            <button className="gb-primary-button" type="submit" disabled={busy}>
              <span>{busy ? 'Signing in…' : 'Sign in'}</span>
              <span aria-hidden="true">→</span>
            </button>
          </form>
        )
      )}
      <p className="gb-recovery-link">
        <Link href="/sign-in/email">Forgot username or password?</Link>
      </p>
      <p className="gb-switch-copy">New to Globus? <Link href="/sign-up">Create an account</Link></p>
    </div>
  );
}

export function EmailRecoverySignInForm() {
  const [, setLocation] = useLocation();
  const { signIn, fetchStatus } = useSignIn();
  const clerk = (window as Window & { Clerk?: ClerkRuntimeSignInSettings }).Clerk;
  const { isLoaded: userLoaded, user } = useUser();
  const lookupCustomerId = useLookupCustomerId();
  const profile = useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey(), enabled: false } });
  const [lookup, setLookup] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [stage, setStage] = useState<
    'lookup' | 'code' | 'username-factor' | 'username-revealed' | 'password' | 'complete'
  >('lookup');
  const [recoveryType, setRecoveryType] = useState<'password' | 'username'>('password');
  const [usernameFactor, setUsernameFactor] = useState<
    'email_code' | 'phone_code' | 'totp' | 'backup_code' | null
  >(null);
  const [hasRecoveryAttempt, setHasRecoveryAttempt] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const emailSettings = clerk?.environment?.userSettings?.attributes?.email_address;
  const emailCodeRecoveryAvailable = supportsEmailCodeRecovery(
    emailSettings?.enabled === true,
    emailSettings?.first_factors,
    emailSettings?.verifications,
  );
  const busy = fetchStatus === 'fetching' || lookupCustomerId.isPending;
  const genericRecoveryNotice = 'If the details match an account, a verification code was sent to its email.';

  const sendRecoveryCode = async (startNewAttempt: boolean): Promise<boolean> => {
    setError('');
    setNotice(genericRecoveryNotice);
    setVerificationCode('');
    if (recoveryType === 'username' && !emailCodeRecoveryAvailable) {
      setError('Username recovery is unavailable because email-code verification is not enabled.');
      return false;
    }

    if (startNewAttempt) {
      const parsedLookup = parseRecoveryLookup(lookup);
      if (!parsedLookup) {
        setError('Enter an email address or a seven-character Customer ID.');
        return false;
      }
      await signIn.reset().catch(() => undefined);
      setHasRecoveryAttempt(false);
      setCustomerId(parsedLookup.type === 'customerId' ? parsedLookup.customerId : '');
      let recoveryEmail: string;
      try {
        recoveryEmail = parsedLookup.type === 'customerId'
          ? (await lookupCustomerId.mutateAsync({
              data: { customerId: parsedLookup.customerId },
            })).email
          : parsedLookup.email;
      } catch {
        setStage('code');
        return true;
      }

      let created: Awaited<ReturnType<typeof signIn.create>>;
      try {
        created = await signIn.create({ identifier: recoveryEmail });
      } catch {
        setStage('code');
        return true;
      }
      if (created.error) {
        setStage('code');
        return true;
      }
    } else if (!hasRecoveryAttempt) {
      return sendRecoveryCode(true);
    }

    try {
      const sent = recoveryType === 'username'
        ? await signIn.emailCode.sendCode()
        : await signIn.resetPasswordEmailCode.sendCode();
      if (sent.error) {
        setHasRecoveryAttempt(false);
        setStage('code');
        return true;
      }
      setHasRecoveryAttempt(true);
    } catch {
      setHasRecoveryAttempt(false);
      setStage('code');
    }
    return true;
  };

  const requestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await sendRecoveryCode(true)) setStage('code');
  };

  const resendCode = async () => {
    await sendRecoveryCode(false);
  };

  const changeRecoveryLookup = async () => {
    await signIn.reset().catch(() => undefined);
    setStage('lookup');
    setHasRecoveryAttempt(false);
    setUsernameFactor(null);
    setError('');
    setNotice('');
    setVerificationCode('');
  };

  const finishUsernameRecovery = async () => {
    const finalized = await signIn.finalize({ navigate: () => undefined });
    if (finalized.error) {
      setError(authFailureMessage(finalized.error, 'verification'));
      return;
    }
    setHasRecoveryAttempt(false);
    setStage('username-revealed');
    setNotice('');
  };

  const continueUsernameRecovery = async (verificationError: unknown) => {
    const nextStep = getUsernameRecoveryNextStep(signIn.status, Boolean(verificationError));
    if (nextStep === 'blocked' && verificationError) {
      setError(authFailureMessage(verificationError, 'verification'));
      return;
    }
    if (nextStep === 'reveal-username') {
      await finishUsernameRecovery();
      return;
    }
    if (nextStep === 'verify-second-factor') {
      const available = new Set((signIn.supportedSecondFactors ?? []).map(factor => factor.strategy));
      const factor = (['email_code', 'phone_code', 'totp', 'backup_code'] as const)
        .find(strategy => available.has(strategy));
      if (!factor) {
        setError('This account needs another sign-in method before its username can be shown. Contact Globus support.');
        return;
      }
      const prepared = factor === 'email_code'
        ? await signIn.mfa.sendEmailCode()
        : factor === 'phone_code'
          ? await signIn.mfa.sendPhoneCode()
          : { error: null };
      if (prepared.error) {
        setError(authFailureMessage(prepared.error, 'verification'));
        return;
      }
      setUsernameFactor(factor);
      setVerificationCode('');
      setStage('username-factor');
      setNotice('Enter the additional code to continue.');
      return;
    }
    setError('The email was verified, but another sign-in step is required. Try your username and password or contact Globus support.');
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!hasRecoveryAttempt) {
      setError('No code request is active. Enter your email or Customer ID and request a new code.');
      return;
    }
    try {
      if (recoveryType === 'username') {
        const verified = await signIn.emailCode.verifyCode({ code: verificationCode.trim() });
        await continueUsernameRecovery(verified.error);
      } else {
        const verified = await signIn.resetPasswordEmailCode.verifyCode({
          code: verificationCode.trim(),
        });
        if (verified.error) {
          setError(authFailureMessage(verified.error, 'verification'));
          return;
        }
        if (signIn.status !== 'needs_new_password') {
          setError('Recovery needs another verification step. Request a fresh code or contact Globus support.');
          return;
        }
        setStage('password');
        setNotice('');
      }
    } catch (error) {
      setError(authFailureMessage(error, 'verification'));
    }
  };

  const verifyUsernameFactor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!usernameFactor || !verificationCode.trim()) return;
    setError('');
    try {
      let result: { error: unknown | null };
      if (usernameFactor === 'email_code') {
        result = await signIn.mfa.verifyEmailCode({ code: verificationCode.trim() });
      } else if (usernameFactor === 'phone_code') {
        result = await signIn.mfa.verifyPhoneCode({ code: verificationCode.trim() });
      } else if (usernameFactor === 'totp') {
        result = await signIn.mfa.verifyTOTP({ code: verificationCode.trim() });
      } else {
        result = await signIn.mfa.verifyBackupCode({ code: verificationCode.trim() });
      }
      await continueUsernameRecovery(result.error);
    } catch (error) {
      setError(authFailureMessage(error, 'verification'));
    }
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      const reset = await signIn.resetPasswordEmailCode.submitPassword({ password: newPassword });
      if (reset.error) {
        setError(authFailureMessage(reset.error, 'reset-password'));
        return;
      }
      if (signIn.status !== 'complete') {
        setError('Your account requires another verification step before recovery can finish. Contact Globus support.');
        return;
      }
      const finalized = await signIn.finalize({ navigate: () => undefined });
      if (finalized.error) {
        setError(authFailureMessage(finalized.error, 'reset-password'));
        return;
      }
      const memberProfile = await profile.refetch();
      setCustomerId(memberProfile.data?.customerId ?? '');
      setStage('complete');
    } catch (error) {
      setError(authFailureMessage(error, 'reset-password'));
    }
  };

  return (
    <div className="gb-signin-form-wrap">
      <div className="gb-form-heading">
        <span className="gb-step-label">ACCOUNT RECOVERY <i /></span>
        <h1>
          {stage === 'lookup' && (recoveryType === 'password' ? 'Reset your password' : 'Recover your username')}
          {stage === 'code' && 'Check your email'}
          {stage === 'username-factor' && 'Verify it’s you'}
          {stage === 'username-revealed' && 'Username recovered'}
          {stage === 'password' && 'Choose a new password'}
          {stage === 'complete' && 'Recovery complete'}
        </h1>
        <p>
          {stage === 'lookup' && recoveryType === 'password' && 'Use your email or Customer ID.'}
          {stage === 'lookup' && recoveryType === 'username' && 'Verify your email to view your username. This also signs you in.'}
          {stage === 'code' && recoveryType === 'username' && 'Enter the email code to view your username.'}
          {stage === 'code' && recoveryType === 'password' && 'Enter the code to reset your password.'}
          {stage === 'username-factor' && 'Complete the additional sign-in check.'}
          {stage === 'username-revealed' && 'Your email is verified. Your username is below.'}
          {stage === 'password' && 'Set a new password for your Globus account.'}
          {stage === 'complete' && 'Your password has been reset.'}
        </p>
      </div>
      {stage === 'lookup' && (
        <form className="gb-auth-form" onSubmit={requestCode}>
          <div className="gb-recovery-type" role="group" aria-label="Recovery type">
            <button
              type="button"
              aria-pressed={recoveryType === 'password'}
              className={recoveryType === 'password' ? 'is-active' : ''}
              onClick={() => { setRecoveryType('password'); setError(''); }}
            >
              Password
            </button>
            <button
              type="button"
              aria-pressed={recoveryType === 'username'}
              className={recoveryType === 'username' ? 'is-active' : ''}
              disabled={!emailCodeRecoveryAvailable}
              onClick={() => { setRecoveryType('username'); setError(''); }}
            >
              Username
            </button>
          </div>
          <label className="gb-field-label" htmlFor="gb-recovery-lookup">Email or Customer ID</label>
          <input
            id="gb-recovery-lookup"
            className="gb-input"
            type="text"
            autoComplete="email"
            maxLength={254}
            placeholder="Email or 7-character Customer ID"
            value={lookup}
            onChange={event => { setLookup(event.target.value); setError(''); }}
            required
          />
          {error && <p role="alert" className="gb-auth-error">{error}</p>}
          <button className="gb-primary-button" type="submit" disabled={busy || !lookup.trim()}>
            <span>{busy ? 'Sending code…' : 'Continue'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>
      )}
      {stage === 'code' && (
        <form className="gb-auth-form" onSubmit={verifyCode}>
          <label className="gb-field-label" htmlFor="gb-recovery-code">Recovery code</label>
          <input id="gb-recovery-code" className="gb-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={verificationCode} onChange={event => setVerificationCode(event.target.value.trim())} required />
          {notice && <p className="gb-auth-notice" role="status">{notice}</p>}
          {error && <p role="alert" className="gb-auth-error">{error}</p>}
          <button className="gb-primary-button" type="submit" disabled={busy || !verificationCode.trim()}>
            <span>{busy ? 'Verifying…' : 'Verify code'}</span>
            <span aria-hidden="true">→</span>
          </button>
          <button className="gb-recovery-secondary" type="button" disabled={busy} onClick={resendCode}>
            Send another code
          </button>
          <button className="gb-recovery-secondary" type="button" disabled={busy} onClick={changeRecoveryLookup}>
            Use different details
          </button>
        </form>
      )}
      {stage === 'username-factor' && (
        <form className="gb-auth-form" onSubmit={verifyUsernameFactor}>
          <label className="gb-field-label" htmlFor="gb-username-recovery-factor">Verification code</label>
          <input
            id="gb-username-recovery-factor"
            className="gb-input"
            type="text"
            inputMode={usernameFactor === 'backup_code' ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            value={verificationCode}
            onChange={event => setVerificationCode(event.target.value.trim())}
            required
          />
          {notice && <p className="gb-auth-notice" role="status">{notice}</p>}
          {error && <p role="alert" className="gb-auth-error">{error}</p>}
          <button className="gb-primary-button" type="submit" disabled={busy || !verificationCode.trim()}>
            <span>{busy ? 'Verifying…' : 'Verify code'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>
      )}
      {stage === 'username-revealed' && (
        <div className="gb-auth-form">
          {userLoaded && user?.username ? (
            <>
              <label className="gb-field-label" htmlFor="gb-recovered-username">Your username</label>
              <output id="gb-recovered-username" className="gb-input">{user.username}</output>
              <button className="gb-primary-button" type="button" onClick={() => setLocation('/dashboard')}>
                <span>Continue to your account</span>
                <span aria-hidden="true">→</span>
              </button>
            </>
          ) : userLoaded ? (
            <>
              <p role="alert" className="gb-auth-error">Your email is verified, but no username is set on this account.</p>
              <button className="gb-primary-button" type="button" onClick={() => setLocation('/profile')}>
                <span>Open your profile</span>
                <span aria-hidden="true">→</span>
              </button>
            </>
          ) : (
            <p role="status" className="gb-auth-notice">Loading your verified account…</p>
          )}
        </div>
      )}
      {stage === 'password' && (
        <form className="gb-auth-form" onSubmit={resetPassword}>
          <label className="gb-field-label" htmlFor="gb-new-password">New password</label>
          <input id="gb-new-password" className="gb-input" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} required />
          <p className="gb-password-hint">Use at least 8 characters. Additional security rules are checked securely by Clerk.</p>
          {error && <p role="alert" className="gb-auth-error">{error}</p>}
          <button className="gb-primary-button" type="submit" disabled={busy || newPassword.length < 8}>
            <span>{busy ? 'Resetting password…' : 'Reset password'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>
      )}
      {stage === 'complete' && (
        <div className="gb-auth-form">
          {customerId ? (
            <>
              <label className="gb-field-label" htmlFor="gb-recovered-customer-id">Your Customer ID</label>
              <output id="gb-recovered-customer-id" className="gb-input gb-recovered-customer-id">{customerId}</output>
            </>
          ) : (
            <p className="gb-switch-copy">Your password is reset. Sign in to view your Customer ID on your Profile page.</p>
          )}
          <button className="gb-primary-button" type="button" onClick={() => setLocation(customerId ? '/dashboard' : '/profile')}>
            <span>{customerId ? 'Continue to your account' : 'Open Profile'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
      {stage !== 'username-revealed' && (
        <p className="gb-switch-copy"><Link href="/sign-in">Back to sign in</Link></p>
      )}
    </div>
  );
}

export function PasswordResetLinkPage() {
  const [, setLocation] = useLocation();
  const { signIn } = useSignIn();
  const { isLoaded, user } = useUser();
  const { signOut } = useClerk();
  const started = useRef(false);
  const [message, setMessage] = useState('Checking your secure recovery link…');
  const [error, setError] = useState('');

  useEffect(() => {
    const ticket = new URLSearchParams(window.location.hash.slice(1)).get('ticket');
    if (!isLoaded || started.current) return;
    if (!ticket) {
      setMessage('');
      setError('This recovery link is missing or incomplete. Request a new password recovery email.');
      return;
    }
    started.current = true;

    if (user) {
      void signOut({ redirectUrl: window.location.href }).catch(() => {
        setMessage('');
        setError('Sign out of the current account, then open this recovery link again.');
      });
      return;
    }

    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    );

    void (async () => {
      try {
        const ticketResult = await signIn.ticket({ ticket });
        if (ticketResult.error || signIn.status !== 'complete') {
          setMessage('');
          setError('This recovery link is invalid, expired, or already used. Request a new password recovery email.');
          return;
        }

        const finalized = await signIn.finalize({
          navigate: () => setLocation('/dashboard'),
        });
        if (finalized.error) {
          setMessage('');
          setError('This recovery link could not be completed. Request a new password recovery email.');
        }
      } catch {
        setMessage('');
        setError('This recovery link is invalid, expired, or already used. Request a new password recovery email.');
      }
    })();
  }, [isLoaded, setLocation, signIn, signOut, user]);

  return (
    <AuthFrame mode="sign-in">
      <div className="gb-signin-form-wrap">
        <div className="gb-form-heading">
          <span className="gb-step-label">PASSWORD RECOVERY <i /></span>
          <h1>{error ? 'Recovery link unavailable' : 'Secure password recovery'}</h1>
          <p>{error || message}</p>
        </div>
        {error && (
          <div className="gb-auth-form">
            <Link className="gb-primary-button" href="/sign-in/email">
              <span>Request a recovery email</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
        <p className="gb-switch-copy"><Link href="/sign-in">Back to sign in</Link></p>
      </div>
    </AuthFrame>
  );
}

export function RequiredPasswordResetPage() {
  const { signOut } = useClerk();
  const completeRequiredReset = useCompleteRequiredPasswordReset();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = completeRequiredReset.isPending;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (newPassword.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    try {
      const result = await completeRequiredReset.mutateAsync({ data: { newPassword } });
      if (!result.completed) {
        setError('This reset request is no longer active. Sign in again or use Forgot password.');
        return;
      }
      setNotice('Your password is updated. Sign in again with your new password.');
      await signOut({ redirectUrl: `${basePath}/sign-in` || '/sign-in' });
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Password could not be updated. Try another password.');
    }
  };

  const openRecovery = async () => {
    await signOut({ redirectUrl: `${basePath}/sign-in/email` || '/sign-in/email' });
  };

  return (
    <AuthFrame mode="sign-in">
      <div className="gb-signin-form-wrap">
        <div className="gb-form-heading">
          <span className="gb-step-label">ACCOUNT SECURITY <i /></span>
          <h1>Choose a new password</h1>
          <p>An administrator required a password update. Set a new password to continue; all previous sessions have been ended.</p>
        </div>
        <form className="gb-auth-form" onSubmit={submit}>
          <label className="gb-field-label" htmlFor="gb-required-new-password">New password</label>
          <input
            id="gb-required-new-password"
            className="gb-input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
            required
          />
          <label className="gb-field-label" htmlFor="gb-required-confirm-password">Confirm new password</label>
          <input
            id="gb-required-confirm-password"
            className="gb-input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            value={confirmPassword}
            onChange={event => setConfirmPassword(event.target.value)}
            required
          />
          <p className="gb-password-hint">Use at least 8 characters. Clerk checks any additional password requirements.</p>
          {error && <p role="alert" className="gb-auth-error">{error}</p>}
          {notice && <p role="status" className="gb-auth-notice">{notice}</p>}
          <button className="gb-primary-button" type="submit" disabled={busy || newPassword.length < 8 || confirmPassword.length < 8}>
            <span>{busy ? 'Updating password…' : 'Update password'}</span>
            <span aria-hidden="true">→</span>
          </button>
          <button className="gb-recovery-secondary" type="button" disabled={busy} onClick={openRecovery}>
            Forgot your current password? Get a recovery email
          </button>
        </form>
      </div>
    </AuthFrame>
  );
}

type SignUpStage = 'details' | 'verify' | 'profile' | 'finishing';

export function ClerkSignUpForm() {
  const [, setLocation] = useLocation();
  const { signUp, fetchStatus } = useSignUp();
  const { isLoaded: userLoaded, user } = useUser();
  const queryClient = useQueryClient();
  const profileQuery = useGetBankProfile({
    query: {
      queryKey: getGetBankProfileQueryKey(),
      enabled: userLoaded && Boolean(user),
    },
  });
  const updateProfile = useUpdateBankProfile();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showIdentityFields, setShowIdentityFields] = useState(false);
  const [stage, setStage] = useState<SignUpStage>(() => {
    const emailVerified = signUp.verifications.emailAddress.status === 'verified';
    const resumeStage = resolveSignupResumeStage({
      isSignedIn: Boolean(user),
      profileComplete: false,
      emailVerified,
      clerkStatus: signUp.status,
      persistedStage: readSignupProgress(signUp.id),
    });
    return resumeStage === 'dashboard' ? 'profile' : resumeStage;
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const finalizedSignupRef = useRef(false);

  const busy = fetchStatus === 'fetching' || updateProfile.isPending || stage === 'finishing';
  const clerkFields = [...signUp.requiredFields, ...signUp.optionalFields];
  const clerkSupportsFirstName = clerkFields.includes('first_name');
  const clerkSupportsLastName = clerkFields.includes('last_name');

  useEffect(() => {
    if (signUp.id) {
      setFirstName((current) => current || signUp.firstName || '');
      setLastName((current) => current || signUp.lastName || '');
      setUsername((current) => current || signUp.username || '');
      setEmail((current) => current || signUp.emailAddress || '');
    }
  }, [signUp.id, signUp.firstName, signUp.lastName, signUp.username, signUp.emailAddress]);

  useEffect(() => {
    const emailVerified = signUp.verifications.emailAddress.status === 'verified';
    const persistedStage = readSignupProgress(signUp.id);

    if (user) {
      const profile = profileQuery.data;
      setFirstName((current) => current || profile?.firstName || user.firstName || '');
      setLastName((current) => current || profile?.lastName || user.lastName || '');
      setPhone((current) => current || profile?.phone || '');
      setCountry((current) => current || profile?.country || '');
      setDateOfBirth((current) => current || profile?.dateOfBirth || '');
      setShowIdentityFields(
        !((profile?.firstName || user.firstName) && (profile?.lastName || user.lastName)),
      );

      if (profileQuery.isSuccess && isBankProfileComplete(profile)) {
        clearSignupProgress(signUp.id);
        setLocation('/dashboard', { replace: true });
        return;
      }

      setStage('profile');
      if (profileQuery.isError) {
        setError('Your account is signed in, but its saved profile could not be loaded. Enter the required details below and select Continue to retry saving.');
      }
      return;
    }

    const resumeStage = resolveSignupResumeStage({
      isSignedIn: false,
      profileComplete: false,
      emailVerified,
      clerkStatus: signUp.status,
      persistedStage,
    });
    if (resumeStage === 'profile' || resumeStage === 'verify') {
      setFirstName((current) => current || signUp.firstName || '');
      setLastName((current) => current || signUp.lastName || '');
      setUsername((current) => current || signUp.username || '');
      setEmail((current) => current || signUp.emailAddress || '');
      if (resumeStage === 'profile' && (!signUp.firstName || !signUp.lastName)) {
        setShowIdentityFields(true);
      }
      setStage(resumeStage);
    }
  }, [
    user,
    profileQuery.data,
    profileQuery.isError,
    profileQuery.isSuccess,
    signUp.id,
    signUp.status,
    signUp.verifications.emailAddress.status,
    signUp.firstName,
    signUp.lastName,
    signUp.username,
    signUp.emailAddress,
    setLocation,
  ]);

  const saveBankProfile = async () => {
    setError('');
    setNotice('');
    const result = await finalizeSignupAndSaveProfile(
      async () => {
        if (user || finalizedSignupRef.current) {
          return { error: null };
        }

        if (signUp.missingFields.includes('legal_accepted') && acceptedTerms) {
          const acceptance = await signUp.update({ legalAccepted: true });
          if (acceptance.error) {
            return acceptance;
          }
        }

        const finalized = await signUp.finalize({ navigate: () => undefined });
        if (!finalized.error) {
          finalizedSignupRef.current = true;
        }
        return finalized;
      },
      () => updateProfile.mutateAsync({
        data: buildBankProfileInput({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          country: country.trim(),
          dateOfBirth,
        }),
      }),
    );

    if (!result.ok) {
      setStage('profile');
      setError(result.message);
      return;
    }

    clearSignupProgress(signUp.id);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetBankProfileQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() }),
    ]);
    setLocation('/dashboard', { replace: true });
  };

  const finishSignUp = async () => {
    setStage('finishing');
    setError('');
    await saveBankProfile();
  };

  const completeProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    const validationError = getProfileCompletionError({
      firstName,
      lastName,
      phone,
      country,
      dateOfBirth,
      acceptedTerms,
    });
    if (validationError) {
      if (!firstName.trim() || !lastName.trim()) {
        setShowIdentityFields(true);
      }
      setStage('profile');
      setError(validationError);
      return;
    }

    await finishSignUp();
  };

  const startSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter both your first name and last name, as required by Globus account setup.');
      return;
    }
    if (!/^(?=.*[A-Za-z])[A-Za-z0-9_-]{6,12}$/.test(username)) {
      setError('Choose a username with 6–12 letters, numbers, hyphens or underscores. It must include at least one letter.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Complete each required field before continuing.');
      return;
    }

    const created = await signUp.password({
      emailAddress: email.trim(),
      password,
      username: username.trim(),
      ...(clerkSupportsFirstName ? { firstName: firstName.trim() } : {}),
      ...(clerkSupportsLastName ? { lastName: lastName.trim() } : {}),
    });
    if (created.error) {
      setError(created.error.message || 'Your account could not be created. Check your details and try again.');
      return;
    }

    if (signUp.status === 'complete') {
      persistSignupProgress(signUp.id, 'profile');
      setStage('profile');
      return;
    }

    const sent = await signUp.verifications.sendEmailCode();
    if (sent.error) {
      setError(sent.error.message || 'The email verification code could not be sent. Please try again.');
      return;
    }
    persistSignupProgress(signUp.id, 'verify');
    setStage('verify');
    setNotice(`Enter the verification code sent to ${email.trim()}.`);
  };

  const verifyEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const result = await verifyEmailCodeAndContinue(() =>
      signUp.verifications.verifyEmailCode({ code: verificationCode.trim() }),
    );
    if (!result.ok) {
      setError(result.message);
      return;
    }
    persistSignupProgress(signUp.id, 'profile');
    setStage('profile');
  };

  const resendCode = async () => {
    setError('');
    setNotice('');
    const sent = await signUp.verifications.sendEmailCode();
    if (sent.error) {
      setError(sent.error.message || 'A new code could not be sent. Please try again.');
      return;
    }
    setNotice(`A new verification code was sent to ${email.trim()}.`);
  };

  const changeEmail = async () => {
    clearSignupProgress(signUp.id);
    await signUp.reset();
    setVerificationCode('');
    setError('');
    setNotice('');
    setStage('details');
  };

  return (
    <div className="gb-signup-form-wrap">
      {stage === 'details' && (
        <>
          <div className="gb-form-heading gb-signup-heading">
            <span className="gb-step-label">GET STARTED <i /></span>
            <h1>Create your account</h1>
            <p>Enter your details to get started.</p>
          </div>
          <form className="gb-auth-form gb-signup-form" onSubmit={startSignUp}>
            <div className="gb-signup-fields">
              <div className="gb-field">
                <label className="gb-field-label" htmlFor="gb-signup-first-name">First name</label>
                <input id="gb-signup-first-name" data-testid="input-signup-first-name" className="gb-input" type="text" autoComplete="given-name" maxLength={80} value={firstName} onChange={event => setFirstName(event.target.value)} required />
              </div>
              <div className="gb-field">
                <label className="gb-field-label" htmlFor="gb-signup-last-name">Last name</label>
                <input id="gb-signup-last-name" data-testid="input-signup-last-name" className="gb-input" type="text" autoComplete="family-name" maxLength={80} value={lastName} onChange={event => setLastName(event.target.value)} required />
              </div>
              <div className="gb-field">
                <label className="gb-field-label" htmlFor="gb-signup-username">Username</label>
                <input id="gb-signup-username" data-testid="input-signup-username" className="gb-input" type="text" autoComplete="username" autoCapitalize="off" spellCheck={false} minLength={6} maxLength={12} pattern="(?=.*[A-Za-z])[A-Za-z0-9_-]{6,12}" value={username} onChange={event => setUsername(event.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12))} required />
                <p className="gb-password-hint">6–12 characters with a letter; letters, numbers, hyphens, underscores.</p>
              </div>
              <div className="gb-field">
                <label className="gb-field-label" htmlFor="gb-signup-email">Email address</label>
                <input id="gb-signup-email" data-testid="input-signup-email" className="gb-input" type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required />
              </div>
              <div className="gb-field">
                <label className="gb-field-label" htmlFor="gb-signup-password">Password</label>
                <input id="gb-signup-password" data-testid="input-signup-password" className="gb-input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required />
              </div>
            </div>

            <p className="gb-password-hint">8+ characters; Clerk checks additional requirements.</p>
            {error && <p role="alert" className="gb-auth-error">{error}</p>}
            <button data-testid="button-signup-continue" className="gb-primary-button gb-signup-continue" type="submit" disabled={busy}>
              <span>{busy ? 'Creating your account…' : 'Continue'}</span>
            </button>
          </form>
          <p className="gb-switch-copy gb-signup-switch">Already have an account? <Link data-testid="link-signup-sign-in" href="/sign-in">Sign in</Link></p>
        </>
      )}

      {stage === 'verify' && (
        <>
          <div className="gb-form-heading">
            <span className="gb-step-label">SECURE YOUR ACCOUNT <i /></span>
            <h1>Check your email</h1>
            <p>Enter the code we sent to <strong>{email}</strong> to verify your address.</p>
          </div>
          <form className="gb-auth-form" onSubmit={verifyEmail}>
            <label className="gb-field-label" htmlFor="gb-verification-code">Email verification code</label>
            <input id="gb-verification-code" className="gb-input gb-code-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={verificationCode} onChange={event => setVerificationCode(event.target.value)} required />
            {error && <p role="alert" className="gb-auth-error">{error}</p>}
            {notice && <p role="status" className="gb-auth-notice">{notice}</p>}
            <button className="gb-primary-button" type="submit" disabled={busy || verificationCode.trim().length < 4}>
              <span>{busy ? 'Verifying…' : 'Verify email'}</span>
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <div className="gb-verification-actions">
            <button type="button" onClick={resendCode} disabled={busy}>Resend code</button>
            <button type="button" onClick={changeEmail} disabled={busy}>Use a different email</button>
          </div>
        </>
      )}

      {stage === 'profile' && (
        <>
          <div className="gb-form-heading gb-signup-heading">
            <h1>Complete your profile</h1>
            <p>Your email is verified. Add the details needed to finish your Globus account.</p>
          </div>
          <form className="gb-auth-form gb-signup-fields" onSubmit={completeProfile}>
            {showIdentityFields && (
              <>
                <div className="gb-field">
                  <label className="gb-field-label" htmlFor="gb-signup-first-name">First name</label>
                  <input id="gb-signup-first-name" data-testid="input-signup-first-name" className="gb-input" type="text" autoComplete="given-name" maxLength={80} placeholder="First name" value={firstName} onChange={event => setFirstName(event.target.value)} required />
                </div>
                <div className="gb-field">
                  <label className="gb-field-label" htmlFor="gb-signup-last-name">Last name</label>
                  <input id="gb-signup-last-name" data-testid="input-signup-last-name" className="gb-input" type="text" autoComplete="family-name" maxLength={80} placeholder="Last name" value={lastName} onChange={event => setLastName(event.target.value)} required />
                </div>
              </>
            )}
            <div className="gb-field">
              <label className="gb-field-label" htmlFor="gb-signup-phone">Phone number</label>
              <input id="gb-signup-phone" data-testid="input-signup-phone" className="gb-input" type="tel" autoComplete="tel" maxLength={32} placeholder="Phone number" value={phone} onChange={event => setPhone(event.target.value)} required />
            </div>
            <div className="gb-field">
              <label className="gb-field-label" htmlFor="gb-signup-country">Country</label>
              <input id="gb-signup-country" data-testid="input-signup-country" className="gb-input" type="text" autoComplete="country-name" maxLength={80} placeholder="Country or region" value={country} onChange={event => setCountry(event.target.value)} required />
            </div>
            <div className="gb-field">
              <label className="gb-field-label" htmlFor="gb-signup-dob">Date of birth</label>
              <input id="gb-signup-dob" data-testid="input-signup-date-of-birth" className="gb-input" type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} value={dateOfBirth} onChange={event => setDateOfBirth(event.target.value)} required />
            </div>
            <label className="gb-terms-check gb-signup-terms">
              <input data-testid="checkbox-signup-terms" type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} required />
              <span>
                I confirm my profile details are accurate and accept the Globus{' '}
                account terms.
              </span>
            </label>
            {error && <p role="alert" className="gb-auth-error">{error}</p>}
            <button data-testid="button-signup-profile-continue" className="gb-primary-button gb-signup-continue" type="submit" disabled={busy}>
              <span>{busy ? 'Finishing your account…' : 'Continue'}</span>
            </button>
          </form>
        </>
      )}

      {stage === 'finishing' && (
        <div className="gb-form-heading" role="status" aria-live="polite">
          <span className="gb-step-label">ACCOUNT SETUP <i /></span>
          <h1>Finishing your account</h1>
          <p>Saving your profile securely. Please keep this page open.</p>
        </div>
      )}

      {notice && stage === 'details' && <p role="status" className="gb-auth-notice">{notice}</p>}
    </div>
  );
}
