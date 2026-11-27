import { useState, type FormEvent } from 'react';
import { useAuth, useSession, useUser } from '@clerk/react';
import { LockKeyhole, ShieldCheck, Mail } from 'lucide-react';

export function PrivateVaultPasscodeResetPage() {
  const { isLoaded: userLoaded, user } = useUser();
  const { session } = useSession();
  const { getToken } = useAuth();
  const [email, setEmail] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [success, setSuccess] = useState(false);
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const primaryEmail = user?.primaryEmailAddress?.emailAddress || '';
  const username = user?.username || '';

  const requestReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const response = await fetch('/api/bank/vault/passcode-reset/request-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!response.ok) throw new Error('Your request could not be processed. Please try again later.');
      const result = await response.json().catch(() => ({}));
      setNotice(typeof result.message === 'string' ? result.message : 'If the email matches a DUTSTAR BANK account, a reset link will be sent to its verified primary email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your request could not be processed. Please try again later.');
    } finally {
      setBusy(false);
    }
  };

  const sendClerkCode = async () => {
    setError('');
    setNotice('');
    if (!session || !user || !user.primaryEmailAddressId || !primaryEmail ||
        user.primaryEmailAddress?.verification?.status !== 'verified') {
      setError('A verified primary Clerk email is required to reset your Vault PIN.');
      return;
    }
    if (!username) {
      setError('Your Clerk username is not configured. Add a username to your Clerk profile before resetting your Vault PIN.');
      return;
    }
    setBusy(true);
    try {
      const verification = await session.startVerification({ level: 'first_factor' });
      const hasEmailCodeFactor = verification.supportedFirstFactors?.some(
        factor => factor.strategy === 'email_code',
      );
      if (!hasEmailCodeFactor) {
        throw new Error('Email verification codes are not enabled for your Clerk account. Contact support to enable email-code verification.');
      }
      await session.prepareFirstFactorVerification({
        strategy: 'email_code',
        emailAddressId: user.primaryEmailAddressId,
      });
      setOtpSent(true);
      setNotice(`A Clerk verification code has been sent to ${primaryEmail}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clerk could not send a verification code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitClerkReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!session || !user) {
      setError('Sign in to your DUTSTAR BANK account before continuing.');
      return;
    }
    if (!/^[A-Za-z0-9]{7}$/.test(customerId.trim())) {
      setError('Enter your seven-character DUTSTAR Customer ID.');
      return;
    }
    if (!/^\d{4}$/.test(passcode)) {
      setError('Enter a four-digit PIN.');
      return;
    }
    if (passcode !== confirmation) {
      setError('The PINs do not match.');
      return;
    }
    if (!/^\d{4,12}$/.test(code.trim())) {
      setError('Enter the verification code sent by Clerk.');
      return;
    }
    setBusy(true);
    try {
      await session.attemptFirstFactorVerification({
        strategy: 'email_code',
        code: code.trim(),
      });
      const sessionToken = await getToken({ skipCache: true });
      if (!sessionToken) throw new Error('Your verified Clerk session could not be refreshed. Please sign in again.');
      const response = await fetch('/api/bank/vault/passcode-reset/complete-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        cache: 'no-store',
        body: JSON.stringify({
          customerId: customerId.trim().toUpperCase(),
          email: primaryEmail,
          username,
          newPasscode: passcode,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof result.error === 'string'
          ? result.error
          : 'Your Vault PIN could not be updated. Please try again.');
      }
      setSuccess(true);
      setPasscode('');
      setConfirmation('');
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The PIN could not be updated. Request a new code and try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitLinkReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(passcode)) {
      setError('Enter a four-digit passcode.');
      return;
    }
    if (passcode !== confirmation) {
      setError('The passcodes do not match.');
      return;
    }
    if (!token) {
      setError('This reset link is missing or invalid. Request a new link.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/bank/vault/passcode-reset/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ token, newPasscode: passcode }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'The passcode could not be reset.');
      setSuccess(true);
      setPasscode('');
      setConfirmation('');
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The passcode could not be reset. Request a new link.');
    } finally {
      setBusy(false);
    }
  };

  if (!userLoaded) {
    return <main className="grid min-h-screen place-items-center bg-[#f4f7f6] text-sm text-[#71858b]">Loading secure account…</main>;
  }

  const signedIn = Boolean(user);

  return (
    <main className="min-h-screen bg-[#f4f7f6] px-4 py-12 text-[#203b4c]">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-[#dce5e8] bg-white p-7 shadow-sm">
        <div className="mb-6 grid h-12 w-12 place-items-center rounded-xl bg-[#eaf3f0] text-[#367d78]">
          {success ? <ShieldCheck size={23} /> : signedIn ? <LockKeyhole size={23} /> : token ? <LockKeyhole size={23} /> : <Mail size={23} />}
        </div>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#4f8888]">DUTSTAR BANK · PRIVATE VAULT</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{success ? 'PIN updated' : signedIn ? 'Update your Vault PIN' : token ? 'Reset your Vault PIN' : 'Forgot your Vault PIN?'}</h1>
        {success ? (
          <div className="mt-4 space-y-4 text-sm leading-6 text-[#61777c]">
            <p>Your Private Vault PIN has been updated. Unlock your Vault using the new four-digit PIN.</p>
            <p className="rounded-lg bg-[#f1f6f3] p-3 text-xs">Your Clerk account, Vault access status, subscription, balances, and financial records were not changed. Existing Vault sessions were revoked for your protection.</p>
            <a href="/private-vault" className="inline-flex rounded-lg bg-[#173b50] px-4 py-3 text-sm font-bold text-white">Return to Private Vault</a>
          </div>
        ) : signedIn ? (
          <>
            <p className="mt-2 text-sm leading-6 text-[#71858b]">Verify the email address on your Clerk account with a one-time code. We will also match your Clerk ID, username, email, and DUTSTAR Customer ID before saving your new PIN. Your existing PIN remains active until verification succeeds.</p>
            <div className="mt-5 rounded-lg bg-[#f5f8f8] p-3 text-xs leading-5 text-[#607780]">
              <p><strong>Clerk email:</strong> {primaryEmail || 'Unavailable'}</p>
              <p><strong>Clerk username:</strong> {username || 'Not configured'}</p>
            </div>
            {!otpSent ? (
              <button type="button" onClick={() => void sendClerkCode()} disabled={busy || !session} className="mt-5 w-full rounded-lg bg-[#173b50] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Sending verification code…' : 'Send Clerk email OTP'}</button>
            ) : (
              <form onSubmit={submitClerkReset} className="mt-5 space-y-4">
                <label className="block text-xs font-semibold text-[#425d69]">DUTSTAR Customer ID
                  <input autoComplete="off" maxLength={7} value={customerId} onChange={e => setCustomerId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))} className="mt-2 h-12 w-full rounded-lg border border-[#d8e1e3] px-3 text-sm tracking-widest outline-none focus:border-[#43898a]" required />
                </label>
                <label className="block text-xs font-semibold text-[#425d69]">Clerk email verification code
                  <input autoComplete="one-time-code" inputMode="numeric" maxLength={12} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 12))} className="mt-2 h-12 w-full rounded-lg border border-[#d8e1e3] px-3 text-lg tracking-[.35em] outline-none focus:border-[#43898a]" required />
                </label>
                <label className="block text-xs font-semibold text-[#425d69]">New four-digit Vault PIN
                  <input autoComplete="new-password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} type="password" value={passcode} onChange={e => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-2 h-12 w-full rounded-lg border border-[#d8e1e3] px-3 text-lg tracking-[.5em] outline-none focus:border-[#43898a]" required />
                </label>
                <label className="block text-xs font-semibold text-[#425d69]">Confirm new Vault PIN
                  <input autoComplete="new-password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} type="password" value={confirmation} onChange={e => setConfirmation(e.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-2 h-12 w-full rounded-lg border border-[#d8e1e3] px-3 text-lg tracking-[.5em] outline-none focus:border-[#43898a]" required />
                </label>
                <button type="submit" disabled={busy} className="w-full rounded-lg bg-[#173b50] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Verifying and updating PIN…' : 'Verify OTP and update PIN'}</button>
                <button type="button" onClick={() => { setOtpSent(false); setCode(''); setError(''); }} disabled={busy} className="w-full rounded-lg border border-[#d8e1e3] px-4 py-3 text-sm font-semibold text-[#45616d]">Send a new code</button>
              </form>
            )}
            {notice && <p role="status" className="mt-4 rounded-lg border border-[#cfe3d7] bg-[#f0f8f2] p-3 text-xs leading-5 text-[#356b55]">{notice}</p>}
            {error && <p role="alert" className="mt-4 rounded-lg border border-[#f0d4cc] bg-[#fff7f3] p-3 text-xs text-[#9a5044]">{error}</p>}
            <p className="mt-5 text-[11px] leading-5 text-[#849397]">A successful PIN update does not change your Vault access entitlement, subscription, account password, or financial records.</p>
          </>
        ) : token ? (
          <>
            <p className="mt-2 text-sm leading-6 text-[#71858b]">Choose a new four-digit passcode. This secure link can only be used once and expires after 30 minutes.</p>
            <form onSubmit={submitLinkReset} className="mt-6 space-y-4">
              <label className="block text-xs font-semibold text-[#425d69]">New four-digit passcode
                <input autoComplete="new-password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} type="password" value={passcode} onChange={e => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-2 h-12 w-full rounded-lg border border-[#d8e1e3] px-3 text-lg tracking-[.5em] outline-none focus:border-[#43898a]" required />
              </label>
              <label className="block text-xs font-semibold text-[#425d69]">Confirm new passcode
                <input autoComplete="new-password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} type="password" value={confirmation} onChange={e => setConfirmation(e.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-2 h-12 w-full rounded-lg border border-[#d8e1e3] px-3 text-lg tracking-[.5em] outline-none focus:border-[#43898a]" required />
              </label>
              {error && <p role="alert" className="rounded-lg border border-[#f0d4cc] bg-[#fff7f3] p-3 text-xs text-[#9a5044]">{error}</p>}
              <button type="submit" disabled={busy} className="w-full rounded-lg bg-[#173b50] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Updating passcode…' : 'Reset Private Vault passcode'}</button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-[#71858b]">Enter the email address registered to your account and we will send a one-time reset link to its verified primary email. If you can sign in, use Clerk email OTP verification from this page instead.</p>
            <form onSubmit={requestReset} className="mt-6 space-y-4">
              <label className="block text-xs font-semibold text-[#425d69]">Registered email address
                <input type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#d8e1e3] px-3 text-sm outline-none focus:border-[#43898a]" placeholder="you@example.com" required />
              </label>
              {error && <p role="alert" className="rounded-lg border border-[#f0d4cc] bg-[#fff7f3] p-3 text-xs text-[#9a5044]">{error}</p>}
              {notice && <p role="status" className="rounded-lg border border-[#cfe3d7] bg-[#f0f8f2] p-3 text-xs leading-5 text-[#356b55]">{notice}</p>}
              <button type="submit" disabled={busy || !email.trim()} className="w-full rounded-lg bg-[#173b50] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Requesting reset link…' : 'Email me a reset link'}</button>
            </form>
            <p className="mt-5 text-[11px] leading-5 text-[#849397]">For your security, reset links are single-use, expire after 30 minutes, and can only be sent to the verified primary email on the account. Your account password and Vault access status are not changed.</p>
          </>
        )}
      </section>
    </main>
  );
}
