import './_group.css';
import { ArrowRight, Globe2, Landmark, ShieldCheck } from 'lucide-react';

const field = 'h-11 w-full rounded-xl border border-[#dfe6eb] bg-white px-3.5 text-[12px] text-[#344b64] placeholder:text-[#a0acb7]';

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.08em] text-[#5c7085]">{label}</span><input className={field} placeholder={placeholder} readOnly /></label>;
}

export function Current() {
  return (
    <main className="min-h-screen bg-[#f4f7fa] px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-[580px]">
        <section className="overflow-hidden rounded-[24px] border border-[#dfe7ec] bg-white shadow-[0_24px_60px_rgba(22,48,78,.08)]">
          <header className="border-b border-[#edf1f3] px-4 pt-4 sm:px-6 sm:pt-5">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#eff3f5] p-1">
              <button className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white text-[11px] font-bold text-[#173452] shadow-sm"><Landmark size={14} />Local routing</button>
              <button className="flex min-h-10 items-center justify-center gap-2 rounded-lg text-[11px] font-bold text-[#6f8195]"><Globe2 size={14} />International wire</button>
            </div>
            <div className="mt-4 flex gap-1.5 pb-4" aria-label="Five step transfer">
              {['Route', 'Recipient', 'Amount', 'Review', 'PIN'].map((step, i) => <div key={step} className="min-w-0 flex-1"><span className={`block h-1 rounded-full ${i === 0 ? 'bg-[#173b62]' : 'bg-[#e3e9ed]'}`} /><span className="mt-1.5 hidden text-[9px] font-bold uppercase tracking-wider text-[#99a6b3] sm:block">{step}</span></div>)}
            </div>
          </header>
          <div className="px-4 py-4 sm:px-6 sm:py-5">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#4f8b90]">Step 1 of 5 · Local routing</p>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-[#18324f]">Where is it going?</h1>
            <p className="mt-1 text-[11px] leading-5 text-[#6d7f92]">Choose the wallet, destination and currency the recipient should receive.</p>
            <div className="mt-4 space-y-3">
              <Field label="Source wallet" placeholder="USD wallet · $12,450.00 available" />
              <Field label="Destination country" placeholder="Choose a country" />
              <div className="grid gap-3 sm:grid-cols-2"><Field label="Recipient bank" placeholder="Select a country first" /><Field label="Recipient receives" placeholder="Choose currency" /></div>
            </div>
          </div>
          <footer className="flex justify-end border-t border-[#edf1f3] bg-[#fafbfc] px-4 py-3 sm:px-6">
            <button className="flex h-10 min-w-[160px] items-center justify-center gap-2 rounded-xl bg-[#142f51] px-4 text-[11px] font-bold text-white">Continue <ArrowRight size={14} /></button>
          </footer>
        </section>
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-[10px] text-[#8292a2]"><ShieldCheck size={13} />Internal Globus ledger record · no outside funds are sent</p>
      </div>
    </main>
  );
}
