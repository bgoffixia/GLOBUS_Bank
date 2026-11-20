import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { ArrowLeftRight, BadgeCheck, CalendarDays, Clock3, Download, Hash, ImageDown, Printer, ShieldCheck, X } from 'lucide-react';
import { destinationCurrencyDigits } from '@/lib/destination-currency';
import { downloadTransactionReceiptPdf, saveTransactionReceiptPng } from '@/lib/transaction-receipt-pdf';
import type { ReceiptConversion, ReceiptTransaction } from '@/lib/transfer-receipt-data';
import { calculateReceiptFit } from '@/lib/receipt-fit';
import type { ReceiptTemplateId } from '@/lib/receipt-layouts';
export type { ReceiptConversion, ReceiptTransaction } from '@/lib/transfer-receipt-data';

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
  const template: ReceiptTemplateId = transaction.receiptTemplate ?? 'standard';
  const templateTitle = {
    standard: 'Payment receipt',
    bank_payment: 'Bank transaction record',
    transfer_journey: 'Transfer journey',
    transfer_ledger: 'Posting ledger',
    settlement_statement: 'Archival statement',
  }[template];
  const darkMasthead = template === 'transfer_journey' || template === 'transfer_ledger' || template === 'settlement_statement';

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
      const fit = calculateReceiptFit(documentHeight, actionHeight, viewportHeight);
      setReceiptFit(current => {
        return current.scale === fit.scale && current.height === fit.height
          ? current
          : { scale: fit.scale, height: fit.height };
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
  }, [downloadError, template]);

  const exportData = () => ({
    reference: transaction.reference,
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
    template,
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
      <section role="dialog" aria-modal="true" aria-labelledby="receipt-title" data-testid="dialog-transfer-receipt" data-receipt-template={template} className={`receipt-dialog relative flex w-full ${template === 'settlement_statement' ? 'max-w-[720px]' : 'max-w-[460px]'} flex-col overflow-hidden rounded-[20px] border border-[#d9e2e7] bg-[#fffefa] shadow-[0_22px_65px_rgba(14,40,61,.22)]`}>
        <div data-testid="receipt-document-frame" className="receipt-document-frame w-full shrink-0" style={{ height: `${receiptFit.height}px` }}>
          <article ref={printRef} data-testid="receipt-document" data-receipt-template={template} className="receipt-print w-full bg-[#fffefa] text-[#203a54]" style={{ transform: `scale(${receiptFit.scale})`, transformOrigin: 'top center' }}>
            {template !== 'bank_payment' && <ReceiptDocument template={template} transaction={transaction} conversion={conversion} heading={heading} completed={completed} pending={pending} closeRef={closeRef} onClose={onClose} />}
            {template === 'bank_payment' && <>
            <header className={`px-5 pb-4 pt-4 sm:px-6 ${darkMasthead ? `text-white ${template === 'transfer_ledger' ? 'bg-[#173c4b]' : 'bg-[#173951]'}` : 'text-[#203a54]'}`}>
              <div className={`flex items-center justify-between border-b pb-3 ${darkMasthead ? 'border-white/15' : 'border-[#e8ecee]'}`}>
                <img src={`${import.meta.env.BASE_URL}globus-wordmark-transparent.png`} alt="Globus Bank" className={`h-auto w-[104px] ${darkMasthead ? 'brightness-0 invert' : ''}`} />
                <button ref={closeRef} type="button" aria-label="Close receipt" data-testid="button-close-receipt" onClick={onClose} className={`receipt-screen-only grid h-8 w-8 place-items-center rounded-full border transition ${darkMasthead ? 'border-white/20 text-white/80 hover:bg-white/10' : 'border-[#e1e8eb] text-[#607589] hover:bg-[#f1f6f7]'}`}><X size={15} /></button>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-[9px] font-bold uppercase tracking-[.18em] ${darkMasthead ? 'text-[#a9c7bd]' : 'text-[#478783]'}`}>
                    Globus Bank · transaction record
                  </p>
                  <h2 id="receipt-title" className="bank-display mt-1 text-[19px] font-bold tracking-[-.045em] text-[#183450]">{templateTitle}</h2>
                  <p className="mt-0.5 text-[10px] text-[#7d8d9b]">{heading}</p>
                </div>
                <span data-testid="text-receipt-status" className={`mb-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold ${completed ? 'border-[#d5e7dc] bg-[#eff7f2] text-[#47755f]' : pending ? 'border-[#eadfbf] bg-[#fbf7eb] text-[#8b7440]' : 'border-[#f1d8d5] bg-[#fbefed] text-[#9c4d46]'}`}>
                  {completed ? <BadgeCheck size={11} /> : <Clock3 size={11} />}
                  {completed ? 'RECORDED IN GLOBUS' : pending ? 'PENDING IN GLOBUS' : `${humanizeStatus(transaction.status).toUpperCase()} IN GLOBUS`}
                </span>
              </div>
            </header>
            <div className="space-y-3 px-5 pb-3 pt-3 sm:px-6">
              <section className="rounded-[15px] border border-[#dce5e8] bg-[#173858] p-4 text-white" aria-label="Transfer amount summary">
                <p className="text-[8px] font-bold uppercase tracking-[.16em] text-[#a9d6d3]">Transaction amount · internal record</p>
                <p data-testid="text-receipt-amount" className="bank-display mt-1 break-words text-[25px] font-bold tracking-[-.04em]">{formatAmount(transaction.amount, transaction.currency)}</p>
                {conversion && <div className="mt-3 grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-white/15 pt-3">
                  <div className="min-w-0"><p className="text-[7px] font-bold uppercase tracking-[.1em] text-[#a9c0d1]">Source amount</p><p data-testid="text-receipt-source-amount" className="mt-0.5 break-words text-[10px] font-semibold">{formatAmount(conversion.sourceAmount, conversion.sourceCurrency)}</p></div>
                  <ArrowLeftRight size={13} className="text-[#d4bc76]" />
                  <div className="min-w-0 text-right"><p className="text-[7px] font-bold uppercase tracking-[.1em] text-[#a9c0d1]">Calculated destination</p><p data-testid="text-receipt-converted-total" className="mt-0.5 break-words text-[10px] font-semibold">{formatAmount(conversion.destinationAmount, conversion.destinationCurrency)}</p></div>
                </div>}
                {conversion && <p data-testid="text-receipt-exchange-rate" className="mt-2 break-words text-[8px] text-[#c2d2dd]">Rate recorded: 1 {conversion.sourceCurrency} = {formatRate(conversion.exchangeRate)} {conversion.destinationCurrency}</p>}
              </section>

              {transaction.recipient && <section className="rounded-xl border border-[#e4e9eb] bg-white p-3" aria-label="Transfer recipient">
                <p className="text-[8px] font-bold uppercase tracking-[.16em] text-[#8291a0]">Recipient details on record</p>
                <div className="mt-2 flex min-w-0 items-center gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eef5f5] text-[#397b7b]"><ShieldCheck size={15} /></div>
                  <div className="min-w-0 flex-1"><p className="break-words text-[10px] font-bold text-[#263f58]">{transaction.recipient.name}</p><p className="mt-0.5 break-words text-[8px] text-[#7b8b9b]">{transaction.recipient.bank} · {transaction.recipient.country}</p></div>
                  <p className="shrink-0 font-mono text-[8px] font-semibold text-[#526a80]">{transaction.recipient.account}</p>
                </div>
              </section>}

              <section className="rounded-xl border border-[#e4e9eb] bg-white px-3">
                <div className="flex items-center gap-1.5 border-b border-[#e9edf0] py-2 text-[8px] font-bold uppercase tracking-[.14em] text-[#718599]">
                  <span className="inline-flex items-center gap-1.5"><Hash size={11} className="text-[#528c89]" />Transaction details</span>
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
                <p className="min-w-0 text-[8px] leading-4 text-[#7d8c98]">Recorded by Globus Bank · This receipt does not confirm settlement through an outside bank or payment service.</p>
                <CalendarDays size={12} className="ml-auto shrink-0 text-[#8da0ab]" />
              </div>
            </div>
            </>}
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
          <p className="mt-1 text-right text-[8px] text-[#8794a2]">On supported phones, choose “Save Image” in the device share sheet to add the PNG to Photos or Gallery. Other browsers download the file.</p>
        </div>
      </section>
    </div>
  );
}

function ReceiptDocument({
  template,
  transaction,
  conversion,
  heading,
  completed,
  pending,
  closeRef,
  onClose,
}: {
  template: ReceiptTemplateId;
  transaction: ReceiptTransaction;
  conversion: ReceiptConversion | null;
  heading: string;
  completed: boolean;
  pending: boolean;
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const [journeyView, setJourneyView] = useState<'journey' | 'details'>('journey');
  const statusLabel = completed
    ? 'Recorded in Globus'
    : pending
      ? 'Pending in Globus'
      : `${humanizeStatus(transaction.status)} in Globus`;
  const occurredAt = formatDateTime(transaction.createdAt);
  const logo = (
    <img
      src={`${import.meta.env.BASE_URL}globus-wordmark-transparent.png`}
      alt="Globus Bank"
      className="h-auto w-[104px] brightness-0 invert"
    />
  );
  const closeButton = (
    <button
      ref={closeRef}
      type="button"
      aria-label="Close receipt"
      data-testid="button-close-receipt"
      onClick={onClose}
      className="receipt-screen-only grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#dfe6e9] text-[#607589] hover:bg-[#f1f6f7]"
    >
      <X size={15} />
    </button>
  );
  const amount = formatAmount(transaction.amount, transaction.currency);
  const convertedAmount = conversion
    ? formatAmount(conversion.destinationAmount, conversion.destinationCurrency)
    : null;
  const details = (
    <dl className="divide-y divide-[#e9edf0]">
      <ReceiptDataRow label="Reference" value={transaction.reference} strong mono testId="text-receipt-reference" />
      {transaction.sender && <>
        <ReceiptDataRow label="Sender" value={transaction.sender.name} />
        <ReceiptDataRow label="Source wallet" value={`••••••${transaction.sender.walletLast4}`} mono />
      </>}
      {transaction.recipient ? <>
        <ReceiptDataRow label="Recipient" value={transaction.recipient.name} />
        <ReceiptDataRow label="Destination bank" value={transaction.recipient.bank} />
        <ReceiptDataRow label="Country" value={transaction.recipient.country} />
        <ReceiptDataRow label="Recipient account" value={transaction.recipient.account} mono />
        <ReceiptDataRow label="Route" value={transaction.recipient.route} />
        {transaction.recipient.transferType === 'local_routing' && transaction.recipient.routingCode && <ReceiptDataRow label="Routing number" value={transaction.recipient.routingCode} mono />}
        {transaction.recipient.transferType === 'international_wire' && transaction.recipient.swiftBic && <ReceiptDataRow label="SWIFT / BIC" value={transaction.recipient.swiftBic} mono />}
        <ReceiptDataRow label="Description" value={transaction.recipient.remark || transaction.description || heading} />
      </> : <>
        <ReceiptDataRow label="Counterparty" value={transaction.counterparty || 'Globus account'} />
        <ReceiptDataRow label="Description" value={transaction.description || heading} />
        <ReceiptDataRow label="Fee" value={formatAmount(transaction.fee, transaction.currency)} />
      </>}
      {conversion && <>
        <ReceiptDataRow label="Source amount" value={formatAmount(conversion.sourceAmount, conversion.sourceCurrency)} />
        <ReceiptDataRow label="Converted amount" value={convertedAmount ?? ''} />
        <ReceiptDataRow label="Exchange rate" value={`1 ${conversion.sourceCurrency} = ${formatRate(conversion.exchangeRate)} ${conversion.destinationCurrency}`} />
      </>}
      <ReceiptDataRow label="Date and time" value={occurredAt} />
      <ReceiptDataRow label="Globus status" value={humanizeStatus(transaction.status)} />
    </dl>
  );
  const disclaimer = (
    <p className="flex items-start gap-2 border-t border-dashed border-[#dfe6e9] px-5 py-3 text-[9px] leading-4 text-[#788995]">
      <ShieldCheck size={13} className="mt-0.5 shrink-0 text-[#4a826d]" />
      <span>Internal Globus ledger record. This receipt is not proof of an outside payment or bank settlement.</span>
    </p>
  );

  if (template === 'standard') {
    return (
      <div className="overflow-hidden rounded-[20px] bg-[#fffefa] text-[#203a54]">
        <header className="relative overflow-hidden bg-[#132f51] px-5 pb-5 pt-4 text-white sm:px-6">
          <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full border border-white/10" />
          <div className="relative flex items-center justify-between gap-3">
            {logo}{closeButton}
          </div>
          <p className="relative mt-5 text-[9px] font-bold uppercase tracking-[.18em] text-[#a8d3d6]">Globus transaction record</p>
          <h2 id="receipt-title" className="bank-display relative mt-1 text-[21px] font-semibold">{heading}</h2>
          <p className="bank-display relative mt-3 text-[30px] font-semibold tracking-[-.04em]" data-testid="text-receipt-amount">{amount}</p>
          <span data-testid="text-receipt-status" className={`relative mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold ${completed ? 'bg-[#2c6b5a] text-[#d9f2e6]' : 'bg-[#6b5a2c] text-[#f6e8c4]'}`}>
            {completed ? <BadgeCheck size={12} /> : <Clock3 size={12} />}{statusLabel}
          </span>
        </header>
        {conversion && <section className="mx-5 mt-4 rounded-xl border border-[#dce8ea] bg-[#f1f7f7] p-3 sm:mx-6">
          <p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#4f878c]">Recorded conversion</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <span data-testid="text-receipt-source-amount" className="text-[11px] font-semibold">{formatAmount(conversion.sourceAmount, conversion.sourceCurrency)}</span>
            <ArrowLeftRight size={13} className="text-[#528c89]" />
            <span data-testid="text-receipt-converted-total" className="text-[11px] font-semibold">{convertedAmount}</span>
          </div>
          <p data-testid="text-receipt-exchange-rate" className="mt-1 text-[9px] text-[#5d7488]">Rate: 1 {conversion.sourceCurrency} = {formatRate(conversion.exchangeRate)} {conversion.destinationCurrency}</p>
        </section>}
        <section className="px-5 pb-1 pt-4 sm:px-6">
          <div className="mb-1 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.14em] text-[#718599]"><Hash size={11} />Transaction details</div>
          {details}
        </section>
        {disclaimer}
      </div>
    );
  }

  if (template === 'transfer_journey') {
    return (
      <div className="overflow-hidden rounded-[22px] bg-[#fffefa] text-[#203b50]">
        <header className="bg-[#173951] px-5 pb-4 pt-4 text-white sm:px-6">
          <div className="flex items-center justify-between gap-3">{logo}{closeButton}</div>
          <p className="mt-5 text-[8px] font-bold uppercase tracking-[.16em] text-[#a9c7bd]">Internal payment record</p>
          <h2 id="receipt-title" className="bank-display mt-1 text-[23px] font-medium">{heading}</h2>
          <p className="mt-1 text-[10px] text-[#bed0ca]">Current Globus status: {humanizeStatus(transaction.status)}</p>
        </header>
        <div className="px-5 pb-4 sm:px-6">
          <section className="border-b border-dashed border-[#d9e3df] py-4" aria-label="Transaction amount">
            <p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#82939c]">Amount recorded</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="bank-display text-[23px] font-semibold" data-testid="text-receipt-amount">{amount}</span>
              {conversion && <><ArrowLeftRight size={15} className="text-[#548f80]" /><span className="bank-display text-[20px] font-semibold text-[#347c78]" data-testid="text-receipt-converted-total">{convertedAmount}</span></>}
            </div>
            {conversion && <p className="mt-2 text-center font-mono text-[9px] text-[#71888c]" data-testid="text-receipt-exchange-rate">1 {conversion.sourceCurrency} = {formatRate(conversion.exchangeRate)} {conversion.destinationCurrency}</p>}
          </section>
          <nav className="flex gap-5 border-b border-[#e8eeeb]" aria-label="Receipt sections">
            <button type="button" aria-pressed={journeyView === 'journey'} onClick={() => setJourneyView('journey')} className={`border-b-2 px-1 py-2 text-[9px] font-bold ${journeyView === 'journey' ? 'border-[#43877b] text-[#285f60]' : 'border-transparent text-[#91a0a4]'}`}>Activity journey</button>
            <button type="button" aria-pressed={journeyView === 'details'} onClick={() => setJourneyView('details')} className={`border-b-2 px-1 py-2 text-[9px] font-bold ${journeyView === 'details' ? 'border-[#43877b] text-[#285f60]' : 'border-transparent text-[#91a0a4]'}`}>Payment details</button>
          </nav>
          {journeyView === 'journey' ? <div className="space-y-4 py-4">
            <div className="grid grid-cols-[20px_1fr_auto] items-start gap-3">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-[#e8f1eb] text-[8px] text-[#397b72]">1</span>
              <div><p className="text-[10px] font-bold">Activity recorded</p><p className="mt-1 text-[9px] text-[#89999c]">{occurredAt}</p></div>
              <span className="text-[9px] font-mono text-[#355362]">{amount}</span>
            </div>
            <div className="grid grid-cols-[20px_1fr_auto] items-start gap-3">
              <span className={`grid h-4 w-4 place-items-center rounded-full text-[8px] text-white ${completed ? 'bg-[#347c78]' : 'bg-[#8b7440]'}`}>2</span>
              <div><p className="text-[10px] font-bold">Current Globus status</p><p className="mt-1 text-[9px] text-[#89999c]">{statusLabel}</p></div>
              <span className="text-[9px] font-mono text-[#355362]">{humanizeStatus(transaction.status)}</span>
            </div>
          </div> : <div className="py-3">{details}</div>}
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-[#e3ebe7] bg-[#f8faf6] px-3 py-2">
            <div className="min-w-0"><p className="text-[7px] font-bold uppercase tracking-[.12em] text-[#82939c]">Transaction reference</p><p className="break-all font-mono text-[9px] text-[#45606a]" data-testid="text-receipt-reference">{transaction.reference}</p></div>
          </div>
        </div>
        {disclaimer}
      </div>
    );
  }

  if (template === 'transfer_ledger') {
    return (
      <div className="overflow-hidden rounded-[21px] bg-[#fbfcf7] text-[#183e4a]">
        <header className="bg-[#173c4b] px-5 py-5 text-[#f1f4e9] sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#bfcec4]">◉ &nbsp; GLOBUS · LEDGER RECORD</p>{closeButton}
          </div>
          <p className="mt-5 text-[8px] font-bold uppercase tracking-[.18em] text-[#a8cbb7]">{humanizeStatus(transaction.type)}</p>
          <h2 id="receipt-title" className="bank-display mt-1 text-[24px] font-medium">{heading}</h2>
          <p data-testid="text-receipt-amount" className="bank-display mt-3 text-[29px] font-semibold">{amount}</p>
          <p data-testid="text-receipt-status" className="mt-2 inline-flex items-center gap-2 text-[9px] text-[#c8d8cf]"><span className="grid h-4 w-4 place-items-center rounded-full bg-[#427d6d] text-white">{completed ? '✓' : '·'}</span>{statusLabel}</p>
        </header>
        <section className="border-b border-[#dce6df] px-5 py-4 sm:px-6">
          <p className="text-[7px] font-bold uppercase tracking-[.15em] text-[#859895]">Counterparty</p>
          <p className="mt-1 text-[12px] font-semibold">{transaction.recipient?.name || transaction.counterparty || 'Globus account'}</p>
          {transaction.recipient && <p className="mt-1 text-[9px] text-[#70868a]">{transaction.recipient.bank} · {transaction.recipient.country} · {transaction.recipient.account}</p>}
        </section>
        <section className="px-5 py-4 sm:px-6" aria-label="Ledger activity">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-[10px]">Activity record</strong>
            <span className="text-[8px] text-[#8b9a96]">Created {occurredAt}</span>
          </div>
          <div className="mt-3 space-y-3 border-l border-dashed border-[#cbdad0] pl-4">
            <div><p className="text-[9px] font-bold">Transaction entered</p><p className="mt-0.5 text-[8px] text-[#7a8e8b]">{occurredAt}</p></div>
            {conversion && <div><p className="text-[9px] font-bold">Recorded conversion</p><p className="mt-0.5 text-[8px] text-[#7a8e8b]">{formatAmount(conversion.sourceAmount, conversion.sourceCurrency)} → {convertedAmount} · 1 {conversion.sourceCurrency} = {formatRate(conversion.exchangeRate)} {conversion.destinationCurrency}</p></div>}
            <div><p className="text-[9px] font-bold">Current Globus status</p><p className="mt-0.5 text-[8px] text-[#7a8e8b]">{humanizeStatus(transaction.status)}</p></div>
          </div>
          <div className="mt-4">{details}</div>
        </section>
        <div className="border-t border-[#e5ebe4] px-5 py-3 text-[8px] text-[#83938e] sm:px-6">Reference · <span className="font-mono" data-testid="text-receipt-reference">{transaction.reference}</span></div>
        {disclaimer}
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-[#d7e0da] bg-[#fcfcf7] text-[#28444c]">
      <header className="flex items-center justify-between gap-3 border-b-4 border-[#a8c3b0] bg-[#173b4b] px-5 py-4 text-[#f4f4e9] sm:px-8">
        <span className="text-[12px] font-extrabold tracking-wide">◉ GLOBUS BANK</span>{closeButton}
      </header>
      <section className="flex flex-wrap items-end justify-between gap-4 px-5 py-5 sm:px-8">
        <div><p className="text-[8px] font-extrabold uppercase tracking-[.17em] text-[#718b81]">Internal transaction statement</p><h2 id="receipt-title" className="bank-display mt-2 text-[24px] font-medium leading-tight text-[#173b4b]">{heading}</h2><span data-testid="text-receipt-status" className="mt-2 inline-flex items-center gap-1.5 rounded-sm border border-[#bfd5c6] px-2 py-1 text-[8px] font-extrabold uppercase tracking-[.1em] text-[#316e60]"><span className="h-1.5 w-1.5 rounded-full bg-[#4d9079]" />{humanizeStatus(transaction.status)}</span></div>
        <div className="text-left text-[8px] leading-4 text-[#71868a] sm:text-right">RECORDED<br />{occurredAt}</div>
      </section>
      <section className="border-t border-[#dce4df] px-5 py-4 sm:px-8">
        <p className="mb-3 text-[8px] font-extrabold uppercase tracking-[.13em] text-[#183d4b]">Transaction particulars</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><p className="text-[7px] font-bold uppercase tracking-[.13em] text-[#82928e]">Amount</p><p className="bank-display mt-1 text-[15px] font-medium" data-testid="text-receipt-amount">{amount}</p></div>
          <div><p className="text-[7px] font-bold uppercase tracking-[.13em] text-[#82928e]">Counterparty</p><p className="mt-1 break-words text-[9px] font-semibold">{transaction.recipient?.name || transaction.counterparty || 'Globus account'}</p></div>
          <div><p className="text-[7px] font-bold uppercase tracking-[.13em] text-[#82928e]">Reference</p><p className="mt-1 break-all font-mono text-[9px]" data-testid="text-receipt-reference">{transaction.reference}</p></div>
        </div>
      </section>
      {conversion && <section className="border-t border-[#dce4df] bg-[#f3f6f0] px-5 py-4 sm:px-8">
        <p className="mb-3 text-[8px] font-extrabold uppercase tracking-[.13em] text-[#183d4b]">Recorded conversion</p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div><p className="text-[7px] font-bold uppercase text-[#83928c]">Source</p><p className="bank-display mt-1 text-[16px]" data-testid="text-receipt-source-amount">{formatAmount(conversion.sourceAmount, conversion.sourceCurrency)}</p></div>
          <ArrowLeftRight size={13} className="text-[#648878]" />
          <div className="text-right"><p className="text-[7px] font-bold uppercase text-[#83928c]">Converted</p><p className="bank-display mt-1 text-[16px] text-[#39786d]" data-testid="text-receipt-converted-total">{convertedAmount}</p></div>
        </div>
        <p className="mt-2 text-[8px] font-mono text-[#718580]" data-testid="text-receipt-exchange-rate">Rate · 1 {conversion.sourceCurrency} = {formatRate(conversion.exchangeRate)} {conversion.destinationCurrency}</p>
      </section>}
      <section className="border-t border-[#dce4df] px-5 py-4 sm:px-8">
        <p className="mb-2 text-[8px] font-extrabold uppercase tracking-[.13em] text-[#183d4b]">Record details</p>{details}
      </section>
      <p className="border-t border-[#dce4df] px-5 py-3 text-[8px] leading-4 text-[#71868a] sm:px-8">Internal Globus ledger record. This statement is not proof of outside payment or bank settlement.</p>
    </div>
  );
}

function ReceiptDataRow({ label, value, strong, mono, testId }: { label: string; value: string; strong?: boolean; mono?: boolean; testId?: string }) {
  return <div className="flex items-start justify-between gap-4 py-2 text-[9px]">
    <dt className="shrink-0 text-[#8492a1]">{label}</dt>
    <dd data-testid={testId} className={`min-w-0 break-words text-right ${mono ? 'font-mono' : ''} ${strong ? 'font-bold text-[#246d69]' : 'font-semibold text-[#3b5169]'}`}>{value}</dd>
  </div>;
}
