import type { ReceiptTemplate } from '@workspace/api-client-react';

export const receiptTemplateOptions = [
  {
    value: 'standard',
    label: 'Standard',
    description: 'The current Globus receipt layout',
  },
  {
    value: 'bank_grade',
    label: 'Bank grade',
    description: 'A formal payment record with a clear amount summary',
  },
  {
    value: 'journey',
    label: 'Transfer journey',
    description: 'A visual path from source wallet to recorded destination',
  },
  {
    value: 'ledger',
    label: 'Transfer ledger',
    description: 'A compact, step-by-step ledger view',
  },
  {
    value: 'statement',
    label: 'Settlement statement',
    description: 'A print-friendly statement with a structured audit summary',
  },
] as const satisfies readonly {
  value: ReceiptTemplate;
  label: string;
  description: string;
}[];

export function ReceiptTemplateMiniPreview({ template }: { template: ReceiptTemplate }) {
  return (
    <div
      aria-hidden="true"
      data-testid={`receipt-template-preview-${template}`}
      className="pointer-events-none overflow-hidden rounded-md border border-[#dfe7e8] bg-[#fffefa]"
    >
      {template === 'standard' && <>
        <div className="bg-[#173858] px-2 py-1.5">
          <div className="h-1 w-10 rounded bg-white/80" />
          <div className="mt-2 h-1.5 w-14 rounded bg-white/55" />
          <div className="mt-1 h-2.5 w-20 rounded bg-white/90" />
        </div>
        <div className="space-y-1.5 px-2 py-2">
          <div className="h-3 w-16 rounded bg-[#eaf2f2]" />
          <div className="h-px bg-[#e6ebed]" />
          <div className="flex justify-between"><i className="h-1 w-8 rounded bg-[#cbd5dc]" /><i className="h-1 w-10 rounded bg-[#8295a5]" /></div>
          <div className="flex justify-between"><i className="h-1 w-7 rounded bg-[#cbd5dc]" /><i className="h-1 w-8 rounded bg-[#8295a5]" /></div>
        </div>
      </>}
      {template === 'bank_grade' && <>
        <div className="flex items-center justify-between border-b border-[#e6ebed] px-2 py-2">
          <div className="h-1.5 w-12 rounded bg-[#173858]" />
          <div className="h-2 w-7 rounded-full bg-[#e5f1e9]" />
        </div>
        <div className="px-2 py-2">
          <div className="rounded-md bg-[#173858] p-2">
            <div className="h-1 w-10 rounded bg-white/55" />
            <div className="mt-1.5 h-3 w-20 rounded bg-white/90" />
          </div>
          <div className="mt-2 flex items-center gap-2 rounded border border-[#e3e9e9] p-1.5">
            <span className="h-4 w-4 rounded-full bg-[#e3efea]" />
            <span className="h-1 w-14 rounded bg-[#8295a5]" />
          </div>
        </div>
      </>}
      {template === 'journey' && <>
        <div className="bg-[#173951] px-2 py-2">
          <div className="h-1 w-12 rounded bg-[#b6d0c5]" />
          <div className="mt-2 h-2.5 w-20 rounded bg-white/90" />
          <div className="mt-1 h-1 w-24 rounded bg-white/45" />
        </div>
        <div className="space-y-2 px-2 py-2">
          {[0, 1].map(item => <div key={item} className="flex items-start gap-1.5">
            <span className={`mt-0.5 h-2.5 w-2.5 rounded-full ${item ? 'bg-[#43847a]' : 'bg-[#dcebe2]'}`} />
            <span className="flex-1"><i className="block h-1 w-16 rounded bg-[#7d9194]" /><i className="mt-1 block h-1 w-10 rounded bg-[#c4d0d0]" /></span>
            <i className="h-1 w-8 rounded bg-[#81929a]" />
          </div>)}
        </div>
      </>}
      {template === 'ledger' && <>
        <div className="bg-[#173c4b] px-2 py-2">
          <div className="flex justify-between"><i className="h-1 w-12 rounded bg-white/70" /><i className="h-1 w-8 rounded bg-[#a8cbb7]" /></div>
          <div className="mt-2 h-2.5 w-20 rounded bg-white/90" />
        </div>
        <div className="space-y-1.5 px-2 py-2">
          {[0, 1, 2].map(item => <div key={item} className="flex items-center gap-1.5 border-b border-[#e6ece8] pb-1">
            <span className="grid h-3 w-3 place-items-center rounded-full bg-[#e4efe7] text-[6px] text-[#39776c]">{item + 1}</span>
            <i className="h-1 flex-1 rounded bg-[#7c8e8f]" />
            <i className="h-1 w-9 rounded bg-[#aab8b7]" />
          </div>)}
        </div>
      </>}
      {template === 'statement' && <>
        <div className="flex items-center justify-between border-b-[2px] border-[#9dbbab] bg-[#173b4b] px-2 py-2">
          <i className="h-1.5 w-10 rounded bg-white/85" />
          <i className="h-1 w-8 rounded bg-white/45" />
        </div>
        <div className="px-2 py-2">
          <i className="block h-1 w-12 rounded bg-[#83a094]" />
          <i className="mt-1.5 block h-2.5 w-20 rounded bg-[#284c56]" />
          <div className="mt-2 grid grid-cols-3 gap-1 border-t border-[#e1e8e1] pt-1.5">
            {[0, 1, 2].map(item => <span key={item}><i className="block h-1 w-full rounded bg-[#d0dad2]" /><i className="mt-1 block h-1.5 w-4/5 rounded bg-[#718b81]" /></span>)}
          </div>
        </div>
      </>}
    </div>
  );
}
