import { useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetBankDashboardQueryKey,
  getListBankTransactionsQueryKey,
  getListBankWalletsQueryKey,
  useCreateLedgerRequest,
  useListBankWallets,
} from '@workspace/api-client-react';

const field = 'h-10 w-full rounded-lg border border-[#dfe6eb] bg-white px-3 text-[12px] text-[#344b64] outline-none focus:border-[#77aeb0] focus:ring-2 focus:ring-[#77aeb0]/15';
export function VaultFundingForm({ vaultAccessActive }: { vaultAccessActive: boolean }) {
  const { user } = useUser();
  const client = useQueryClient();
  const wallets = useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } });
  const createRequest = useCreateLedgerRequest();
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fundingKeyRef = useRef<string | null>(null);
  const fundingKeyOwnerRef = useRef<string | null>(null);
  const fundableWallets = (wallets.data ?? []).filter(wallet =>
    wallet.status === 'active' && ['USD', 'EUR', 'GBP', 'CAD'].includes(wallet.currency),
  );

  const idempotencyKey = () => {
    if (!user?.id) throw new Error('Your sign-in session is not ready. Refresh and try again.');
    if (fundingKeyOwnerRef.current !== user.id) {
      fundingKeyRef.current = null;
      fundingKeyOwnerRef.current = user.id;
    }
    const fundingKeyStorage = `globus-bank-vault-funding-idempotency:${user.id}`;
    if (fundingKeyRef.current) return fundingKeyRef.current;
    let key = '';
    try { key = sessionStorage.getItem(fundingKeyStorage) ?? ''; } catch { /* Keep an in-memory key if browser storage is unavailable. */ }
    if (!key) {
      key = crypto.randomUUID();
      try { sessionStorage.setItem(fundingKeyStorage, key); } catch { /* The request remains idempotent for this page session. */ }
    }
    fundingKeyRef.current = key;
    return key;
  };

  const clearIdempotencyKey = () => {
    fundingKeyRef.current = null;
    const fundingKeyStorage = `globus-bank-vault-funding-idempotency:${user?.id ?? 'pending'}`;
    try { sessionStorage.removeItem(fundingKeyStorage); } catch { /* The in-memory key is still cleared. */ }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!vaultAccessActive) {
      setError('An active Private Vault entitlement is required to add funds.');
      return;
    }
    if (!user?.id) {
      setError('Your sign-in session is not ready. Refresh and try again.');
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError('Enter your six-digit transaction PIN.');
      return;
    }
    if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    try {
      const result = await createRequest.mutateAsync({
        data: {
          type: 'deposit',
          currency: currency as 'USD' | 'EUR' | 'GBP' | 'CAD',
          amount,
          description: description.trim() || undefined,
          idempotencyKey: idempotencyKey(),
          transactionPin: pin,
        },
      });
      if (result.status === 'approved') {
        clearIdempotencyKey();
        setAmount('');
        setDescription('');
        setPin('');
        await Promise.all([
          client.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() }),
          client.invalidateQueries({ queryKey: getListBankWalletsQueryKey() }),
          client.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() }),
        ]);
        setMessage(`Internal ledger credit posted. Reference ${result.reference}. Your balances and activity are refreshed.`);
      } else {
        setMessage(`Request ${result.reference} is ${result.status.replaceAll('_', ' ')}. Your account will show updates when it is approved.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The funding request could not be submitted.');
    }
  };

  return (
    <section className="mt-3 rounded-xl border border-[#d9e8e9] bg-[#f6faf9] p-4" data-testid="vault-wallet-funding">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#43888e]"><ArrowUpRight size={16} /></span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#55868b]">Wallet funding</p>
          <h3 className="mt-1 text-[13px] font-bold text-[#29425c]">Add funds to a wallet</h3>
          <p className="mt-1 text-[10px] leading-4 text-[#718296]">A valid paid subscription or admin grant, eligible account and wallet, and your transaction PIN are required. This records a balanced Globus ledger entry; it does not move money from an external bank.</p>
        </div>
      </div>
      {wallets.isLoading ? <div className="mt-4 h-10 animate-pulse rounded-lg bg-[#e9f0f0]" /> :
        wallets.isError ? <div className="mt-3 flex items-center justify-between rounded-lg border border-[#eadfda] bg-white px-3 py-2 text-[10px] text-[#a24940]" role="alert"><span>Wallets could not be loaded.</span><button type="button" onClick={() => void wallets.refetch()} className="font-bold underline">Retry</button></div> :
          <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="form-vault-funding">
            <label className="text-[9px] font-bold text-[#5c7085]">Wallet currency
              <select required value={currency} onChange={event => setCurrency(event.target.value)} className={`${field} mt-1`} data-testid="select-funding-currency">
                {(wallets.data ?? []).filter(wallet => ['USD', 'EUR', 'GBP', 'CAD'].includes(wallet.currency)).map(wallet => <option key={wallet.id} value={wallet.currency} disabled={wallet.status !== 'active'}>{wallet.currency}{wallet.status !== 'active' ? ' · restricted' : ''}</option>)}
              </select>
            </label>
            <label className="text-[9px] font-bold text-[#5c7085]">Amount
              <input required type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} className={`${field} mt-1`} data-testid="input-funding-amount" />
            </label>
            <label className="text-[9px] font-bold text-[#5c7085] sm:col-span-2">Label or note
              <input maxLength={140} value={description} onChange={event => setDescription(event.target.value)} className={`${field} mt-1`} placeholder="Add a label for your ledger history" data-testid="input-funding-description" />
            </label>
            <label className="text-[9px] font-bold text-[#5c7085] sm:col-span-2">Six-digit transaction PIN
              <input required type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={`${field} mt-1 sm:max-w-[260px]`} data-testid="input-funding-pin" />
            </label>
            {!fundableWallets.length && <p className="text-[10px] text-[#a24940] sm:col-span-2">No eligible active wallet is available for funding.</p>}
            {error && <p role="alert" className="rounded-lg bg-[#fff1ef] px-3 py-2 text-[10px] text-[#a24940] sm:col-span-2">{error}</p>}
            {message && <p role="status" className="rounded-lg bg-[#edf7f1] px-3 py-2 text-[10px] text-[#39745d] sm:col-span-2">{message}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
              <p className="inline-flex items-center gap-1.5 text-[9px] text-[#758797]"><ShieldCheck size={13} /> Securely checked by Globus ledger</p>
              <button type="submit" disabled={!vaultAccessActive || !fundableWallets.length || !fundableWallets.some(wallet => wallet.currency === currency) || createRequest.isPending} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#173858] px-4 text-[10px] font-bold text-white hover:bg-[#214b70] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-submit-funding">
                {createRequest.isPending ? 'Submitting…' : 'Add funds'}
              </button>
            </div>
            {!vaultAccessActive && <p className="text-[9px] text-[#8a784c] sm:col-span-2">A valid Vault subscription or admin grant is required before wallet funding.</p>}
          </form>}
    </section>
  );
}
