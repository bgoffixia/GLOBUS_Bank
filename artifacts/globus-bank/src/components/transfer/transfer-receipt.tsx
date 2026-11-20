import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeftRight, BadgeCheck, CalendarDays, Clock3, Download, Hash, ImageDown, Printer, ShieldCheck, X } from 'lucide-react';
import type { BankTransaction, InternationalTransferRequest } from '@workspace/api-client-react';
import { destinationCurrencyDigits } from '@/lib/destination-currency';
import { downloadTransactionReceiptPdf, saveTransactionReceiptPng } from '@/lib/transaction-receipt-pdf';

export type ReceiptConversion = {
  sourceAmount: string;
  sourceCurrency: string;
  exchangeRate: string;
  destinationAmount: string;
  destinationCurrency: string;
};
export type ReceiptTransaction = BankTransaction & {
  conversion?: ReceiptConversion;
  sender?: { name: string; walletLast4: string };
  recipient?: {
    name: string;
    bank: string;
    country: string;
    route: string;
    account: string;
    transferType: string;
    routingCode: string | null;
    swiftBic: string | null;
    remark: string;
  };
};

export function digitsFor(currency: string): number {
  try { return destinationCurrencyDigits(currency); } catch { return 2; }
}

/** Formats with the currency's natural minor digits unless the raw string carries more precision. */
export function formatAmount(amount: string | number, currency: string): string {
  const raw = String(amount);
  const rawDigits = (raw.split('.')[1] ?? '').length;
  const digits = Math.max(digitsFor(currency), Math.min(rawDigits, 4));
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(raw));
  } catch {
    return `${currency} ${Number(raw).toFixed(digits)}`;
  }
}

export function formatRate(rate: string): string {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(rate.trim());
  if (!m) return rate;
  const int = m[1].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = (m[2] ?? '').replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

export function humanizeStatus(value?: string | null) {
  return value ? value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Not available';
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export function parseReceiptConversion(t: ReceiptTransaction): ReceiptConversion | null {
  if (t.conversion) return t.conversion;
  if (t.type !== 'external_transfer' || !t.description) return null;
  const m = /(?:^| · )(\d+(?:\.\d{1,2})?) ([A-Z]{3}) converted to (\d+(?:\.\d{1,4})?) ([A-Z]{3}) at (\d+(?:\.\d{1,10})?)(?:$| · )/.exec(t.description);
  if (!m) return null;
  return { sourceAmount: m[1], sourceCurrency: m[2], destinationAmount: m[3], destinationCurrency: m[4], exchangeRate: m[5] };
}

export function receiptFromRequest(r: InternationalTransferRequest): ReceiptTransaction {
  const typeLabel = r.transferType === 'local_routing' ? 'Local routing' : 'International wire';
  return {
    id: r.id,
    reference: r.reference,
    type: 'external_transfer',
    status: r.status,
    receiptTemplate: r.receiptTemplate,
    currency: r.sourceCurrency,
    amount: r.sourceAmount,
    fee: '0.00',
    counterparty: `${r.recipientBank} · ****${r.recipientAccountLast4} · ${r.destinationCountry}`,
    description: `${typeLabel} transfer · ${r.sourceAmount} ${r.sourceCurrency} converted to ${r.destinationAmount} ${r.destinationCurrency} at ${r.exchangeRate}`,
    mode: 'internal_ledger',
    createdAt: r.createdAt,
    conversion: { sourceAmount: r.sourceAmount, sourceCurrency: r.sourceCurrency, exchangeRate: r.exchangeRate, destinationAmount: r.destinationAmount, destinationCurrency: r.destinationCurrency },
    sender: {
      name: r.senderName || 'Globus member',
      walletLast4: r.sourceWalletLast4,
    },
    recipient: {
      name: r.recipientAccountName,
      bank: r.recipientBank,
      country: r.destinationCountry,
      route: typeLabel,
      account: `••••••${r.recipientAccountLast4}`,
      transferType: r.transferType,
      routingCode: r.routingCode,
      swiftBic: r.swiftBic,
      remark: r.remark,
    },
  } as ReceiptTransaction;
}

export function TransferReceiptModal({ transaction, onClose, title, notice }: { transaction: ReceiptTransaction; onClose: () => void; title?: string; notice?: string }) {
  const [exporting, setExporting] = useState<'pdf' | 'png' | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const printRef = useRef<HTMLElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [receiptFit, setReceiptFit] = useState({ scale: 1, height: 0 });
  onCloseRef.current = onClose;
  const conversion = parseReceiptConversion(transaction);
  const completed = transaction.status === 'completed';
  const pending = transaction.status === 'pending';
  const isTransfer = transaction.type === 'external_transfer';
  const heading = title ?? (isTransfer ? 'Routed transfer' : humanizeStatus(transaction.type));
  const template = transaction.receiptTemplate ?? 'standard';
  const templateTitle = {
    standard: 'Payment receipt',
    bank_grade: 'Bank transaction record',
    journey: 'Transfer journey',
    ledger: 'Transfer ledger',
    statement: 'Transaction statement',
  }[template];
  const darkMasthead = template === 'journey' || template === 'ledger' || template === 'statement';

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('keydown', esc); prev?.focus?.(); };
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const documentHeight = printRef.current?.scrollHeight ?? 0;
      const actionHeight = actionsRef.current?.offsetHeight ?? 0;
      if (!documentHeight) return;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const availableHeight = Math.max(0, Math.min(viewportHeight * 0.8, viewportHeight - 24) - actionHeight);
      const scale = Math.min(0.86, availableHeight / documentHeight);
      setReceiptFit(current => {
        const height = Math.ceil(documentHeight * scale);
        return current.scale === scale && current.height === height ? current : { scale, height };
      });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (printRef.current) observer?.observe(printRef.current);
    if (actionsRef.current) observer?.observe(actionsRef.current);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [downloadError]);

  const exportData = () => ({
    reference: transaction.reference,
    receiptTemplate: template,
    amount: formatAmount(transaction.amount, transaction.currency),
    status: humanizeStatus(transaction.status),
    date: formatDateTime(transaction.createdAt),
    description: transaction.description || heading,
    counterparty: transaction.counterparty || 'Globus account',
    activity: heading,
    sourceAmount: conversion ? formatAmount(conversion.sourceAmount, conversion.sourceCurrency) : undefined,
    exchangeRate: conversion ? `1 ${conversion.sourceCurrency} = ${formatRate(conversion.exchangeRate)} ${conversion.destinationCurrency}` : undefined,
    convertedAmount: conversion ? formatAmount(conversion.destinationAmount, conversion.destinationCurrency) : undefined,
    recipient: transaction.recipient?.name,
    senderName: transaction.sender?.name,
    senderWallet: transaction.sender ? `••••••${transaction.sender.walletLast4}` : undefined,
    recipientBank: transaction.recipient?.bank,
    recipientCountry: transaction.recipient?.country,
    recipientAccount: transaction.recipient?.account,
    routingNumber: transaction.recipient?.transferType === 'local_routing' ? transaction.recipient.routingCode ?? undefined : undefined,
    swiftBic: transaction.recipient?.transferType === 'international_wire' ? transaction.recipient.swiftBic ?? undefined : undefined,
    remark: transaction.recipient?.remark || transaction.description || heading,
    fee: formatAmount(transaction.fee, transaction.currency),
  });

  const downloadPdf = async () => {
    setDownloadError('');
    setExporting('pdf');
    try {
      if (!completed) throw new Error('PDF receipts are available for completed transactions only.');
      await downloadTransactionReceiptPdf(exportData(), `${import.meta.env.BASE_URL}globus-wordmark-transparent.png`);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'The PDF receipt could not be downloaded.');
    } finally {
      setExporting(null);
    }
  };

  const downloadPng = async () => {
    setDownloadError('');
    setExporting('png');
    try {
      if (!completed) throw new Error('PNG receipts are available for completed transactions only.');
      await saveTransactionReceiptPng(exportData(), `${import.meta.env.BASE_URL}globus-wordmark-transparent.png`);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'The PNG receipt could not be saved.');
    } finally {
      setExporting(null);
    }
  };

  const Row = ({ label, value, testId, strong, mono }: { label: string; value: string; testId?: string; strong?: boolean; mono?: boolean }) => (
    <div className="flex items-start justify-between gap-4 border-b border-[#e9edf0] py-2 last:border-0">
      <dt className="shrink-0 text-[10px] font-medium text-[#8291a0]">{label}</dt>
      <dd data-testid={testId} className={`min-w-0 break-words text-right text-[10px] ${mono ? 'font-mono' : ''} ${strong ? 'font-bold text-[#246d69]' : 'font-semibold text-[#344b63]'}`}>{value}</dd>
    </div>
  );

  return (
    <div className="receipt-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#dce5eb]/85 p-2 backdrop-blur-sm sm:p-3" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="receipt-title" data-testid="dialog-transfer-receipt" className="receipt-dialog relative flex w-full max-w-[460px] flex-col overflow-hidden rounded-[20px] border border-[#d9e2e7] bg-[#fffefa] shadow-[0_22px_65px_rgba(14,40,61,.22)]">
        <div data-testid="receipt-document-frame" className="receipt-document-frame w-full shrink-0" style={{ height: `${receiptFit.height}px` }}>
          <article
            ref={printRef}
            data-testid="receipt-document"
            data-receipt-template={template}
            className={`receipt-print w-full text-[#203a54] ${template === 'statement' ? 'bg-[#fcfcf7]' : 'bg-[#fffefa]'}`}
            style={{ transform: `scale(${receiptFit.scale})`, transformOrigin: 'top center' }}
          >
            <header className={`px-5 pb-4 pt-4 sm:px-6 ${darkMasthead ? `text-white ${template === 'ledger' ? 'bg-[#173c4b]' : 'bg-[#173951]'}` : 'text-[#203a54]'}`}>
              <div className={`flex items-center justify-between border-b pb-3 ${darkMasthead ? 'border-white/15' : 'border-[#e8ecee]'}`}>
                <img src={`${import.meta.env.BASE_URL}globus-wordmark-transparent.png`} alt="Globus Bank" className={`h-auto w-[104px] ${darkMasthead ? 'brightness-0 invert' : ''}`} />
                <button ref={closeRef} type="button" aria-label="Close receipt" data-testid="button-close-receipt" onClick={onClose} className={`receipt-screen-only grid h-8 w-8 place-items-center rounded-full border transition ${darkMasthead ? 'border-white/20 text-white/80 hover:bg-white/10' : 'border-[#e1e8eb] text-[#607589] hover:bg-[#f1f6f7]'}`}><X size={15} /></button>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-[9px] font-bold uppercase tracking-[.18em] ${darkMasthead ? 'text-[#a9c7bd]' : 'text-[#478783]'}`}>
                    {template === 'statement' ? 'Payments & settlements · official Globus record' : template === 'journey' ? 'Transfer record · Globus ledger' : template === 'ledger' ? 'Globus ledger · transfer record' : 'Globus Bank · transaction record'}
                  </p>
                  <h2 id="receipt-title" className={`bank-display mt-1 text-[19px] font-bold tracking-[-.045em] ${darkMasthead ? 'text-white' : 'text-[#183450]'}`}>{templateTitle}</h2>
                  <p className={`mt-0.5 text-[10px] ${darkMasthead ? 'text-white/70' : 'text-[#7d8d9b]'}`}>{heading}</p>
                </div>
                <span data-testid="text-receipt-status" className={`mb-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold ${completed ? 'border-[#d5e7dc] bg-[#eff7f2] text-[#47755f]' : pending ? 'border-[#eadfbf] bg-[#fbf7eb] text-[#8b7440]' : 'border-[#f1d8d5] bg-[#fbefed] text-[#9c4d46]'}`}>
                  {completed ? <BadgeCheck size={11} /> : <Clock3 size={11} />}
                  {completed ? 'RECORDED IN GLOBUS' : pending ? 'PENDING REVIEW' : humanizeStatus(transaction.status).toUpperCase()}
                </span>
              </div>
              {template === 'statement' && <p className="mt-2 text-right font-mono text-[8px] uppercase tracking-[.08em] text-white/65">Statement date · {formatDateTime(transaction.createdAt)}</p>}
            </header>
            <div className="space-y-3 px-5 pb-3 pt-3 sm:px-6">
              <section className={`rounded-[15px] border p-4 ${template === 'statement' ? 'border-[#dce5dc] bg-[#f1f5ef]' : template === 'journey' ? 'border-[#dce8e4] bg-[#f5f8f4]' : template === 'bank_grade' ? 'border-[#dce5e8] bg-[#173858] text-white' : template === 'ledger' ? 'border-[#d9e5dd] bg-[#eff4ed]' : 'border-[#dce5e8] bg-[#173858] text-white'}`} aria-label="Transfer amount summary">
                <p className={`text-[8px] font-bold uppercase tracking-[.16em] ${template === 'standard' || template === 'bank_grade' ? 'text-[#a9d6d3]' : 'text-[#718b81]'}`}>
                  {template === 'statement' ? 'Settlement particulars' : template === 'ledger' ? 'Ledger amount summary' : 'Transaction amount · internal record'}
                </p>
                {template === 'journey' && conversion ? <div className="mt-2 grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="min-w-0"><p className="text-[7px] font-bold uppercase tracking-[.1em] text-[#819293]">Source</p><p data-testid="text-receipt-amount" className="bank-display mt-1 break-words text-[17px] font-bold">{formatAmount(conversion.sourceAmount, conversion.sourceCurrency)}</p><p data-testid="text-receipt-source-amount" className="sr-only">{formatAmount(conversion.sourceAmount, conversion.sourceCurrency)}</p></div>
                  <ArrowLeftRight size={13} className="text-[#548f80]" />
                  <div className="min-w-0 text-right"><p className="text-[7px] font-bold uppercase tracking-[.1em] text-[#819293]">Calculated destination</p><p data-testid="text-receipt-converted-total" className="bank-display mt-1 break-words text-[17px] font-bold text-[#347c78]">{formatAmount(conversion.destinationAmount, conversion.destinationCurrency)}</p></div>
                </div> : <p data-testid="text-receipt-amount" className="bank-display mt-1 break-words text-[25px] font-bold tracking-[-.04em]">{formatAmount(transaction.amount, transaction.currency)}</p>}
                {template !== 'journey' && conversion && <div className={`mt-3 grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t pt-3 ${template === 'standard' || template === 'bank_grade' ? 'border-white/15' : 'border-[#dbe5df]'}`}>
                  <div className="min-w-0"><p className={`text-[7px] font-bold uppercase tracking-[.1em] ${template === 'standard' || template === 'bank_grade' ? 'text-[#a9c0d1]' : 'text-[#82928e]'}`}>Source amount</p><p data-testid="text-receipt-source-amount" className="mt-0.5 break-words text-[10px] font-semibold">{formatAmount(conversion.sourceAmount, conversion.sourceCurrency)}</p></div>
                  <ArrowLeftRight size={13} className="text-[#d4bc76]" />
                  <div className="min-w-0 text-right"><p className={`text-[7px] font-bold uppercase tracking-[.1em] ${template === 'standard' || template === 'bank_grade' ? 'text-[#a9c0d1]' : 'text-[#82928e]'}`}>Calculated destination</p><p data-testid="text-receipt-converted-total" className="mt-0.5 break-words text-[10px] font-semibold">{formatAmount(conversion.destinationAmount, conversion.destinationCurrency)}</p></div>
                </div>}
                {conversion && <p data-testid="text-receipt-exchange-rate" className={`mt-2 break-words text-[8px] ${template === 'standard' || template === 'bank_grade' ? 'text-[#c2d2dd]' : 'text-[#71868a]'}`}>Rate recorded: 1 {conversion.sourceCurrency} = {formatRate(conversion.exchangeRate)} {conversion.destinationCurrency}</p>}
              </section>

              {template === 'bank_grade' && transaction.recipient && <section className="rounded-xl border border-[#e4e9eb] bg-white p-3" aria-label="Transfer recipient">
                <p className="text-[8px] font-bold uppercase tracking-[.16em] text-[#8291a0]">Recipient details on record</p>
                <div className="mt-2 flex min-w-0 items-center gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eef5f5] text-[#397b7b]"><ShieldCheck size={15} /></div>
                  <div className="min-w-0 flex-1"><p className="break-words text-[10px] font-bold text-[#263f58]">{transaction.recipient.name}</p><p className="mt-0.5 break-words text-[8px] text-[#7b8b9b]">{transaction.recipient.bank} · {transaction.recipient.country}</p></div>
                  <p className="shrink-0 font-mono text-[8px] font-semibold text-[#526a80]">{transaction.recipient.account}</p>
                </div>
              </section>}

              {template === 'journey' && <section className="rounded-xl border border-[#dce8e4] bg-white px-3 py-2.5" aria-label="Transfer journey">
                <h3 className="mb-2 text-[8px] font-bold uppercase tracking-[.13em] text-[#718599]">Transfer journey</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2"><span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#e8f1eb] text-[8px] text-[#397b72]">1</span><div className="min-w-0 flex-1"><p className="text-[9px] font-bold text-[#344e5c]">Request recorded</p><p className="text-[8px] text-[#89999c]">{formatDateTime(transaction.createdAt)}</p></div><span className="max-w-[46%] break-words text-right text-[8px] font-semibold text-[#52697e]">{transaction.sender?.name || 'Globus account'}</span></div>
                  <div className="flex items-start gap-2"><span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#e8f1eb] text-[8px] text-[#397b72]">2</span><div className="min-w-0 flex-1"><p className="text-[9px] font-bold text-[#344e5c]">Destination details recorded</p><p className="text-[8px] text-[#89999c]">{transaction.recipient?.route || 'Transfer route'}</p></div><span className="max-w-[46%] break-words text-right text-[8px] font-semibold text-[#52697e]">{transaction.recipient?.name || transaction.counterparty || 'Globus account'}</span></div>
                  <div className="flex items-start gap-2"><span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[8px] ${completed ? 'bg-[#347c78] text-white' : 'bg-[#fbf7eb] text-[#8b7440]'}`}>3</span><div className="min-w-0 flex-1"><p className="text-[9px] font-bold text-[#344e5c]">Globus status</p><p className="text-[8px] text-[#89999c]">{completed ? 'Recorded in Globus ledger' : pending ? 'Awaiting administrator review' : 'No wallet balance change'}</p></div><span className="max-w-[46%] break-words text-right text-[8px] font-semibold text-[#52697e]">{humanizeStatus(transaction.status)}</span></div>
                </div>
              </section>}

              {template === 'ledger' && <section className="rounded-xl border border-[#dce6df] bg-white px-3 py-2.5" aria-label="Ledger record">
                <div className="flex items-center justify-between gap-2 border-b border-[#e4ebe5] pb-2"><h3 className="text-[8px] font-bold uppercase tracking-[.13em] text-[#718599]">Ledger entries</h3><span className="text-[7px] font-semibold text-[#83928c]">GLOBUS RECORD</span></div>
                <div className="divide-y divide-[#e9eeeb]">
                  <div className="flex items-start justify-between gap-3 py-2"><div><p className="text-[9px] font-bold text-[#344e5c]">Transfer request</p><p className="mt-0.5 text-[8px] text-[#89999c]">{transaction.sender ? `Source wallet · ••••${transaction.sender.walletLast4}` : 'Internal Globus account'}</p></div><strong className="shrink-0 font-mono text-[8px] text-[#52697e]">{formatAmount(transaction.amount, transaction.currency)}</strong></div>
                  {conversion && <div className="flex items-start justify-between gap-3 py-2"><div><p className="text-[9px] font-bold text-[#344e5c]">Conversion reference</p><p className="mt-0.5 break-words text-[8px] text-[#89999c]">1 {conversion.sourceCurrency} = {formatRate(conversion.exchangeRate)} {conversion.destinationCurrency}</p></div><strong className="shrink-0 font-mono text-[8px] text-[#52697e]">{formatAmount(conversion.destinationAmount, conversion.destinationCurrency)}</strong></div>}
                  <div className="flex items-start justify-between gap-3 py-2"><div><p className="text-[9px] font-bold text-[#344e5c]">Posting status</p><p className="mt-0.5 text-[8px] text-[#89999c]">{completed ? 'Ledger posting recorded' : pending ? 'No balance change while review is pending' : 'No wallet balance change'}</p></div><strong className="shrink-0 text-[8px] text-[#52697e]">{humanizeStatus(transaction.status)}</strong></div>
                </div>
              </section>}

              {template === 'statement' && <div className="flex items-center justify-between border-y border-[#dce5dc] py-2 text-[8px]"><span className="font-bold uppercase tracking-[.12em] text-[#718b81]">01 · Transaction status</span><span className="font-semibold text-[#38545a]">{completed ? 'Recorded in Globus' : pending ? 'Pending review' : 'Not posted'}</span></div>}

              <section className={`rounded-xl border px-3 ${template === 'statement' ? 'border-[#dce5dc] bg-white' : 'border-[#e4e9eb] bg-white'}`}>
                <div className={`flex items-center gap-1.5 border-b border-[#e9edf0] py-2 text-[8px] font-bold uppercase tracking-[.14em] text-[#718599] ${template === 'statement' ? 'justify-between' : ''}`}>
                  {template === 'statement' && <span className="font-mono text-[#779387]">02</span>}<span className="inline-flex items-center gap-1.5"><Hash size={11} className="text-[#528c89]" />{template === 'statement' ? 'Record details' : 'Transaction details'}</span>
                </div>
                <dl>
                  <Row label="Reference" value={transaction.reference} testId="text-receipt-reference" strong mono />
                  {transaction.sender && <>
                    <Row label="Sender" value={transaction.sender.name} />
                    <Row label="Source wallet" value={`••••••${transaction.sender.walletLast4}`} mono />
                  </>}
                  {transaction.recipient ? <>
                    <Row label="Destination bank" value={transaction.recipient.bank} />
                    <Row label="Country" value={transaction.recipient.country} />
                    <Row label="Recipient account / IBAN" value={transaction.recipient.account} mono />
                    <Row label="Recipient name" value={transaction.recipient.name} />
                    {transaction.recipient.transferType === 'local_routing' && transaction.recipient.routingCode && <Row label="Routing number" value={transaction.recipient.routingCode} mono />}
                    {transaction.recipient.transferType === 'international_wire' && transaction.recipient.swiftBic && <Row label="SWIFT / BIC" value={transaction.recipient.swiftBic} mono />}
                    <Row label="Remark / description" value={transaction.recipient.remark || transaction.description || heading} />
                  </> : <Row label="Counterparty" value={transaction.counterparty || 'Globus account'} />}
                  <Row label="Date / time" value={formatDateTime(transaction.createdAt)} />
                  {!transaction.recipient && <Row label="Fee" value={formatAmount(transaction.fee, transaction.currency)} />}
                </dl>
              </section>
              <div className="flex items-center gap-2 border-t border-dashed border-[#dfe6e9] pt-2">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#edf5f1] text-[#4a826d]"><ShieldCheck size={13} /></div>
                <p className="min-w-0 text-[8px] leading-4 text-[#7d8c98]">{template === 'statement' ? 'This statement is a Globus internal ledger record. It does not confirm settlement by an outside bank or payment service.' : 'Recorded by Globus Bank · This receipt does not confirm settlement through an outside bank or payment service.'}</p>
                <CalendarDays size={12} className="ml-auto shrink-0 text-[#8da0ab]" />
              </div>
            </div>
          </article>
        </div>
        <div ref={actionsRef} className="receipt-actions shrink-0 border-t border-[#e7ecee] bg-[#fafbf9] px-3 py-2.5 sm:px-5">
          {notice && <p role="status" data-testid="status-recipient-email-notice" className="mb-2 rounded-lg border border-[#eadfbf] bg-[#fbf7eb] px-3 py-2 text-left text-[10px] leading-4 text-[#806b3d]">{notice}</p>}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" data-testid="button-save-receipt-png" aria-label="Save receipt PNG to device or gallery" disabled={exporting !== null || !completed} onClick={downloadPng} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dbe4e8] bg-white px-2.5 py-2 text-[9px] font-bold text-[#456179] hover:bg-[#f4f8f9] disabled:cursor-not-allowed disabled:opacity-50"><ImageDown size={13} />{exporting === 'png' ? 'Preparing image…' : 'Save PNG'}</button>
            <button type="button" data-testid="button-download-receipt-pdf" disabled={exporting !== null || !completed} onClick={downloadPdf} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dbe4e8] bg-white px-2.5 py-2 text-[9px] font-bold text-[#456179] hover:bg-[#f4f8f9] disabled:cursor-not-allowed disabled:opacity-50"><Download size={13} />{exporting === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}</button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#173858] px-3 py-2 text-[9px] font-bold text-white hover:bg-[#21496c]"><Printer size={13} /> Print</button>
          </div>
          {downloadError && <p role="alert" data-testid="status-receipt-download-error" className="mt-1 text-right text-[9px] text-[#a24940]">{downloadError}</p>}
          <p className="mt-1 text-right text-[8px] text-[#8794a2]">On supported phones, choose “Save Image” to add the PNG to your gallery.</p>
        </div>
      </section>
    </div>
  );
}
