import './_group.css';
import { ArrowRight, Check, ChevronDown, Globe2, Landmark, ShieldCheck, UserRound } from 'lucide-react';

const field = 'h-9 w-full min-w-0 rounded-lg border border-[#dce4e9] bg-white px-3 text-[11px] text-[#30465e] placeholder:text-[#a4afba] outline-none focus:border-[#6b9b9d] focus:ring-2 focus:ring-[#6b9b9d]/15';

function Field({ label, placeholder, half = false }: { label: string; placeholder: string; half?: boolean }) {
  return <label className={`block min-w-0 ${half ? '' : 'col-span-2'}`}><span className="mb-1 block text-[9px] font-semibold text-[#65788b]">{label}</span><input className={field} placeholder={placeholder} readOnly /></label>;
}

export function Professional() {
  return (
    <main className="min-h-screen bg-[#f2f5f7] px-3 py-4 sm:px-6 sm:py-7">
      <div className="mx-auto max-w-[620px]">
        <div className="mb-3 flex items-center justify-between px-1">
          <div><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#64898d]">Globus Bank · secure transfer</p><h1 className="mt-0.5 text-[20px] font-bold tracking-[-.025em] text-[#17324f]">New transfer</h1></div>
          <span className="rounded-full border border-[#dce5e8] bg-white px-3 py-1.5 text-[9px] font-bold text-[#61798a]">Internal ledger</span>
        </div>
        <section className="overflow-hidden rounded-[20px] border border-[#dce4e9] bg-white shadow-[0_16px_42px_rgba(23,50,79,.07)]">
          <header className="border-b border-[#edf1f3] px-4 pt-3.5 sm:px-5">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#f1f4f6] p-1">
              <button className="flex min-h-9 items-center justify-center gap-2 rounded-md bg-white text-[10px] font-bold text-[#173b62] shadow-sm"><Landmark size={13} />Local routing</button>
              <button className="flex min-h-9 items-center justify-center gap-2 rounded-md text-[10px] font-bold text-[#718295]"><Globe2 size={13} />International wire</button>
            </div>
            <ol className="mt-3 flex gap-2 pb-3" aria-label="Three step transfer">
              {['Recipient & destination', 'Amount & review', 'PIN'].map((step, index) => <li key={step} className="min-w-0 flex-1"><span className={`block h-1 rounded-full ${index === 0 ? 'bg-[#1e506b]' : 'bg-[#e2e9ed]'}`} /><span className={`mt-1.5 block truncate text-[8px] font-bold uppercase tracking-[.07em] ${index === 0 ? 'text-[#315b6b]' : 'text-[#98a5b0]'}`}>{step}</span></li>)}
            </ol>
          </header>
          <div className="space-y-3.5 px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#57868a]">Step 1 of 3</p><h2 className="mt-0.5 text-[16px] font-bold text-[#1d3853]">Recipient & destination</h2></div>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#edf5f4] text-[#458286]"><UserRound size={15} /></span>
            </div>
            <label className="block min-w-0"><span className="mb-1 block text-[9px] font-semibold text-[#65788b]">From</span><button className={`${field} flex items-center justify-between text-left`}><span className="truncate">USD wallet <span className="text-[#8a99a6]">· $12,450 available</span></span><ChevronDown size={14} /></button></label>
            <div className="grid grid-cols-2 gap-x-2.5 gap-y-2.5">
              <Field label="Destination country" placeholder="Choose a country" />
              <Field label="Recipient bank" placeholder="Choose a bank" />
              <Field label="Account holder" placeholder="Name on account" />
              <Field label="Account number" placeholder="Enter account number" />
              <Field label="Routing / clearing code" placeholder="Routing or sort code" half />
              <Field label="Receives in" placeholder="Select currency" half />
              <Field label="Recipient email · optional" placeholder="Email for status updates" />
              <Field label="Reference · optional" placeholder="Add a note" />
            </div>
            <p className="flex items-start gap-2 rounded-lg bg-[#f5f8f8] px-3 py-2 text-[9px] leading-4 text-[#758695]"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-[#528589]" />Recipient details stay within your Globus transfer record. No funds are sent to an outside bank.</p>
          </div>
          <footer className="flex items-center justify-between gap-3 border-t border-[#edf1f3] bg-[#fafbfc] px-4 py-3 sm:px-5">
            <span className="text-[9px] font-medium text-[#8997a3]">Details are checked before you continue</span>
            <button className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#173b62] px-4 text-[10px] font-bold text-white">Continue <ArrowRight size={13} /></button>
          </footer>
        </section>
        <section className="mt-3 rounded-xl border border-[#e0e7eb] bg-white p-3.5">
          <div className="flex items-center justify-between gap-4"><div><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#739198]">Next · amount & review</p><p className="mt-0.5 text-[10px] font-semibold text-[#42586f]">Enter amount, see conversion, confirm recipient</p></div><Check size={16} className="shrink-0 text-[#60908a]" /></div>
        </section>
      </div>
    </main>
  );
}
