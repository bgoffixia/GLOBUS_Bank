import { useState } from 'react';
import { BadgeCheck, FileCheck2, Printer, ShieldCheck } from 'lucide-react';

export default function ArchivalStatement() {
  const [printed, setPrinted] = useState(false);

  return (
    <main className="min-h-[100dvh] bg-[#e8edf0] px-3 py-5 text-[#21384b] sm:px-6">
      <style>{`
        @media print {
          .archive-screen-actions { display: none !important; }
          .archive-page { box-shadow: none !important; border: 0 !important; margin: 0 auto !important; }
          body { background: #fff !important; }
        }
      `}</style>
      <div className="mx-auto max-w-[440px]">
        <article className="archive-page relative overflow-hidden border border-[#d5dfe2] bg-[#fffefa] shadow-[0_16px_44px_rgba(30,55,72,.14)]">
          <div className="h-[5px] bg-[#1c4d5a]" />
          <header className="px-6 pb-4 pt-5">
            <div className="flex items-center justify-between border-b border-[#e4e8e6] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-full border border-[#c7d9d5] bg-[#f0f6f3]">
                  <span className="block h-3 w-3 rounded-full border-[1.5px] border-[#357c78]" />
                </div>
                <div>
                  <p className="text-[15px] font-bold tracking-[-.04em] text-[#18364c]">globus<span className="font-medium text-[#43837e]">bank</span></p>
                  <p className="mt-0.5 text-[7px] font-semibold uppercase tracking-[.19em] text-[#819198]">International banking</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[7px] font-bold uppercase tracking-[.16em] text-[#839096]">Document number</p>
                <p className="mt-1 font-mono text-[9px] font-semibold tracking-[.04em] text-[#345b68]">GB-ARC-26-1109-08417</p>
              </div>
            </div>
            <div className="flex items-end justify-between gap-3 pt-4">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[.2em] text-[#4b817d]">Official archive copy</p>
                <h1 className="mt-1 font-serif text-[24px] leading-none tracking-[-.04em] text-[#18364c]">Settlement statement</h1>
                <p className="mt-1.5 text-[9px] text-[#778791]">Cross-border payment · completed</p>
              </div>
              <div className="mb-0.5 flex items-center gap-1 rounded-sm border border-[#cbded4] bg-[#f2f8f3] px-2 py-1.5 text-[#47775d]">
                <BadgeCheck size={12} strokeWidth={1.8} />
                <span className="text-[7px] font-bold uppercase tracking-[.12em]">Verified</span>
              </div>
            </div>
          </header>

          <section className="mx-6 border-y border-[#dfe6e4] py-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div>
                <p className="text-[7px] font-bold uppercase tracking-[.17em] text-[#87969a]">Amount debited</p>
                <p className="mt-1 font-serif text-[21px] leading-none tracking-[-.035em] text-[#1c4055]">$1,250.00</p>
                <p className="mt-1 text-[8px] text-[#829198]">USD · Globus multi-currency</p>
              </div>
              <div className="h-8 w-px bg-[#dce4e2]" />
              <div className="text-right">
                <p className="text-[7px] font-bold uppercase tracking-[.17em] text-[#87969a]">Amount settled</p>
                <p className="mt-1 font-serif text-[21px] leading-none tracking-[-.035em] text-[#1c4055]">€1,152.50</p>
                <p className="mt-1 text-[8px] text-[#829198]">EUR · Beneficiary received</p>
              </div>
            </div>
            <div className="mt-3 flex justify-between border-t border-dashed border-[#d9e2df] pt-2 text-[8px] text-[#6e8188]">
              <span>Applied exchange rate</span><span className="font-mono font-semibold text-[#385e68]">1 USD = 0.922 EUR</span>
            </div>
          </section>

          <section className="px-6 pt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="text-[8px] font-bold uppercase tracking-[.19em] text-[#39716f]">Settlement particulars</h2>
              <span className="font-mono text-[7px] text-[#93a0a2]">01 / 01</span>
            </div>
            <dl className="divide-y divide-[#edf0ed] border-y border-[#e5eae7]">
              {[
                ['Beneficiary', 'Lena Moreau'],
                ['Receiving institution', 'Société Générale · France'],
                ['Destination account', 'FR•• •••• •••• 4281'],
                ['Payment route', 'International wire · EUR'],
                ['Settlement date', '10 November 2026 · 09:42 UTC'],
                ['Transfer reference', 'GBX-20261110-8Q4K2P'],
              ].map(([label, value], index) => (
                <div key={label} className="grid grid-cols-[118px_1fr] gap-3 py-[6px]">
                  <dt className="text-[8px] text-[#829096]">{label}</dt>
                  <dd className={`text-right text-[8px] ${index === 5 ? 'font-mono font-semibold tracking-[.02em] text-[#34716f]' : 'font-semibold text-[#385267]'}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mx-6 mt-3 grid grid-cols-[1fr_110px] gap-3 border border-[#e3e9e5] bg-[#fbfcf8] p-2.5">
            <div>
              <div className="flex items-center gap-1.5 text-[#3f7771]">
                <ShieldCheck size={12} />
                <h2 className="text-[7px] font-bold uppercase tracking-[.15em]">Record validation</h2>
              </div>
              <p className="mt-1.5 text-[8px] leading-[1.45] text-[#708088]">This statement reflects the settled ledger entry recorded by Globus Bank. Retain this copy for your records.</p>
              <p className="mt-1.5 font-mono text-[7px] text-[#8a999a]">CHECKSUM · 4D9A-7C21-118E</p>
            </div>
            <div className="relative grid min-h-[61px] place-items-center border-l border-[#e4eae5] pl-2">
              <div className="absolute grid h-[52px] w-[52px] place-items-center rounded-full border border-dashed border-[#a5c4b2]">
                <div className="grid h-[43px] w-[43px] place-items-center rounded-full border border-[#b9d0c2] text-center text-[#56826a]">
                  <div><FileCheck2 size={14} className="mx-auto" /><span className="mt-0.5 block text-[5px] font-bold uppercase tracking-[.12em]">Certified</span></div>
                </div>
              </div>
            </div>
          </section>

          <footer className="mx-6 mt-3 flex items-end justify-between border-t border-[#e3e8e5] pb-4 pt-2.5">
            <div>
              <p className="text-[7px] font-bold uppercase tracking-[.16em] text-[#829195]">Issued by</p>
              <p className="mt-1 text-[8px] font-semibold text-[#3d5968]">Globus Bank · Payment Services</p>
              <p className="mt-0.5 text-[7px] text-[#93a0a2]">Generated 10 Nov 2026 · Archive series 06</p>
            </div>
            <p className="font-serif text-[10px] italic text-[#77918b]">End of statement</p>
          </footer>
          <div className="h-[3px] bg-[#e2eee8]" />
        </article>

        <div className="archive-screen-actions mt-3 flex items-center justify-between px-1">
          <p className="text-[9px] text-[#74858d]">A compact, print-ready archive record</p>
          <button type="button" onClick={() => { setPrinted(true); window.print(); }} className="inline-flex items-center gap-1.5 rounded-sm bg-[#1c4d5a] px-3 py-2 text-[9px] font-semibold text-[#f8fbf7] transition hover:bg-[#28636b] focus:outline-none focus:ring-2 focus:ring-[#7ba7a0] focus:ring-offset-2">
            <Printer size={12} /> {printed ? 'Print again' : 'Print statement'}
          </button>
        </div>
      </div>
    </main>
  );
}
