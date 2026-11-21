import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useClerk, useSignIn, useSignUp, useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetBankDashboardQueryKey, getGetBankProfileQueryKey, useCompleteRequiredPasswordReset, useGetBankProfile, useLookupCustomerId, useSaveSignupProfile } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/i18n';
import { AppLanguageSelector } from '@/components/app-language-selector';
import { SignupOptionalProfileFields } from './signup-profile-fields';
import { authFailureMessage, signInNextStep } from '../lib/auth-errors';
import {
  clearSignupProgress,
  clearSignupProfileDraft,
  clearLocalSignupAttempt,
  finalizeSignupWhenSessionReady,
  getMissingRequiredSignupDetails,
  getSignupFinalizationBlocker,
  persistSignupProfileDraft,
  persistSignupProgress,
  readSignupProfileDraft,
  readSignupProgress,
  requiredSignupDetailsMessage,
  resolveSignupResumeStage,
  sanitizeOptionalSignupProfile,
  saveSignupProfileWithoutBlocking,
  sendEmailVerificationAfterRequiredDetails,
  syncMissingSignupNames,
  signupCreationErrorMessage,
  verifyEmailCode,
  type OptionalSignupProfile,
  type SignupProfileDraft,
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
  const { t } = useLanguage();

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
          <span className="gb-eyebrow">{t('A clearer view of your money')}</span>
          <h2>{t(isSignUp ? 'Begin with\na better view.' : 'Your world.\nIn one place.')}</h2>
          <p>
            {isSignUp
              ? t('Create your member account and bring your Globus activity into focus.')
              : t('Access your accounts, follow your balances, and move money with clarity.')}
          </p>
        </div>
        <div className="gb-world-art" aria-hidden="true">
          <span className="gb-orbit gb-orbit-one" />
          <span className="gb-orbit gb-orbit-two" />
          <span className="gb-orbit-dot" />
          <span className="gb-world-label">{t('GLOBAL FINANCE')}</span>
        </div>
        <div className="gb-panel-foot">
          <span>GLOBUS BANK</span>
          <span>{t('YOUR WORLD. OUR PRIORITY.')}</span>
        </div>
      </aside>

      <section className="gb-form-side">
        <div className={`gb-auth-content ${isSignUp ? 'gb-signup-content' : ''}`}>
          <div className="gb-auth-language-position">
            <AppLanguageSelector />
          </div>
          <div className={`gb-signup-brand${isSignUp ? '' : ' gb-signin-brand'}`}>
            <img src={asset('globus-wordmark-transparent.png')} alt="Globus Bank" />
          </div>
          {children}
          <div className="gb-signup-footer">
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
              <rect x="3.25" y="7" width="9.5" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
              <path d="M5.25 7V4.9a2.75 2.75 0 0 1 5.5 0V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span>{t('Secured by Clerk')}</span>
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
  const { t } = useLanguage();
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
        <h1>{t('Welcome back')}</h1>
        <p>{t('Sign in with your username and password.')}</p>
      </div>
      {verificationFactor ? (
        <form className="gb-auth-form" onSubmit={submitVerificationCode}>
          <p className="gb-switch-copy">
            {verificationFactor === 'first_email_code' || verificationFactor === 'email_code'
              ? t('Enter the verification code sent to your email.')
              : verificationFactor === 'phone_code'
                ? t('Enter the verification code sent to your phone.')
                : verificationFactor === 'totp'
                  ? t('Enter the code from your authenticator app.')
                  : t('Enter one of your backup codes.')}
          </p>
          <label className="gb-field-label" htmlFor="gb-signin-verification-code">{t('Verification code')}</label>
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
          {error && <p role="alert" className="gb-auth-error">{t(error)}</p>}
          <button className="gb-primary-button" type="submit" disabled={busy || !verificationCode.trim()}>
            <span>{busy ? t('Verifying…') : t('Verify & sign in')}</span>
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
            {t('Back to sign in')}
          </button>
        </form>
      ) : (
        showFormUnavailable ? (
          <p role="status" className="gb-auth-notice">{t(showFormUnavailable)}</p>
        ) : (
          <form className="gb-auth-form" noValidate onSubmit={submit}>
            <div className="gb-field">
              <label className="gb-field-label" htmlFor="gb-signin-username">{t('Username')}</label>
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
                <p id="gb-signin-field-error" role="alert" className="gb-auth-error gb-signin-field-error">{t(error)}</p>
              )}
            </div>
            <div className="gb-field">
              <label className="gb-field-label" htmlFor="gb-signin-password">{t('Password')}</label>
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
                <p id="gb-signin-field-error" role="alert" className="gb-auth-error gb-signin-field-error">{t(error)}</p>
              )}
            </div>
            {error && !errorField && <p role="alert" className="gb-auth-error">{t(error)}</p>}
            <button className="gb-primary-button" type="submit" disabled={busy}>
              <span>{busy ? t('Signing in…') : t('Sign in')}</span>
              <span aria-hidden="true">→</span>
            </button>
          </form>
        )
      )}
      <p className="gb-recovery-link">
        <Link href="/sign-in/email">{t('Forgot username or password?')}</Link>
      </p>
      <p className="gb-switch-copy">{t('New to Globus?')} <Link href="/sign-up">{t('Create an account')}</Link></p>
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

type SignUpStage = 'details' | 'optional-profile' | 'verify' | 'finishing';

export function ClerkSignUpForm() {
  const [, setLocation] = useLocation();
  const { signUp, fetchStatus } = useSignUp();
  const { isLoaded: userLoaded, user } = useUser();
  const { t } = useLanguage();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [cityOfOrigin, setCityOfOrigin] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [occupation, setOccupation] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operationRef = useRef(false);
  const finalizingRef = useRef(false);
  const finalizationAttemptedRef = useRef<string | null>(null);
  const initialDraft = signUp.id ? readSignupProfileDraft() : null;
  const [stage, setStage] = useState<SignUpStage>(() => {
    const resumeStage = resolveSignupResumeStage({
      isSignedIn: Boolean(user),
      emailVerified: signUp.verifications.emailAddress.status === 'verified',
      clerkStatus: signUp.status,
      persistedStage: readSignupProgress(signUp.id),
      missingFields: signUp.missingFields,
    });
    return resumeStage === 'dashboard' ? 'details' : resumeStage;
  });
  const busy = fetchStatus === 'fetching' || submitting || stage === 'finishing';
  const legalAcceptanceRequired =
    signUp.requiredFields.includes('legal_accepted') ||
    signUp.missingFields.includes('legal_accepted');
  const emailVerified = signUp.verifications.emailAddress.status === 'verified';
  const finalizationState = {
    status: signUp.status,
    createdSessionId: signUp.createdSessionId,
    missingFields: signUp.missingFields,
  };
  const readCurrentSignupState = () => ({
    status: signUp.status,
    createdSessionId: signUp.createdSessionId,
    missingFields: [...signUp.missingFields],
  });
  const signupFinalizationReadiness = getSignupFinalizationBlocker(finalizationState);
  const onlyTermsRemaining =
    emailVerified &&
    acceptedTerms &&
    signUp.missingFields.length === 1 &&
    signUp.missingFields[0] === 'legal_accepted';
  const canSubmitVerifiedSignup =
    emailVerified &&
    (signupFinalizationReadiness.ready || onlyTermsRemaining);
  const signupMissingFieldsKey = signUp.missingFields.join('|');
  const canReviewSignupDetails = signUp.missingFields.every((field) =>
    [
      'first_name',
      'last_name',
      'username',
      'email_address',
      'password',
      'legal_accepted',
    ].includes(field),
  );
  const canResetSignupAttempt =
    Boolean(signUp.id) &&
    signUp.status !== 'complete' &&
    !emailVerified;
  const updateOptionalField = (
    field: keyof OptionalSignupProfile,
    value: string,
  ) => {
    const setters: Record<keyof OptionalSignupProfile, (next: string) => void> = {
      address: setAddress,
      phone: setPhone,
      country: setCountry,
      cityOfOrigin: setCityOfOrigin,
      dateOfBirth: setDateOfBirth,
      occupation: setOccupation,
    };
    setters[field](value);
  };

  useEffect(() => {
    if (
      initialDraft &&
      signUp.emailAddress &&
      initialDraft.emailAddress === signUp.emailAddress.trim().toLowerCase()
    ) {
      setFirstName((current) => current || initialDraft.firstName);
      setLastName((current) => current || initialDraft.lastName);
      setAddress((current) => current || initialDraft.address || '');
      setPhone((current) => current || initialDraft.phone || '');
      setCountry((current) => current || initialDraft.country || '');
      setCityOfOrigin((current) => current || initialDraft.cityOfOrigin || '');
      setDateOfBirth((current) => current || initialDraft.dateOfBirth || '');
      setOccupation((current) => current || initialDraft.occupation || '');
      setAcceptedTerms((current) => current || initialDraft.acceptedTerms === true);
      setEmail((current) => current || initialDraft.emailAddress);
    }
  }, [initialDraft, signUp.emailAddress]);

  useEffect(() => {
    if (signUp.id) {
      setFirstName((current) => current || signUp.firstName || '');
      setLastName((current) => current || signUp.lastName || '');
      setUsername((current) => current || signUp.username || '');
      setEmail((current) => current || signUp.emailAddress || '');
    }
  }, [signUp.id, signUp.firstName, signUp.lastName, signUp.username, signUp.emailAddress]);

  useEffect(() => {
    if (!userLoaded) return;
    if (user) {
      setLocation('/dashboard', { replace: true });
      return;
    }
    if (!signUp.id) return;

    const resumeStage = resolveSignupResumeStage({
      isSignedIn: false,
      emailVerified,
      clerkStatus: signUp.status,
      persistedStage: readSignupProgress(signUp.id),
      missingFields: signUp.missingFields,
    });
    if (resumeStage !== 'dashboard') setStage(resumeStage);
  }, [userLoaded, user, signUp.id, signUp.status, emailVerified, signupMissingFieldsKey, setLocation]);

  const finalizeVerifiedAccount = async (
    allowRetry = false,
    latestState = finalizationState,
  ) => {
    if (finalizingRef.current) return;
    if (
      !allowRetry &&
      finalizationAttemptedRef.current === (signUp.id ?? 'no-signup-id')
    ) {
      return;
    }
    finalizingRef.current = true;
    setStage('finishing');
    setError('');

    try {
      let currentState = latestState;
      if (currentState.missingFields.includes('legal_accepted')) {
        if (!acceptedTerms) {
          setStage(emailVerified ? 'details' : 'verify');
          setError('Accept the account terms to finish creating your account.');
          return;
        }
        const acceptance = await signUp.update({ legalAccepted: true });
        if (acceptance.error) {
          setStage(emailVerified ? 'details' : 'verify');
          setError(acceptance.error.message || 'Your account terms could not be saved. Please try again.');
          return;
        }
        currentState = readCurrentSignupState();
      }

      const stateAfterRequiredUpdates = {
        status: currentState.status,
        createdSessionId: currentState.createdSessionId,
        missingFields: currentState.missingFields.filter(
          (field) => !(acceptedTerms && field === 'legal_accepted'),
        ),
      };
      const readiness = getSignupFinalizationBlocker(stateAfterRequiredUpdates);
      if (!readiness.ready) {
        setStage(stateAfterRequiredUpdates.missingFields.length ? 'details' : 'verify');
        setError(readiness.message);
        return;
      }

      finalizationAttemptedRef.current = signUp.id ?? 'no-signup-id';
      const finalized = await finalizeSignupWhenSessionReady(
        stateAfterRequiredUpdates,
        () => signUp.finalize({ navigate: () => undefined }),
        () => clearSignupProgress(signUp.id),
        () => setLocation('/dashboard', { replace: true }),
      );
      if (!finalized.ok) {
        setStage('verify');
        setError(finalized.message);
        return;
      }
    } finally {
      finalizingRef.current = false;
    }
  };

  useEffect(() => {
    if (stage === 'verify' && emailVerified) {
      void finalizeVerifiedAccount();
    }
  }, [
    stage,
    emailVerified,
    signUp.id,
    signUp.status,
    signUp.createdSessionId,
    signupMissingFieldsKey,
  ]);

  const startSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (operationRef.current) return;
    operationRef.current = true;
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
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
      if (password.length < 8) {
        setError('Use a password with at least 8 characters.');
        return;
      }
      if (legalAcceptanceRequired && !acceptedTerms) {
        setError('Accept the account terms to continue.');
        return;
      }

      const submittedEmail = email.trim().toLowerCase();
      const currentAttemptEmail = signUp.emailAddress?.trim().toLowerCase();
      if (
        signUp.id &&
        currentAttemptEmail &&
        currentAttemptEmail !== submittedEmail
      ) {
        const reset = await clearLocalSignupAttempt(
          () => signUp.reset(),
          () => clearSignupProgress(signUp.id),
        );
        if (!reset.ok) {
          setError(reset.message);
          return;
        }
        clearSignupProfileDraft();
      } else if (signUp.status === 'abandoned') {
        const reset = await clearLocalSignupAttempt(
          () => signUp.reset(),
          () => clearSignupProgress(signUp.id),
        );
        if (!reset.ok) {
          setError(reset.message);
          return;
        }
      }

      if (signUp.status === 'complete') {
        await continueToVerification(undefined, false, true);
        return;
      }

      if (emailVerified && signUp.id) {
        const updated = await signUp.update({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: username.trim(),
          ...(legalAcceptanceRequired && acceptedTerms ? { legalAccepted: true } : {}),
        });
        if (updated.error) {
          setError(updated.error.message || 'Clerk could not save the required account details. Review them and try again.');
          return;
        }
        const missingRequired = getMissingRequiredSignupDetails({
          firstName,
          lastName,
          username,
          emailAddress: email,
          password,
          hasPassword: signUp.hasPassword,
          acceptedTerms,
          legalAcceptanceRequired,
          clerkMissingFields: signUp.missingFields,
        });
        if (missingRequired.length) {
          setStage('details');
          setError(requiredSignupDetailsMessage(missingRequired, true));
          return;
        }
        await continueToVerification(undefined, false, true);
        return;
      }

      const nameUpdate = signUp.id
        ? await syncMissingSignupNames(
          signUp.missingFields,
          firstName,
          lastName,
          (values) => signUp.update(values),
        )
        : { ok: true as const };
      if (!nameUpdate.ok) {
        setError(nameUpdate.message);
        return;
      }

      const created = await signUp.password({
        emailAddress: email.trim(),
        password,
        username: username.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      if (created.error) {
        setError(signupCreationErrorMessage(created.error));
        return;
      }

      let signupSnapshot = readCurrentSignupState();
      if (
        signupSnapshot.missingFields.includes('first_name') ||
        signupSnapshot.missingFields.includes('last_name')
      ) {
        const nameUpdateResult = await signUp.update({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
        if (nameUpdateResult.error) {
          setError(nameUpdateResult.error.message || 'Clerk could not save your first and last name. Review them and try again.');
          return;
        }
        signupSnapshot = readCurrentSignupState();
      }

      if (signupSnapshot.missingFields.includes('legal_accepted') && acceptedTerms) {
        const acceptance = await signUp.update({ legalAccepted: true });
        if (acceptance.error) {
          setError(acceptance.error.message || 'Your account terms could not be saved. You can retry without creating another account.');
          return;
        }
        signupSnapshot = readCurrentSignupState();
      }

      const missingRequired = getMissingRequiredSignupDetails({
        firstName,
        lastName,
        username,
        emailAddress: email,
        password,
        hasPassword: signUp.hasPassword,
        acceptedTerms,
        legalAcceptanceRequired,
        clerkMissingFields: signupSnapshot.missingFields,
      });
      if (missingRequired.length) {
        setStage('details');
        setError(requiredSignupDetailsMessage(missingRequired));
        return;
      }

      await continueToVerification(undefined, false, true);
    } finally {
      operationRef.current = false;
      setSubmitting(false);
    }
  };

  const startOver = async () => {
    if (operationRef.current || (!canResetSignupAttempt && !error)) return;
    operationRef.current = true;
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const reset = await clearLocalSignupAttempt(
        () => signUp.reset(),
        () => clearSignupProgress(signUp.id),
      );
      if (!reset.ok) {
        setError(reset.message);
        return;
      }
      finalizationAttemptedRef.current = null;
      setVerificationCode('');
      setStage('details');
      setNotice('The unfinished sign-up was cleared in this browser. Retry with the same email, or sign in and use account recovery if an account was already created.');
    } finally {
      operationRef.current = false;
      setSubmitting(false);
    }
  };

  const continueToVerification = async (
    event?: FormEvent<HTMLFormElement>,
    skipProfileDetails = false,
    alreadyLocked = false,
  ) => {
    event?.preventDefault();
    if (!alreadyLocked) {
      if (operationRef.current) return;
      operationRef.current = true;
      setSubmitting(true);
    }
    setError('');
    setNotice('');

    try {
      const enteredDetails: OptionalSignupProfile = {
        address,
        phone,
        country,
        cityOfOrigin,
        dateOfBirth,
        occupation,
      };
      const details = skipProfileDetails
        ? {}
        : sanitizeOptionalSignupProfile(enteredDetails);
      const draft: SignupProfileDraft = {
        emailAddress: email.trim() || signUp.emailAddress || '',
        firstName: firstName.trim() || signUp.firstName || '',
        lastName: lastName.trim() || signUp.lastName || '',
        ...details,
        ...(acceptedTerms ? { acceptedTerms: true } : {}),
      };
      const persistDraft = () => persistSignupProfileDraft(draft);
      let currentState = finalizationState;
      if (
        signUp.missingFields.includes('first_name') ||
        signUp.missingFields.includes('last_name')
      ) {
        const nameUpdate = await signUp.update({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
        if (nameUpdate.error) {
          persistDraft();
          setStage('details');
          setError(nameUpdate.error.message || 'Clerk still needs your first and last name. Review them before email verification.');
          return;
        }
        currentState = readCurrentSignupState();
      }
      const missingRequired = getMissingRequiredSignupDetails({
        firstName: draft.firstName,
        lastName: draft.lastName,
        username,
        emailAddress: draft.emailAddress,
        password,
        hasPassword: signUp.hasPassword,
        acceptedTerms,
        legalAcceptanceRequired,
        clerkMissingFields: currentState.missingFields,
      });
      if (missingRequired.length) {
        persistDraft();
        persistSignupProgress(signUp.id, 'verify');
        setStage('details');
        setError(requiredSignupDetailsMessage(missingRequired, emailVerified));
        return;
      }

      let retained = false;
      if (emailVerified || signUp.status === 'complete') {
        retained = persistDraft();
        setNotice(
          !retained
            ? 'Optional details could not be retained across a refresh; account creation will continue.'
            : '',
        );
      }

      persistSignupProgress(signUp.id, 'verify');
      setStage('verify');

      if (emailVerified || signUp.status === 'complete') {
        await finalizeVerifiedAccount(true, currentState);
        return;
      }

      const delivery = await sendEmailVerificationAfterRequiredDetails({
        firstName: draft.firstName,
        lastName: draft.lastName,
        username,
        emailAddress: draft.emailAddress,
        password,
        hasPassword: signUp.hasPassword,
        acceptedTerms,
        legalAcceptanceRequired,
        clerkMissingFields: currentState.missingFields,
      },
        persistDraft,
        () => signUp.verifications.sendEmailCode(),
      );
      retained = delivery.detailsRetained;
      if (!delivery.ok) {
        if (delivery.missingRequiredFields.length) {
          persistSignupProgress(signUp.id, 'verify');
          setStage('details');
          setError(requiredSignupDetailsMessage(delivery.missingRequiredFields, emailVerified));
          return;
        }
        persistSignupProgress(signUp.id, 'optional-profile');
        setStage('optional-profile');
        setNotice(
          !retained
            ? 'Optional details could not be retained across a refresh; account creation can still continue.'
            : '',
        );
        setError(delivery.message);
        return;
      }
      const storageNote = retained
        ? ''
        : 'Optional details may not be restored after a browser refresh. ';
      setNotice(`${storageNote}Enter the verification code sent to ${draft.emailAddress}.`);
    } finally {
      if (!alreadyLocked) {
        operationRef.current = false;
        setSubmitting(false);
      }
    }
  };

  const verifyEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (operationRef.current) return;
    operationRef.current = true;
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      if (emailVerified) {
        await finalizeVerifiedAccount(true);
        return;
      }
      const missingRequired = getMissingRequiredSignupDetails({
        firstName,
        lastName,
        username,
        emailAddress: email || signUp.emailAddress || '',
        password,
        hasPassword: signUp.hasPassword,
        acceptedTerms,
        legalAcceptanceRequired,
        clerkMissingFields: signUp.missingFields,
      });
      if (missingRequired.length) {
        setStage('details');
        setError(requiredSignupDetailsMessage(missingRequired));
        return;
      }
      const result = await verifyEmailCode(() =>
        signUp.verifications.verifyEmailCode({ code: verificationCode.trim() }),
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await finalizeVerifiedAccount(true, readCurrentSignupState());
    } finally {
      operationRef.current = false;
      setSubmitting(false);
    }
  };

  const resendCode = async () => {
    if (operationRef.current) return;
    operationRef.current = true;
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const missingRequired = getMissingRequiredSignupDetails({
        firstName,
        lastName,
        username,
        emailAddress: email || signUp.emailAddress || '',
        password,
        hasPassword: signUp.hasPassword,
        acceptedTerms,
        legalAcceptanceRequired,
        clerkMissingFields: signUp.missingFields,
      });
      if (missingRequired.length) {
        setStage('details');
        setError(requiredSignupDetailsMessage(missingRequired));
        return;
      }
      const sent = await signUp.verifications.sendEmailCode();
      if (sent.error) {
        setError(sent.error.message || 'A new code could not be sent. Please try again.');
        return;
      }
      setNotice(`A new verification code was sent to ${email || signUp.emailAddress}.`);
    } finally {
      operationRef.current = false;
      setSubmitting(false);
    }
  };

  const returnToOptionalProfile = () => {
    persistSignupProgress(signUp.id, 'optional-profile');
    setError('');
    setNotice('');
    setVerificationCode('');
    setStage('optional-profile');
  };

  const reviewRequiredSignupDetails = () => {
    setError('');
    setNotice('Your email is already verified. Re-enter the required account details and password to finish setup.');
    setStage('details');
  };

  const changeEmail = async () => {
    const reset = await clearLocalSignupAttempt(
      () => signUp.reset(),
      () => clearSignupProgress(signUp.id),
    );
    if (!reset.ok) {
      setError(reset.message);
      return;
    }
    clearSignupProfileDraft();
    setVerificationCode('');
    setPassword('');
    setAcceptedTerms(false);
    setError('');
    setNotice('');
    setStage('details');
  };

  const verificationInProgress = stage === 'verify' && !emailVerified;
  const clerkNamesMissing =
    signUp.missingFields.includes('first_name') ||
    signUp.missingFields.includes('last_name');
  const requiredFieldsDisabled =
    verificationInProgress ||
    (Boolean(signUp.id) &&
      signUp.status !== 'abandoned' &&
      !emailVerified &&
      !clerkNamesMissing);

  return (
    <div className="gb-signup-form-wrap">
      {stage !== 'finishing' && (
        <>
          <div className="gb-form-heading gb-signup-heading">
            <span className="gb-step-label">{t('SECURE REGISTRATION')} <i /></span>
            <h1>{t('Create your account')}</h1>
            <p>{t('Enter your account details and verify your email.')}</p>
          </div>
          <form
            className="gb-auth-form gb-signup-form gb-signup-main-form"
            onSubmit={
              stage === 'verify'
                ? verifyEmail
                : stage === 'optional-profile'
                  ? continueToVerification
                  : startSignUp
            }
          >
            <fieldset
              className="gb-signup-fields gb-signup-required-fields"
              disabled={requiredFieldsDisabled}
            >
              <div className="gb-field">
                <label className="gb-field-label" htmlFor="gb-signup-first-name">{t('First name')}</label>
                <input id="gb-signup-first-name" data-testid="input-signup-first-name" className="gb-input" type="text" autoComplete="given-name" maxLength={80} value={firstName} onChange={event => setFirstName(event.target.value)} required />
              </div>
              <div className="gb-field">
                <label className="gb-field-label" htmlFor="gb-signup-last-name">{t('Last name')}</label>
                <input id="gb-signup-last-name" data-testid="input-signup-last-name" className="gb-input" type="text" autoComplete="family-name" maxLength={80} value={lastName} onChange={event => setLastName(event.target.value)} required />
              </div>
              <div className="gb-field gb-field-wide">
                <label className="gb-field-label" htmlFor="gb-signup-username">{t('Username')}</label>
                <input id="gb-signup-username" data-testid="input-signup-username" className="gb-input" type="text" autoComplete="username" autoCapitalize="off" spellCheck={false} minLength={6} maxLength={12} pattern="(?=.*[A-Za-z])[A-Za-z0-9_-]{6,12}" value={username} onChange={event => setUsername(event.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12))} required />
                <p className="gb-password-hint">{t('6–12 characters with a letter; letters, numbers, hyphens, underscores.')}</p>
              </div>
              <div className="gb-field gb-field-wide">
                <label className="gb-field-label" htmlFor="gb-signup-email">{t('Email address')}</label>
                <input id="gb-signup-email" data-testid="input-signup-email" className="gb-input" type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required />
              </div>
              <div className="gb-field gb-field-wide">
                <label className="gb-field-label" htmlFor="gb-signup-password">{t('Password')}</label>
                <input id="gb-signup-password" data-testid="input-signup-password" className="gb-input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required />
              </div>
              <p className="gb-password-hint gb-field-wide">{t('8+ characters; Clerk checks additional requirements.')}</p>
            </fieldset>

            <section className="gb-signup-profile-section" aria-labelledby="gb-signup-profile-title">
              <h2 id="gb-signup-profile-title" className="gb-signup-section-title">{t('Profile information')}</h2>
              <fieldset
                className="gb-signup-fields gb-signup-optional-fields"
                disabled={verificationInProgress}
              >
                <SignupOptionalProfileFields
                  values={{ address, phone, country, cityOfOrigin, dateOfBirth, occupation }}
                  onChange={updateOptionalField}
                />
              </fieldset>
            </section>

            {legalAcceptanceRequired && (
              <label className="gb-terms-check gb-signup-terms">
                <input data-testid="checkbox-signup-terms" type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} disabled={verificationInProgress} required />
                <span>{t('I accept the account terms required by this Clerk account.')}</span>
              </label>
            )}

            {stage === 'verify' && !emailVerified && (
              <section className="gb-signup-verify-fields" aria-labelledby="gb-signup-verification-title">
                <h2 id="gb-signup-verification-title" className="gb-signup-section-title">{t('Email verification')}</h2>
                <p className="gb-signup-verification-copy">
                  {t('Code sent to')} <strong>{email || signUp.emailAddress}</strong>
                </p>
                <div className="gb-signup-fields">
                  <div className="gb-field">
                    <label className="gb-field-label" htmlFor="gb-verification-code">{t('Email verification code')}</label>
                    <input id="gb-verification-code" data-testid="input-signup-verification-code" className="gb-input gb-code-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={verificationCode} onChange={event => setVerificationCode(event.target.value)} required />
                  </div>
                </div>
              </section>
            )}

            {error && <p role="alert" className="gb-auth-error">{t(error)}</p>}
            {notice && <p role="status" className="gb-auth-notice">{t(notice)}</p>}
            {stage === 'verify' && emailVerified && signUp.status !== 'complete' && canReviewSignupDetails && (
              <button className="gb-recovery-secondary" type="button" disabled={busy} onClick={reviewRequiredSignupDetails}>
                {t('Review required details')}
              </button>
            )}
            {stage !== 'verify' || !emailVerified || canSubmitVerifiedSignup ? (
              <button
                data-testid="button-signup-continue"
                className="gb-primary-button gb-signup-continue"
                type="submit"
                disabled={busy || (verificationInProgress && verificationCode.trim().length < 4)}
              >
                <span>
                  {busy
                    ? stage === 'verify'
                      ? t('Checking…')
                      : stage === 'optional-profile'
                        ? t('Sending code…')
                        : t('Creating account…')
                    : stage === 'verify'
                      ? emailVerified
                        ? t('Finish account setup')
                        : t('Verify email and continue')
                      : stage === 'optional-profile'
                        ? t('Send verification code')
                        : t('Create account and send code')}
                </span>
              </button>
            ) : null}
          </form>

          <div className="gb-verification-actions">
            {stage === 'verify' && !emailVerified && signUp.status !== 'complete' && (
              <>
                <button type="button" onClick={() => void resendCode()} disabled={busy}>{t('Resend code')}</button>
                <button type="button" onClick={returnToOptionalProfile} disabled={busy}>{t('Edit profile details')}</button>
                <button type="button" onClick={() => void changeEmail()} disabled={busy}>{t('Use a different email')}</button>
                {canResetSignupAttempt && (
                  <button type="button" onClick={() => void startOver()} disabled={busy}>{t('Start over')}</button>
                )}
              </>
            )}
          </div>
          {stage !== 'verify' && (canResetSignupAttempt || Boolean(error)) && (
            <button className="gb-recovery-secondary" type="button" onClick={() => void startOver()} disabled={busy}>
              {t('Start over')}
            </button>
          )}
          <p className="gb-switch-copy gb-signup-switch">
            {t('Already have an account?')} <Link data-testid="link-signup-sign-in" href="/sign-in">{t('Sign in')}</Link>
            {stage === 'verify' && emailVerified && <> · <Link href="/sign-in/email">{t('Recover it')}</Link></>}
          </p>
        </>
      )}

      {stage === 'finishing' && (
        <div className="gb-form-heading" role="status" aria-live="polite">
          <span className="gb-step-label">{t('ACCOUNT SETUP')} <i /></span>
          <h1>{t('Opening your account')}</h1>
          <p>{t('Your email is verified. Signing you in and opening your dashboard.')}</p>
        </div>
      )}
    </div>
  );
}

export function PendingSignupProfilePersistence() {
  const { isLoaded, user } = useUser();
  const saveSignupProfile = useSaveSignupProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const attemptedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user || attemptedUserIdRef.current === user.id) return;
    const draft = readSignupProfileDraft();
    const accountEmail = user.primaryEmailAddress?.emailAddress.trim().toLowerCase();
    if (!draft) return;

    attemptedUserIdRef.current = user.id;
    if (!accountEmail || draft.emailAddress !== accountEmail) {
      toast({
        title: 'Optional details were not matched to this account',
        description: 'They were not sent to another profile and remain in this browser until you retry with the matching account.',
      });
      return;
    }

    let active = true;
    void saveSignupProfileWithoutBlocking(() =>
      saveSignupProfile.mutateAsync({
        data: {
          firstName: draft.firstName,
          lastName: draft.lastName,
          ...sanitizeOptionalSignupProfile(draft),
          ...(draft.acceptedTerms ? { acceptedTerms: true } : {}),
        },
      }),
    ).then(async (saved) => {
      if (!active) return;
      if (saved) {
        clearSignupProfileDraft();
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetBankProfileQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() }),
        ]);
        return;
      }
      toast({
        title: 'Optional details were not saved',
        description: 'Your accepted details remain in this browser. Account access continues; refresh later to retry saving them.',
      });
    });
    return () => {
      active = false;
    };
  }, [
    isLoaded,
    user,
    saveSignupProfile.mutateAsync,
    queryClient,
    toast,
  ]);

  return null;
}
