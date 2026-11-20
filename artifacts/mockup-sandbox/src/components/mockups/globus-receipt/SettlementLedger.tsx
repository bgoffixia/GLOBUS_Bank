import { useState } from 'react';
import { BadgeCheck, FileCheck2, Printer, ShieldCheck } from 'lucide-react';

const particulars = [
  ['Beneficiary', 'Lena Moreau'],
  ['Receiving institution', 'Société Générale · France'],
  ['Destination account', 'FR•• •••• •••• 4281'],
  ['Payment route', 'International wire · EUR'],
  ['Settlement date', '10 November 2026 · 09:42 UTC'],
  ['Transfer reference', 'GBX-20261110-8Q4K2P'],
];

export default function SettlementLedger() {
  const [printed, setPrinted] = useState(false);

  return (
    <main className="min-h-[100dvh] bg-[#e8edf0] px-3 py-5 text-[#21384b] sm:px-6 sm:py-8">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
        .settlement-layout { font-family: 'DM Sans', sans-serif; }
        .settlement-layout h1, .settlement-layout .settle-amount { font-family: 'Instrument Serif', serif; }
        .settlement-mono { font-family: 'DM Mono', monospace; }
        @media print {
          .settlement-actions { display: none !important; }
          .settlement-sheet { box-shadow: none !important; border: 0 !important; }
          body { background: #fff !important; }
        }
      `}</style>
      <div className="settlement-layout mx-auto max-w-[840px]">
        <article className="settlement-sheet overflow-hidden border border-[#d5dfe2] bg-[#fffefa] shadow-[0_18px_52px_rgba(30,55,72,.15)]">
          <div className="flex min-h-[570px] flex-col md:flex-row">
            <aside className="relative flex w-full flex-col justify-between overflow-hidden bg-[#183b4b] p-6 text-[#f7f7ed] md:w-[34%] md:p-7">
              <div className="pointer-events-none absolute -right-20 top-24 h-64 w-64 rounded-full border border-white/[.08]" />
              <div className="pointer-events-none absolute -right-12 top-32 h-48 w-48 rounded-full border border-[#b9d4c4]/20" />
              <div className="relative">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-full border border-[#b9d4c4]/45">
                    <span className="h-3 w-3 rounded-full border-[1.5px] border-[#9ec7b5]" />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold tracking-[-.04em]">globus<span className="font-medium text-[#9ec7b5]">bank</span></p>
                    <p className="mt-0.5 text-[7px] font-semibold uppercase tracking-[.19em] text-[#b7c8c8]">International banking</p>
                  </div>
                </div>
                <div className="mt-12">
                  <p className="text-[8px] font-bold uppercase tracking-[.2em] text-[#a7c9b9]">Settlement statement</p>
                  <h1 className="mt-2 text-[31px] leading-[.96] tracking-[-.025em]">Payment<br />completed</h1>
                  <div className="mt-5 inline-flex items-center gap-1.5 border border-[#a8ccb7]/35 bg-[#dcebe0]/10 px-2.5 py-1.5 text-[#d2e7d8]">
                    <BadgeCheck size={13} strokeWidth={1.8} />
                    <span className="text-[7px] font-bold uppercase tracking-[.14em]">Verified settlement</span>
                  </div>
                </div>
              </div>
              <div className="relative mt-10 border-t border-white/15 pt-5">
                <p className="text-[8px] font-bold uppercase tracking-[.16em] text-[#b1c6c7]">Transfer reference</p>
                <p className="settlement-mono mt-2 break-all text-[10px] font-medium tracking-[.02em] text-[#f1f0df]">GBX-20261110-8Q4K2P</p>
                <p className="mt-5 text-[8px] leading-[1.6] text-[#b4c7c7]">Issued as an official record of funds settled through Globus Bank.</p>
              </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col p-6 sm:p-8">
              <header className="flex items-start justify-between gap-4 border-b border-[#e4e8e6] pb-5">
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-[.18em] text-[#63827e]">Official transaction record</p>
                  <p className="mt-1 text-[9px] text-[#829096]">Cross-border payment · completed</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[7px] font-bold uppercase tracking-[.16em] text-[#839096]">Document number</p>
                  <p className="settlement-mono mt-1 text-[8px] font-medium text-[#345b68]">GB-ARC-26-1109-08417</p>
                </div>
              </header>

              <section className="grid grid-cols-1 gap-5 border-b border-[#dfe6e4] py-6 sm:grid-cols-[1fr_1px_1fr] sm:items-center">
                <div>
                  <p className="text-[7px] font-bold uppercase tracking-[.17em] text-[#87969a]">Amount debited</p>
                  <p className="settle-amount mt-1 text-[29px] leading-none tracking-[-.035em] text-[#1c4055]">$1,250.00</p>
                  <p className="mt-1.5 text-[8px] text-[#829198]">USD · Globus multi-currency</p>
                </div>
                <div className="hidden h-12 w-px bg-[#dce4e2] sm:block" />
                <div className="sm:text-right">
                  <p className="text-[7px] font-bold uppercase tracking-[.17em] text-[#87969a]">Amount settled</p>
                  <p className="settle-amount mt-1 text-[29px] leading-none tracking-[-.035em] text-[#1c4055]">€1,152.50</p>
                  <p className="mt-1.5 text-[8px] text-[#829198]">EUR · Beneficiary received</p>
                </div>
                <div className="col-span-full flex justify-between gap-3 border-t border-dashed border-[#d9e2df] pt-3 text-[8px] text-[#6e8188]">
                  <span>Applied exchange rate</span><span className="settlement-mono font-medium text-[#385e68]">1 USD = 0.922 EUR</span>
                </div>
              </section>

              <section className="flex-1 pt-5">
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <p className="text-[7px] font-bold uppercase tracking-[.18em] text-[#8a999a]">Transfer record</p>
                    <h2 className="mt-1 text-[13px] font-semibold tracking-[-.02em] text-[#254356]">Settlement particulars</h2>
                  </div>
                  <span className="settlement-mono text-[7px] text-[#93a0a2]">01 / 01</span>
                </div>
                <dl className="border-y border-[#e5eae7]">
                  {particulars.map(([label, value], index) => (
                    <div key={label} className="grid grid-cols-[minmax(105px,1fr)_1.65fr] gap-4 border-b border-[#edf0ed] py-[9px] last:border-0 sm:grid-cols-[1fr_1.5fr]">
                      <dt className="text-[8px] text-[#829096]">{label}</dt>
                      <dd className={`break-words text-right text-[8px] ${index === 5 ? 'settlement-mono font-medium text-[#34716f]' : 'font-semibold text-[#385267]'}`}>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <footer className="mt-5 flex items-center justify-between gap-4 border-t border-[#e3e8e5] pt-4">
                <div className="flex min-w-0 items-start gap-2">
                  <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#4f8277]" />
                  <div>
                    <p className="text-[8px] font-semibold text-[#3d5968]">Record validated by Globus Bank</p>
                    <p className="settlement-mono mt-1 text-[7px] text-[#8a999a]">CHECKSUM · 4D9A-7C21-118E</p>
                  </div>
                </div>
                <div className="grid h-[48px] w-[48px] shrink-0 place-items-center rounded-full border border-dashed border-[#a5c4b2]">
                  <div className="grid h-[39px] w-[39px] place-items-center rounded-full border border-[#b9d0c2] text-center text-[#56826a]">
                    <div><FileCheck2 size={12} className="mx-auto" /><span className="mt-0.5 block text-[5px] font-bold uppercase tracking-[.1em]">Certified</span></div>
                  </div>
                </div>
              </footer>
              <div className="mt-4 flex items-center justify-between text-[7px] text-[#93a0a2]">
                <span>Generated 10 Nov 2026 · Archive series 06</span>
                <span className="font-serif text-[10px] italic text-[#77918b]">End of statement</span>
              </div>
            </div>
          </div>
          <div className="h-[3px] bg-[#dcebe2]" />
        </article>

        <div className="settlement-actions mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-[9px] text-[#74858d]">A ledger-first view of the completed settlement</p>
          <button type="button" onClick={() => { setPrinted(true); window.print(); }} className="inline-flex items-center gap-1.5 rounded-sm bg-[#1c4d5a] px-3 py-2 text-[9px] font-semibold text-[#f8fbf7] transition hover:bg-[#28636b] focus:outline-none focus:ring-2 focus:ring-[#7ba7a0] focus:ring-offset-2">
            <Printer size={12} /> {printed ? 'Print again' : 'Print statement'}
          </button>
        </div>
      </div>
    </main>
  );
}
