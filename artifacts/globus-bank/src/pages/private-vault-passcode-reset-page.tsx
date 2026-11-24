import { useState, type FormEvent } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';

export function PrivateVaultPasscodeResetPage() {
  const [passcode, setPasscode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const token = new URLSearchParams(window.location.search).get('token') || '';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!/^[0-9]{4}$/.test(passcode)) {
      setError('Enter a four-digit passcode.');
      return;
    }
    if (passcode !== confirmation) {
      setError('The passcodes do not match.');
      return;
    }
    if (!token) {
      setError('This reset link is missing or invalid. Request a new link from GLOBUS BANK.');
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

  return (
    <main className="min-h-screen bg-[#f4f7f6] px-4 py-12 text-[#203b4c]">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-[#dce5e8] bg-white p-7 shadow-sm">
        <div className="mb-6 grid h-12 w-12 place-items-center rounded-xl bg-[#eaf3f0] text-[#367d78]">
          {success ? <ShieldCheck size={23} /> : <LockKeyhole size={23} />}
        </div>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#4f8888]">GLOBUS BANK · PRIVATE VAULT</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{success ? 'Passcode updated' : 'Reset your vault passcode'}</h1>
        {success ? (
          <div className="mt-4 space-y-4 text-sm leading-6 text-[#61777c]">
            <p>Your Private Vault passcode has been reset. Sign in to your GLOBUS BANK account and unlock your vault with the new four-digit passcode.</p>
            <p className="rounded-lg bg-[#f1f6f3] p-3 text-xs">Your vault access status and subscription were not changed by this reset.</p>
            <a href="/sign-in" className="inline-flex rounded-lg bg-[#173b50] px-4 py-3 text-sm font-bold text-white">Return to sign in</a>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-[#71858b]">Choose a new four-digit passcode. This secure link can only be used once and expires after 30 minutes.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-xs font-semibold text-[#425d69]">New four-digit passcode
                <input autoComplete="new-password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} type="password" value={passcode} onChange={e => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-2 h-12 w-full rounded-lg border border-[#d8e1e3] px-3 text-lg tracking-[.5em] outline-none focus:border-[#43898a]" required />
              </label>
              <label className="block text-xs font-semibold text-[#425d69]">Confirm new passcode
                <input autoComplete="new-password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} type="password" value={confirmation} onChange={e => setConfirmation(e.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-2 h-12 w-full rounded-lg border border-[#d8e1e3] px-3 text-lg tracking-[.5em] outline-none focus:border-[#43898a]" required />
              </label>
              {error && <p role="alert" className="rounded-lg border border-[#f0d4cc] bg-[#fff7f3] p-3 text-xs text-[#9a5044]">{error}</p>}
              <button type="submit" disabled={busy || !token} className="w-full rounded-lg bg-[#173b50] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Updating passcode…' : 'Reset Private Vault passcode'}</button>
            </form>
            <p className="mt-5 text-[11px] leading-5 text-[#849397]">This action changes only your vault passcode. It does not activate, suspend, or otherwise change Private Vault access.</p>
          </>
        )}
      </section>
    </main>
  );
}
