import React from 'react';
import type { ReceiptTemplateId } from './receipt-layouts';

const baseReceiptTemplateOptions = [
  {
    value: 'standard',
    label: 'Standard receipt',
    description: 'The current DUTSTAR receipt layout',
  },
  {
    value: 'bank_payment',
    label: 'Bank payment record',
    description: 'A formal payment record with a clear amount summary',
  },
  {
    value: 'transfer_journey',
    label: 'Transfer journey',
    description: 'A visual path through the transfer record and its current status',
  },
  {
    value: 'transfer_ledger',
    label: 'Transfer ledger',
    description: 'A compact summary of DUTSTAR ledger activity',
  },
  {
    value: 'settlement_statement',
    label: 'Settlement statement',
    description: 'A print-friendly record with document number and status',
  },
] as const satisfies readonly {
  value: ReceiptTemplateId;
  label: string;
  description: string;
}[];

const expandedReceiptTemplateOptions = [
  {
    value: 'editorial_ledger',
    label: 'Editorial ledger',
    description: 'A typographic, annotated account record',
  },
  {
    value: 'transfer_ledger_columnar',
    label: 'Columnar ledger',
    description: 'A columnar ledger statement',
  },
  {
    value: 'settlement_ledger',
    label: 'Settlement ledger',
    description: 'A structured settlement ledger copy',
  },
  {
    value: 'reconciliation_statement',
    label: 'Reconciliation statement',
    description: 'A reconciliation-first transaction record',
  },
  {
    value: 'settlement_timeline',
    label: 'Settlement timeline',
    description: 'A time-led record of recorded activity',
  },
  {
    value: 'archival_statement',
    label: 'Archival statement',
    description: 'A formal archival copy of the transaction record',
  },
] as const satisfies readonly {
  value: ReceiptTemplateId;
  label: string;
  description: string;
}[];

export const receiptTemplateOptions = [
  ...baseReceiptTemplateOptions,
  ...expandedReceiptTemplateOptions,
] as const;

export function ReceiptTemplateMiniPreview({ template }: { template: ReceiptTemplateId }) {
  return (
    <div
      aria-hidden="true"
      data-testid={`receipt-template-preview-${template}`}
      className="pointer-events-none overflow-hidden rounded-lg border border-[#d8e2e4] bg-[#fffefa] shadow-[0_5px_16px_rgba(25,55,72,.08)]"
    >
      {template === 'standard' && <>
        <div className="bg-[#12365B] px-2.5 py-2 text-white">
          <div className="flex items-center justify-between border-b border-white/15 pb-1.5">
            <span className="text-[6px] font-black tracking-[.16em]">DUTSTAR BANK</span>
            <span className="rounded-full border border-[#d5e7dc]/30 px-1 py-0.5 text-[4px] font-bold tracking-[.1em] text-[#d9eadf]">PENDING</span>
          </div>
          <p className="mt-2 text-[5px] font-bold uppercase tracking-[.15em] text-[#a9d6d3]">Transfer record</p>
          <p className="mt-0.5 font-serif text-[13px] font-semibold leading-none">₦184,500.00</p>
          <p className="mt-1 text-[5px] text-white/65">Internal DUTSTAR account activity</p>
        </div>
        <div className="space-y-1.5 px-2.5 py-2 text-[5px]">
          <div className="flex justify-between gap-2"><span className="text-[#87959b]">Reference</span><span className="font-mono font-semibold text-[#3b5969]">DTS-20261120-8Q4K2P</span></div>
          <div className="flex justify-between gap-2"><span className="text-[#87959b]">Recipient</span><span className="font-semibold text-[#3b5969]">Amina Bello</span></div>
          <div className="flex justify-between gap-2"><span className="text-[#87959b]">Created</span><span className="text-[#607886]">20 Nov 2026 · 10:42</span></div>
          <div className="mt-1 border-t border-dashed border-[#dfe7e7] pt-1 text-center text-[4px] font-bold uppercase tracking-[.13em] text-[#648784]">Illustrative preview · not a live transaction</div>
        </div>
      </>}
      {template === 'bank_payment' && <>
        <div className="flex items-center justify-between border-b border-[#e6ebed] bg-white px-2.5 py-2">
          <div><p className="text-[6px] font-black tracking-[.14em] text-[#12365B]">DUTSTAR BANK</p><p className="mt-0.5 text-[4px] uppercase tracking-[.13em] text-[#8a989f]">Transaction advice</p></div>
          <span className="rounded-sm border border-[#eadfbf] bg-[#fbf7eb] px-1.5 py-1 text-[4px] font-bold uppercase tracking-[.08em] text-[#8b7440]">Pending</span>
        </div>
        <div className="space-y-1.5 px-2.5 py-2">
          <div className="rounded-md bg-[#12365B] p-2 text-white">
            <p className="text-[4px] uppercase tracking-[.14em] text-[#b4d1d3]">Amount recorded</p>
            <p className="mt-0.5 font-serif text-[12px] font-semibold">₦184,500.00</p>
          </div>
          <div className="flex items-center gap-1.5 rounded border border-[#e3e9e9] bg-white p-1.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#e3efea] text-[6px] font-bold text-[#397b7b]">AB</span>
            <span className="min-w-0"><b className="block truncate text-[5px] text-[#36536a]">Amina Bello</b><small className="block truncate text-[4px] text-[#85949d]">DUTSTAR recipient · •••• 7314</small></span>
            <span className="ml-auto shrink-0 font-mono text-[4px] text-[#81939d]">20 NOV 2026</span>
          </div>
          <p className="text-center font-mono text-[4px] text-[#84949b]">REF DTS-20261120-8Q4K2P</p>
        </div>
      </>}
      {template === 'transfer_journey' && <>
        <div className="bg-[#12365B] px-2.5 py-2 text-white">
          <div className="flex items-center justify-between"><span className="text-[5px] font-black tracking-[.14em]">DUTSTAR BANK</span><span className="text-[4px] font-bold tracking-[.12em] text-[#b6d0c5]">TRANSFER JOURNEY</span></div>
          <p className="mt-2 font-serif text-[12px] font-semibold">₦184,500.00</p>
          <p className="mt-0.5 text-[4px] text-white/60">Transfer request · pending review</p>
        </div>
        <div className="space-y-1.5 px-2.5 py-2">
          {[
            ['01', 'Request recorded', '20 Nov · 10:42', 'complete'],
            ['02', 'Review in progress', 'Awaiting update', 'current'],
          ].map(([step, label, note, state]) => <div key={step} className="flex items-start gap-1.5">
            <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-[4px] font-bold ${state === 'complete' ? 'bg-[#278C8C] text-white' : 'border border-[#d8c88f] bg-[#fbf7eb] text-[#8b7440]'}`}>{step}</span>
            <span className="min-w-0 flex-1"><b className="block text-[5px] text-[#465e6d]">{label}</b><small className="block text-[4px] text-[#8b999f]">{note}</small></span>
            <span className="text-[4px] font-bold uppercase tracking-[.08em] text-[#62817e]">{state === 'complete' ? 'Done' : 'Current'}</span>
          </div>)}
          <p className="border-t border-dashed border-[#dfe7e7] pt-1 text-center font-mono text-[4px] text-[#819198]">DTS-20261120-8Q4K2P</p>
        </div>
      </>}
      {template === 'transfer_ledger' && <>
        <div className="bg-[#12365B] px-2.5 py-2 text-white">
          <div className="flex items-center justify-between"><span className="text-[5px] font-black tracking-[.14em]">DUTSTAR BANK</span><span className="text-[4px] font-bold tracking-[.1em] text-[#a8cbb7]">LEDGER COPY</span></div>
          <div className="mt-2 flex items-end justify-between gap-1"><div><p className="text-[4px] uppercase tracking-[.12em] text-white/55">Net activity</p><p className="mt-0.5 font-serif text-[12px] font-semibold">₦184,500.00</p></div><span className="mb-0.5 rounded-sm bg-white/10 px-1 py-0.5 text-[4px] font-bold uppercase tracking-[.08em]">Pending</span></div>
        </div>
        <div className="px-2.5 py-2">
          <div className="grid grid-cols-[1fr_auto_auto] border-b border-[#dce6df] pb-1 text-[4px] font-bold uppercase tracking-[.08em] text-[#869490]"><span>Ledger detail</span><span>Side</span><span className="text-right">Amount</span></div>
          {[
            ['Customer activity', 'DR', '184,500.00'],
            ['Wallet balance', 'CR', '184,500.00'],
          ].map(([label, side, amount]) => <div key={label} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-[#edf0ed] py-1 text-[4px]">
            <span className="truncate text-[#667c81]">{label}</span><span className={`rounded px-1 py-0.5 font-bold ${side === 'CR' ? 'bg-[#eaf3ed] text-[#4e7b63]' : 'bg-[#f1f4f4] text-[#71838a]'}`}>{side}</span><span className="text-right font-mono text-[#45616a]">{amount}</span>
          </div>)}
          <p className="mt-1 text-right font-mono text-[4px] text-[#85948f]">Ref · DTS-20261120-8Q4K2P</p>
        </div>
      </>}
      {template === 'settlement_statement' && <>
        <div className="flex items-center justify-between border-b-[2px] border-[#9dbbab] bg-[#12365B] px-2.5 py-2 text-white">
          <span className="text-[5px] font-black tracking-[.14em]">DUTSTAR BANK</span>
          <span className="border border-[#b8d6c2]/40 px-1.5 py-1 text-[4px] font-bold uppercase tracking-[.1em] text-[#d6eadc]">Internal copy</span>
        </div>
        <div className="px-2.5 py-2">
          <p className="text-[4px] font-bold uppercase tracking-[.16em] text-[#6c8a7d]">Account activity statement</p>
          <h4 className="mt-0.5 font-serif text-[11px] leading-none text-[#284c56]">Transaction record</h4>
          <div className="mt-2 grid grid-cols-2 gap-1.5 border-y border-[#e1e8e1] py-1.5 text-[4px]">
            <span><small className="block text-[#879691]">Customer</small><b className="mt-0.5 block text-[#47645d]">Amina Bello</b></span>
            <span className="text-right"><small className="block text-[#879691]">Record date</small><b className="mt-0.5 block text-[#47645d]">20 Nov 2026</b></span>
            <span><small className="block text-[#879691]">Reference</small><b className="mt-0.5 block font-mono text-[#47645d]">DTS-20261120-8Q4K2P</b></span>
            <span className="text-right"><small className="block text-[#879691]">Amount</small><b className="mt-0.5 block text-[#47645d]">₦184,500.00</b></span>
          </div>
          <p className="mt-1.5 text-center text-[4px] font-bold uppercase tracking-[.12em] text-[#8a9992]">Illustrative · not an external payment confirmation</p>
        </div>
      </>}
      {([
        'editorial_ledger',
        'transfer_ledger_columnar',
        'settlement_ledger',
        'reconciliation_statement',
        'settlement_timeline',
        'archival_statement',
      ] as ReceiptTemplateId[]).includes(template) && <>
        <div className={`px-2.5 py-2 text-white ${template === 'editorial_ledger' ? 'bg-[#344d5a]' : template === 'settlement_timeline' ? 'bg-[#315b57]' : 'bg-[#12365B]'}`}>
          <div className="flex items-center justify-between"><span className="text-[5px] font-black tracking-[.14em]">DUTSTAR BANK</span><span className="text-[4px] font-bold uppercase tracking-[.1em] text-[#d5c78f]">{template.replaceAll('_', ' ')}</span></div>
          <p className="mt-2 font-serif text-[12px] font-semibold">Transaction record</p>
          <div className="mt-1 flex items-center justify-between gap-2 text-[4px] text-white/75"><span>Amount on record</span><span>Current status</span></div>
        </div>
        <div className={`px-2.5 py-2 ${template === 'transfer_ledger_columnar' ? 'grid grid-cols-2 gap-1.5' : 'space-y-1.5'}`}>
          {(template === 'settlement_timeline'
            ? ['Activity recorded', 'Current DUTSTAR status']
            : template === 'reconciliation_statement'
              ? ['Reference', 'Amount', 'Counterparty', 'Recorded status']
              : ['Transaction detail', 'Recorded amount', 'Counterparty', 'Reference']
          ).map((label, index) => <div key={label} className="flex items-center justify-between gap-2 border-b border-[#e6ece8] py-1 text-[4px]">
            <span className="text-[#81918e]">{label}</span><span className="max-w-[56%] truncate font-semibold text-[#405b61]">{index === 0 ? 'Current account record' : 'Recorded in DUTSTAR'}</span>
          </div>)}
          <p className="pt-1 text-right text-[4px] font-bold uppercase tracking-[.1em] text-[#66857d]">Full record preview</p>
        </div>
      </>}
    </div>
  );
}
