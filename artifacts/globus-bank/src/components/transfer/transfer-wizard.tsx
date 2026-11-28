import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, ArrowLeft, ArrowRight, Delete, Globe2, Landmark, LockKeyhole, RefreshCw, UserRound } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  getGetBankDashboardQueryKey,
  getGetBankExchangeRateQuoteQueryKey,
  getGetBankVaultTransferEmailAlertQueryKey,
  getGetBankProfileQueryKey,
  getListBankNotificationsQueryKey,
  getListBankTransactionsQueryKey,
  getListBankWalletsQueryKey,
  getListInternationalTransferRequestsQueryKey,
  useCreateInternationalTransferRequest,
  useGetBankExchangeRateQuote,
  useGetBankProfile,
  useGetBankVaultTransferEmailAlert,
  useListBankWallets,
} from '@workspace/api-client-react';
import type { InternationalTransferRequestInput } from '@workspace/api-client-react';
import { BankSelect } from '@/components/bank-select';
import { CountrySelect } from '@/components/country-select';
import { countries } from '@/lib/countries';
import { currencyLabel, destinationCurrencies, destinationCurrencyForCountry } from '@/lib/destination-currency';
import { previewConversion } from '@/lib/currency-conversion';
import { digitsFor, formatAmount, formatRate, TransferReceiptModal } from './transfer-receipt';
import { receiptFromRequest, type ReceiptTransaction } from '@/lib/transfer-receipt-data';
import { useLanguage } from '@/lib/i18n';

type TransferType = 'local_routing' | 'international_wire';
type SourceCurrency = InternationalTransferRequestInput['sourceCurrency'];
const sourceCurrencies = ['USD', 'EUR', 'GBP', 'CAD'] as const;
const STEPS = ['Details', 'Amount & review', 'PIN'] as const;
const GUIDE = [
  'Add the destination and recipient details for this transfer.',
  'Set the amount, review the conversion and confirm the recipient details.',
  'Enter your six-digit transaction PIN to submit.',
];
const SWIFT_RE = /^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/;
const AMOUNT_RE = /^\d{1,12}(\.\d{1,2})?$/;

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function InternationalTransferPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const profile = useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey() } });
  const emailAlertPreference = useGetBankVaultTransferEmailAlert({
    query: {
      queryKey: getGetBankVaultTransferEmailAlertQueryKey(),
      retry: false,
      staleTime: 0,
      refetchOnMount: 'always',
    },
  });
  const wallets = useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } });
  const createRequest = useCreateInternationalTransferRequest();

  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [transferType, setTransferType] = useState<TransferType>(params.get('type') === 'international_wire' ? 'international_wire' : 'local_routing');
  const [step, setStep] = useState(0);
  const [sourceCurrency, setSourceCurrency] = useState<SourceCurrency>(() => {
    const requested = params.get('currency');
    return sourceCurrencies.find(currency => currency === requested) ?? 'USD';
  });
  const [destinationCountry, setDestinationCountry] = useState('');
  const [recipientBank, setRecipientBank] = useState('');
  const [destinationCurrency, setDestinationCurrency] = useState(() => {
    const requested = (params.get('destinationCurrency') ?? '').toUpperCase();
    return destinationCurrencies.includes(requested) ? requested : '';
  });
  const [recipientAccountName, setRecipientAccountName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientAccountNumber, setRecipientAccountNumber] = useState('');
  const [routingCode, setRoutingCode] = useState('');
  const [swiftBic, setSwiftBic] = useState('');
  const [remark, setRemark] = useState('');
  const [amount, setAmount] = useState(() => {
    const requested = params.get('amount') ?? '';
    return AMOUNT_RE.test(requested) ? requested : '';
  });
  const [confirmationFingerprint, setConfirmationFingerprint] = useState<string | null>(null);
  const [rateSnapshot, setRateSnapshot] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [receipt, setReceipt] = useState<ReceiptTransaction | null>(null);
  const keyRef = useRef<{ fp: string; key: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const pending = createRequest.isPending;
  const pinConfigured = profile.data?.transactionPinConfigured !== false;
  const recipientEmailAlertsEnabled =
    emailAlertPreference.data?.enabled === true;
  const walletList = (wallets.data ?? []).filter(
    (w): w is typeof w & { currency: SourceCurrency } =>
      sourceCurrencies.includes(w.currency as SourceCurrency),
  );
  const wallet = walletList.find(w => w.currency === sourceCurrency);
  const available = Number(wallet?.available ?? 0);
  const countryCode = countries.find(c => c.name === destinationCountry)?.code ?? '';
  const targetDigits = destinationCurrency ? digitsFor(destinationCurrency) : 2;
  const quoteParams = { sourceCurrency, destinationCurrency };
  const quote = useGetBankExchangeRateQuote(quoteParams, {
    query: {
      queryKey: getGetBankExchangeRateQuoteQueryKey(quoteParams),
      enabled: !!destinationCurrency,
      retry: false,
      refetchInterval: 15 * 60_000,
      refetchOnWindowFocus: true,
      staleTime: 12 * 60_000,
    },
  });

  useEffect(() => {
    if (walletList.length && !walletList.some(w => w.currency === sourceCurrency)) setSourceCurrency(walletList[0].currency);
  }, [walletList, sourceCurrency]);
  useEffect(() => {
    if (!recipientEmailAlertsEnabled) setRecipientEmail('');
  }, [recipientEmailAlertsEnabled]);

  const liveRate = quote.isError ? null : quote.data?.rate ?? null;
  const liveConverted = liveRate && AMOUNT_RE.test(amount) ? previewConversion(amount, liveRate, targetDigits) : null;
  const snapshotConverted = rateSnapshot && AMOUNT_RE.test(amount) ? previewConversion(amount, rateSnapshot, targetDigits) : null;
  const rateChanged = rateSnapshot !== null && liveRate !== null && formatRate(liveRate) !== formatRate(rateSnapshot);
  const rateLost = rateSnapshot !== null && liveRate === null && !quote.isLoading;
  const amountCanBeConfirmed =
    AMOUNT_RE.test(amount) &&
    Number(amount) > 0 &&
    Number(amount) <= available &&
    !!liveRate &&
    liveConverted !== null &&
    Number(liveConverted) > 0 &&
    !!rateSnapshot &&
    !rateChanged &&
    !rateLost &&
    wallet?.status !== 'restricted';

  const fingerprint = JSON.stringify([transferType, sourceCurrency, destinationCountry, recipientBank, destinationCurrency, recipientAccountName.trim(), recipientEmail.trim().toLowerCase(), recipientAccountNumber.replace(/\s/g, ''), transferType === 'local_routing' ? routingCode.trim() : swiftBic.toUpperCase(), remark.trim(), amount, rateSnapshot]);
  const confirmed = confirmationFingerprint !== null && confirmationFingerprint === fingerprint;
  const idempotencyKey = useMemo(() => {
    if (!keyRef.current || keyRef.current.fp !== fingerprint) keyRef.current = { fp: fingerprint, key: newKey() };
    return keyRef.current.key;
  }, [fingerprint]);

  // Returning to recipient details starts a fresh quote and confirmation.
  useEffect(() => {
    if (step === 0) {
      setConfirmationFingerprint(null);
      setRateSnapshot(null);
    }
  }, [step]);
  useEffect(() => {
    if (step === 1 && rateSnapshot === null && liveRate) setRateSnapshot(liveRate);
  }, [step, liveRate, rateSnapshot]);
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [step]);

  const stepValid = [
    !!wallet && !!countryCode && !!recipientBank.trim() && !!destinationCurrency &&
      recipientAccountName.trim().length > 1 &&
      (!recipientEmailAlertsEnabled ||
        !recipientEmail.trim() ||
        (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim()) &&
          recipientEmail.trim().length <= 254)) &&
      /^[A-Za-z0-9 ]{4,34}$/.test(recipientAccountNumber) &&
      (transferType === 'local_routing'
        ? /^[A-Za-z0-9 -]{2,24}$/.test(routingCode.trim())
        : SWIFT_RE.test(swiftBic)),
    amountCanBeConfirmed && confirmed,
    pin.length === 6 && !rateChanged && !rateLost && pinConfigured,
  ];

  const go = (n: number) => { if (!pending) { if (n < 2) setPin(''); setStep(n); } };
  const next = () => {
    if (!stepValid[step]) return;
    if (step === 0) {
      setRateSnapshot(liveRate);
      setConfirmationFingerprint(null);
    }
    go(step + 1);
  };
  const reviewCurrentRate = () => {
    if (liveRate) setRateSnapshot(liveRate);
    setConfirmationFingerprint(null);
    if (step === 2) go(1);
  };
  const switchType = (t: TransferType) => {
    if (pending || t === transferType) return;
    setTransferType(t);
    setStep(0);
    setPin('');
  };
  const selectCountry = (name: string) => {
    setDestinationCountry(name);
    setRecipientBank('');
    const code = countries.find(c => c.name === name)?.code;
    const auto = code ? destinationCurrencyForCountry(code) : undefined;
    setDestinationCurrency(auto ?? '');
  };

  const resetAll = () => {
    setStep(0); setDestinationCountry(''); setRecipientBank(''); setDestinationCurrency(''); setRecipientAccountName(''); setRecipientEmail(''); setRecipientAccountNumber('');
    setRoutingCode(''); setSwiftBic(''); setRemark(''); setAmount(''); setConfirmationFingerprint(null); setRateSnapshot(null); setPin(''); keyRef.current = null;
  };

  const submit = () => {
    if (pending || !stepValid[2] || !rateSnapshot) return;
    createRequest.mutate({
      data: {
        transferType,
        destinationCountry: destinationCountry.trim(),
        recipientBank: recipientBank.trim(),
        ...(transferType === 'local_routing' ? { routingCode: routingCode.trim() } : { swiftBic: swiftBic.trim().toUpperCase() }),
        recipientAccountName: recipientAccountName.trim(),
        ...(recipientEmailAlertsEnabled && recipientEmail.trim()
          ? { recipientEmail: recipientEmail.trim().toLowerCase() }
          : {}),
        recipientAccountNumber,
        sourceCurrency,
        destinationCurrency,
        amount,
        ...(remark.trim() ? { remark: remark.trim() } : {}),
        transactionPin: pin,
        idempotencyKey,
        expectedExchangeRate: rateSnapshot,
      },
    }, {
      onSuccess: request => {
        setPin('');
        setReceipt(receiptFromRequest(request));
        if (request.recipientEmailNotificationSkipped) {
          toast({
            title: 'Transfer recorded',
            description: 'No recipient email alert was sent. The DUTSTAR transfer record is available in Activity.',
            duration: 5000,
          });
        }
        resetAll();
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: getListInternationalTransferRequestsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getListBankNotificationsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() }),
        ]);
      },
      onError: err => {
        setPin('');
        toast({
          title: 'Transfer result could not be confirmed',
          description: err instanceof Error && err.message.trim()
            ? err.message
            : 'Check Activity before retrying. Your entered details are still available.',
          variant: 'destructive',
          duration: 5000,
        });
      },
    });
  };

  if (wallets.isLoading || profile.isLoading) {
    return <div className="min-h-full w-full animate-pulse rounded-[20px] border border-[#e1e8ee] bg-white p-4 sm:p-6"><div className="h-10 rounded-xl bg-[#eef2f5]" /><div className="mt-5 h-3 w-2/3 rounded bg-[#eef2f5]" />{[0, 1, 2, 3].map(i => <div key={i} className="mt-4 h-11 rounded-xl bg-[#f1f4f6]" />)}</div>;
  }
  if (wallets.isError || profile.isError) {
    return <div className="flex min-h-full w-full flex-col items-center justify-center rounded-[20px] border border-[#eadfda] bg-white p-6 text-center"><p className="text-[13px] font-bold text-[#3c4d5e]">Your account details could not be loaded.</p><button type="button" onClick={() => { void wallets.refetch(); void profile.refetch(); }} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#dfe6ea] px-4 py-2.5 text-[10px] font-bold text-[#435b72]"><RefreshCw size={13} /> Try again</button></div>;
  }

  const routeLabel = transferType === 'local_routing' ? 'Local routing' : 'International wire';
  const accountDigits = recipientAccountNumber.replace(/\s/g, '');
  const maskedAccount = `•••• ${accountDigits.slice(-4) || '—'}`;
  const reviewTotal = snapshotConverted ?? liveConverted;

  return (
    <div className="transfer-page flex min-h-full w-full flex-col">
      <div className="mx-auto flex min-h-full w-full flex-1 flex-col py-0">
        <section data-testid="transfer-wizard" aria-labelledby="transfer-step-title" className="flex min-h-full min-w-0 flex-1 flex-col overflow-visible rounded-[20px] border border-[#dfe7ec] bg-white shadow-[0_20px_52px_rgba(22,48,78,.075)]">
          <div className="rounded-t-[20px] border-b border-[#edf1f3] px-3.5 pt-3.5 sm:px-5 sm:pt-4">
            <div role="tablist" aria-label="Transfer route" className="grid grid-cols-2 gap-1 rounded-lg bg-[#f0f3f5] p-1">
              {(['local_routing', 'international_wire'] as const).map(t => (
                <button key={t} type="button" role="tab" aria-selected={transferType === t} disabled={pending} data-testid={`tab-${t.replace('_', '-')}`} onClick={() => switchType(t)} className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md text-[10px] font-bold transition ${transferType === t ? 'bg-white text-[#173452] shadow-sm' : 'text-[#6f8195] hover:text-[#2d4864]'}`}>
                  {t === 'local_routing' ? <Landmark size={13} /> : <Globe2 size={13} />}{t === 'local_routing' ? 'Local routing' : 'International wire'}
                </button>
              ))}
            </div>
            <ol aria-label="Transfer progress" className="mt-3 flex items-center gap-2 pb-3">
              {STEPS.map((label, i) => (
                <li key={label} aria-current={i === step ? 'step' : undefined} className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className={`h-1 rounded-full transition-colors ${i < step ? 'bg-[#3f8a8f]' : i === step ? 'bg-[#173b62]' : 'bg-[#e3e9ed]'}`} />
                  <span className={`truncate text-[8px] font-bold uppercase tracking-[.07em] ${i === step ? 'text-[#173b62]' : 'text-[#9aa7b3]'}`}>{label}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex-1 px-3.5 py-3.5 sm:px-5 sm:py-4">
            <p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#4f8b90]">Step {step + 1} of 3 · {routeLabel}</p>
            <h1 id="transfer-step-title" ref={headingRef} tabIndex={-1} className="bank-display mt-0.5 text-[20px] font-semibold tracking-[-.03em] text-[#18324f] outline-none">{['Recipient & destination', 'Amount & review', 'Authorise with PIN'][step]}</h1>
      <p data-testid="text-transfer-guide" className="mt-0.5 text-[10px] leading-4 text-[#6d7f92]">{t(GUIDE[step])}</p>

            <div className="mt-3 space-y-2.5">
              {step === 0 && <>
                <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">
                  <F label="From wallet" className="sm:col-span-2">
                    <select data-testid="select-source-currency" value={sourceCurrency} onChange={e => setSourceCurrency(e.target.value as SourceCurrency)} className={inputCls}>
                      {walletList.map(w => <option key={w.id} value={w.currency}>{w.currency} wallet · {formatAmount(w.available, w.currency)} available{w.status === 'restricted' ? ' · frozen' : ''}</option>)}
                    </select>
                  </F>
                  <F label="Destination country"><CountrySelect value={destinationCountry} onChange={selectCountry} compact /></F>
                  <F label="Recipient bank"><BankSelect key={countryCode || 'none'} countryCode={countryCode} value={recipientBank} onChange={setRecipientBank} compact /></F>
                  <F label="Account holder"><input data-testid="input-recipient-account-name" maxLength={120} autoComplete="off" value={recipientAccountName} onChange={e => setRecipientAccountName(e.target.value)} placeholder="Name on the account" className={inputCls} /></F>
                  <F label={transferType === 'local_routing' ? 'Account number' : 'Account number / IBAN'}><input data-testid="input-recipient-account-number" maxLength={34} autoComplete="off" value={recipientAccountNumber} onChange={e => setRecipientAccountNumber(e.target.value.replace(/[^A-Za-z0-9 ]/g, ''))} placeholder="Recipient account number" className={`${inputCls} font-mono`} /></F>
                  {transferType === 'local_routing'
                    ? <F label="Routing / clearing code"><input data-testid="input-local-routing-code" maxLength={24} value={routingCode} onChange={e => setRoutingCode(e.target.value.replace(/[^A-Za-z0-9 -]/g, ''))} placeholder="Routing or sort code" className={`${inputCls} font-mono`} /></F>
                    : <F label="SWIFT / BIC" hint={swiftBic && !SWIFT_RE.test(swiftBic) ? 'Use 8 or 11 letters and numbers.' : undefined}><input data-testid="input-swift-bic" maxLength={11} value={swiftBic} onChange={e => setSwiftBic(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="8 or 11 characters" className={`${inputCls} font-mono uppercase`} /></F>}
                  <F label="Recipient receives" hint={destinationCountry && !destinationCurrencyForCountry(countryCode) ? 'Choose a currency for this destination.' : undefined}>
                    <select data-testid="select-destination-currency" value={destinationCurrency} onChange={e => setDestinationCurrency(e.target.value)} className={inputCls}>
                      <option value="">Choose currency</option>
                      {destinationCurrencies.map((c: string) => <option key={c} value={c}>{currencyLabel(c)}</option>)}
                    </select>
                  </F>
                  {recipientEmailAlertsEnabled && <F label="Recipient email (optional)" hint="Status emails are sent only when provided."><input type="email" data-testid="input-recipient-email" maxLength={254} autoComplete="email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="name@example.com" className={inputCls} /></F>}
                  <F label="Reference (optional)"><input data-testid="input-transfer-remark" maxLength={140} value={remark} onChange={e => setRemark(e.target.value)} placeholder="Add a note" className={inputCls} /></F>
                </div>
              </>}

              {step === 1 && <>
                <div className="grid gap-2.5 sm:grid-cols-[minmax(0,.86fr)_minmax(0,1.14fr)]">
                  <F label={`Amount in ${sourceCurrency}`} hint={`Available ${formatAmount(available, sourceCurrency)}`}>
                    <input data-testid="input-international-amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" className={`${inputCls} h-12 text-[18px] font-semibold placeholder:text-[16px]`} />
                  </F>
                  <div data-testid="conversion-quote" aria-live="polite" className="min-w-0 rounded-lg border border-[#d9e7ea] bg-[#f4f8f8] px-3 py-2.5">
                    <p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#4f868b]">Recipient receives</p>
                    {quote.isLoading && !quote.data ? <div className="mt-1.5 h-6 w-32 animate-pulse rounded bg-[#e2ecee]" /> : liveRate ? <>
                      <p data-testid="text-converted-total" className="bank-display mt-0.5 break-words text-[19px] font-semibold text-[#1b3654]">{reviewTotal ? formatAmount(reviewTotal, destinationCurrency) : `— ${destinationCurrency}`}</p>
                      <p data-testid="text-conversion-rate" className="mt-0.5 break-words font-mono text-[9px] text-[#5d7488]">1 {sourceCurrency} = {formatRate(rateSnapshot ?? liveRate)} {destinationCurrency}</p>
                      <p className="mt-0.5 text-[8px] text-[#8996a3]">{quote.data?.provider !== 'Globus' ? `${quote.data?.provider} quote` : 'Same-currency rate · 1:1'}</p>
                    </> : <p data-testid="status-rate-unavailable" className="mt-1 flex items-start gap-1.5 text-[9px] leading-4 text-[#8a6430]"><AlertTriangle size={12} className="mt-0.5 shrink-0" />No rate available for this currency pair.</p>}
                  </div>
                </div>
                {Number(amount) > available && <p role="alert" className="text-[9px] text-[#a24940]">That is more than the available balance.</p>}
                {liveConverted !== null && Number(amount) > 0 && Number(liveConverted) === 0 && <p role="alert" className="text-[9px] text-[#a24940]">Increase the amount so the converted total is at least one destination minor unit.</p>}
                {wallet?.status === 'restricted' && <p role="alert" className="text-[9px] text-[#a24940]">This wallet is restricted; outgoing transfers are unavailable.</p>}
                <RateWarning changed={rateChanged} lost={rateLost} onReview={reviewCurrentRate} />
                <section data-testid="transfer-review" aria-label="Recipient and transfer review" className="rounded-lg border border-[#e1e7eb] bg-white">
                  <div className="flex items-start gap-2.5 border-b border-[#edf1f3] px-3 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#edf4f4] text-[#447d83]"><UserRound size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#758899]">Recipient</p>
                      <p data-testid="text-review-recipient" className="truncate text-[11px] font-bold text-[#29435c]">{recipientAccountName.trim() || 'Recipient name'}</p>
                      <p className="truncate text-[9px] text-[#788a99]">{recipientBank || 'Bank'} · {destinationCountry || 'Destination'}</p>
                    </div>
                    <div className="shrink-0 text-right"><p className="text-[8px] font-semibold text-[#8493a0]">Account</p><p data-testid="text-review-account" className="font-mono text-[9px] font-semibold text-[#536a7f]">{maskedAccount}</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 px-3 py-2.5">
                    <div className="min-w-0"><p className="text-[8px] font-semibold text-[#8493a0]">You send</p><p className="truncate text-[11px] font-bold text-[#344c64]">{amount ? formatAmount(amount, sourceCurrency) : `— ${sourceCurrency}`}</p></div>
                    <div className="min-w-0 text-right"><p className="text-[8px] font-semibold text-[#8493a0]">Recipient gets</p><p data-testid="text-review-converted-total" className="truncate text-[11px] font-bold text-[#286b6c]">{reviewTotal ? formatAmount(reviewTotal, destinationCurrency) : `— ${destinationCurrency || 'currency'}`}</p></div>
                  </div>
                  {recipientEmailAlertsEnabled && recipientEmail.trim() && <p className="border-t border-[#edf1f3] px-3 py-1.5 text-[9px] text-[#738596]">Status email · {recipientEmail.trim()}</p>}
                </section>
                <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 text-[9px] leading-4 ${confirmed ? 'bg-[#eef6f3] text-[#355b59]' : 'bg-[#f5f7f8] text-[#53677b]'}`}>
                  <input data-testid="checkbox-confirm-transfer" type="checkbox" checked={confirmed} disabled={!amountCanBeConfirmed} onChange={e => setConfirmationFingerprint(e.target.checked ? fingerprint : null)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#173b62] disabled:opacity-45" />
                  <span>I confirm the recipient details and converted amount are correct. This is an internal DUTSTAR ledger record; it does not send funds to an outside bank.</span>
                </label>
              </>}

              {step === 2 && <>
                <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[#e1e7eb] bg-[#f7f9fa] px-3 py-2.5">
                  <div className="min-w-0"><p className="truncate text-[10px] font-bold text-[#38516a]">{recipientAccountName.trim()} · {recipientBank}</p><p className="mt-0.5 text-[9px] text-[#728395]">{formatAmount(amount, sourceCurrency)} · {maskedAccount}</p></div>
                  <b className="shrink-0 text-[11px] text-[#286b6c]">{snapshotConverted ? formatAmount(snapshotConverted, destinationCurrency) : ''}</b>
                </div>
                <RateWarning changed={rateChanged} lost={rateLost} onReview={reviewCurrentRate} />
                {!pinConfigured && <p className="rounded-lg border border-[#eadfbe] bg-[#fbf7eb] px-3 py-2.5 text-[9px] leading-4 text-[#806b3d]">Set up your transaction PIN in <Link href="/settings" className="font-bold underline">Settings</Link> first.</p>}
                <PinPad value={pin} onChange={setPin} disabled={pending || !pinConfigured} onSubmit={submit} />
              </>}
            </div>

          </div>

          {!receipt && <div className="mt-auto flex items-center gap-2 rounded-b-[20px] border-t border-[#edf1f3] bg-[#fafbfc] px-3.5 py-2.5 sm:px-5">
            {step > 0 && <button type="button" data-testid="button-transfer-back" disabled={pending} onClick={() => go(step - 1)} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-[#dbe3e8] bg-white px-3.5 text-[10px] font-bold text-[#3e566e] disabled:opacity-50"><ArrowLeft size={13} /> Back</button>}
            {step < 2
              ? <button type="button" data-testid="button-transfer-next" disabled={!stepValid[step]} onClick={next} className="ml-auto inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#142f51] px-4 text-[10px] font-bold text-white transition hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none sm:min-w-[160px]">{step === 1 ? 'Continue to PIN' : 'Continue'} <ArrowRight size={13} /></button>
              : <button type="button" data-testid="button-submit-international-transfer" disabled={!stepValid[2] || pending} onClick={submit} className="ml-auto inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-[#142f51] px-4 text-[10px] font-bold text-white transition hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none sm:min-w-[180px]"><LockKeyhole size={13} /> {pending ? 'Submitting…' : 'Confirm transfer'}</button>}
          </div>}
        </section>
      </div>
      {receipt && <TransferReceiptModal transaction={receipt} onClose={() => setReceipt(null)} title={receipt.status === 'completed' ? 'Transfer completed' : 'Transfer request submitted'} />}
    </div>
  );
}

function F({ label, hint, className = '', children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  const { t } = useLanguage();
  return <div className={`block min-w-0 ${className}`}><span className="mb-1 block text-[9px] font-semibold uppercase tracking-[.06em] text-[#5c7085]">{t(label)}</span>{children}{hint && <span className="mt-0.5 block text-[9px] text-[#8391a0]">{t(hint)}</span>}</div>;
}

function RateWarning({ changed, lost, onReview }: { changed: boolean; lost: boolean; onReview: () => void }) {
  const { t } = useLanguage();
  if (!changed && !lost) return null;
  return <div role="alert" data-testid="status-rate-changed" className="flex items-start justify-between gap-3 rounded-lg border border-[#ecdcb6] bg-[#fcf7ea] px-3 py-2 text-[9px] leading-4 text-[#7d6230]"><span className="flex gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{t(lost ? 'A current quote is unavailable. This transfer cannot be submitted.' : 'The conversion rate changed. Review the new total before continuing.')}</span>{changed && <button type="button" data-testid="button-review-rate" onClick={onReview} className="shrink-0 font-bold underline">{t('Review')}</button>}</div>;
}

function PinPad({ value, onChange, disabled, onSubmit }: { value: string; onChange: (v: string) => void; disabled: boolean; onSubmit: () => void }) {
  const press = (d: string) => { if (!disabled && value.length < 6) onChange(value + d); };
  const back = () => { if (!disabled) onChange(value.slice(0, -1)); };
  return (
    <div
      data-testid="transfer-pin-pad"
      tabIndex={0}
      aria-label="Transaction PIN keypad. Type digits, Backspace to delete, Enter to submit."
      onKeyDown={e => { if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); back(); } else if (e.key === 'Enter' && value.length === 6) { e.preventDefault(); onSubmit(); } }}
      className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#77aeb0]/40"
    >
      <div role="status" aria-label={`${value.length} of 6 digits entered`} data-testid="text-pin-progress" className="flex justify-center gap-2.5 py-2">
        {Array.from({ length: 6 }).map((_, i) => <span key={i} className={`h-3 w-3 rounded-full transition ${i < value.length ? 'scale-110 bg-[#173b62]' : 'border-[0.75px] border-[#d9e1e7] bg-white'}`} />)}
      </div>
      <div className="mx-auto mt-2 grid max-w-[300px] grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <Key key={d} label={d} onClick={() => press(d)} disabled={disabled} />)}
        <Key label="Clear" onClick={() => !disabled && onChange('')} disabled={disabled} small testId="button-pin-clear" />
        <Key label="0" onClick={() => press('0')} disabled={disabled} />
        <button type="button" aria-label="Delete last digit" data-testid="button-pin-delete" disabled={disabled} onClick={back} className="grid h-[51px] place-items-center rounded-xl text-[#4a637b] transition hover:bg-[#eef3f5] active:scale-95 disabled:opacity-40"><Delete size={18} /></button>
      </div>
    </div>
  );
}

function Key({ label, onClick, disabled, small, testId }: { label: string; onClick: () => void; disabled: boolean; small?: boolean; testId?: string }) {
  return <button type="button" data-testid={testId ?? `button-pin-${label}`} disabled={disabled} onClick={onClick} className={`h-[51px] rounded-xl border border-[#e3e9ed] bg-[#fafbfc] font-semibold text-[#1d3754] transition hover:bg-[#eef4f6] active:scale-95 disabled:opacity-40 ${small ? 'text-[10px] uppercase tracking-[.08em]' : 'bank-display text-[18px]'}`}>{label}</button>;
}

const inputCls = 'h-10 w-full min-w-0 rounded-lg border border-[#dfe6eb] bg-white px-3 text-[11px] text-[#344b64] outline-none transition placeholder:text-[10px] placeholder:text-[#a0acb7] focus:border-[#77aeb0] focus:ring-2 focus:ring-[#77aeb0]/15';
