import { useState } from 'react';
import { ArrowDownRight, BadgeCheck, CircleCheck, Printer, ShieldCheck } from 'lucide-react';

const details = [
  ['Beneficiary', 'Lena Moreau'],
  ['Receiving institution', 'Société Générale', 'France'],
  ['Destination account', 'FR•• •••• •••• 4281'],
  ['Payment route', 'International wire', 'EUR'],
  ['Settlement date', '10 November 2026', '09:42 UTC'],
];

export default function EditorialLedger() {
  const [printed, setPrinted] = useState(false);

  return (
    <main className="editorial-ledger min-h-[100dvh] bg-[#e9e5dc] px-3 py-5 text-[#243c42] sm:px-5 sm:py-7">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
        .editorial-ledger { font-family: 'DM Sans', 'Avenir Next', sans-serif; }
        .editorial-ledger .ed-serif { font-family: 'Instrument Serif', 'Iowan Old Style', Georgia, serif; }
        .editorial-ledger .ed-mono { font-family: 'DM Mono', 'SFMono-Regular', Consolas, monospace; }
        @media print {
          .editorial-ledger { background: white !important; padding: 0 !important; }
          .ed-sheet { box-shadow: none !important; border: 0 !important; }
          .ed-actions { display: none !important; }
        }
      `}</style>
      <div className="mx-auto max-w-[570px]">
        <article className="ed-sheet relative overflow-hidden border border-[#d7d2c7] bg-[#fbfaf6] shadow-[0_20px_60px_rgba(42,54,49,.14)]">
          <div className="flex items-center justify-between border-b border-[#e7e2d8] px-6 py-4 sm:px-9">
            <div className="flex items-center gap-2.5">
              <div className="grid h-7 w-7 place-items-center rounded-full border border-[#bb725e]">
                <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-[#bb725e]" />
              </div>
              <div>
                <p className="text-[13px] font-bold tracking-[-.05em] text-[#263f45]">globus<span className="font-medium text-[#b66c57]">bank</span></p>
                <p className="mt-[-1px] text-[6px] font-semibold uppercase tracking-[.19em] text-[#79877f]">International banking</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[7px] font-bold uppercase tracking-[.18em] text-[#9b9589]">Settlement record</p>
              <p className="ed-mono mt-1 text-[8px] text-[#4f6867]">NO. GB-26-1109-08417</p>
            </div>
          </div>

          <div className="px-6 pb-6 pt-7 sm:px-9 sm:pb-8 sm:pt-8">
            <div className="flex items-center gap-2 text-[#9d6655]">
              <span className="h-px w-7 bg-[#c18a77]" />
              <p className="text-[8px] font-bold uppercase tracking-[.2em]">A record of settlement</p>
            </div>
            <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-2">
              <h1 className="ed-serif max-w-[350px] text-[43px] leading-[.9] tracking-[-.035em] text-[#263d42] sm:text-[50px]">
                Payment<br /><em className="font-normal text-[#b86f5a]">completed.</em>
              </h1>
              <div className="mb-1 flex items-center gap-1.5 border border-[#d8e2d6] bg-[#f0f4ec] px-2 py-1.5 text-[#59745e]">
                <BadgeCheck size={12} strokeWidth={1.7} />
                <span className="text-[7px] font-bold uppercase tracking-[.12em]">Verified</span>
              </div>
            </div>
            <p className="mt-3 max-w-[350px] text-[10px] leading-[1.65] text-[#71807e]">
              Funds have been delivered to the beneficiary. This statement records the completed cross-border transfer.
            </p>

            <section className="mt-6 border-y border-[#dcd7cc] py-4">
              <div className="flex items-center justify-between">
                <p className="text-[7px] font-bold uppercase tracking-[.18em] text-[#8b8d83]">Value transferred</p>
                <p className="ed-mono text-[7px] text-[#8c9188]">USD → EUR</p>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_34px_1fr] items-center">
                <div>
                  <p className="ed-serif text-[34px] leading-none tracking-[-.04em] text-[#263e43]">$1,250<span className="text-[23px]">.00</span></p>
                  <p className="mt-1.5 text-[8px] text-[#7e8983]">Debited · USD</p>
                </div>
                <div className="grid place-items-center text-[#b66c57]">
                  <ArrowDownRight size={18} strokeWidth={1.4} />
                </div>
                <div className="text-right">
                  <p className="ed-serif text-[34px] leading-none tracking-[-.04em] text-[#b66c57]">€1,152<span className="text-[23px]">.50</span></p>
                  <p className="mt-1.5 text-[8px] text-[#7e8983]">Received · EUR</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-dashed border-[#ddd8ce] pt-2.5 text-[8px]">
                <span className="text-[#7b8781]">Applied exchange rate</span>
                <span className="ed-mono font-medium text-[#496765]">1 USD = 0.922 EUR</span>
              </div>
            </section>

            <section className="mt-5">
              <div className="mb-2 flex items-baseline justify-between">
                <div>
                  <p className="text-[7px] font-bold uppercase tracking-[.18em] text-[#9a6859]">The particulars</p>
                  <h2 className="ed-serif mt-0.5 text-[20px] leading-none text-[#2e484b]">Transfer details</h2>
                </div>
                <span className="ed-mono text-[7px] text-[#9b9a8d]">01 — 05</span>
              </div>
              <dl className="border-t border-[#dcd7cc]">
                {details.map(([label, value, extra], index) => (
                  <div key={label} className="grid grid-cols-[minmax(105px,.9fr)_1.5fr] items-center gap-3 border-b border-[#eae6de] py-[9px]">
                    <dt className="text-[8px] text-[#858b81]">{label}</dt>
                    <dd className="text-right">
                      <span className={`block break-words text-[8px] font-semibold text-[#40595a] ${index === 2 ? 'ed-mono tracking-[.02em]' : ''}`}>{value}</span>
                      {extra && <span className="mt-0.5 block text-[7px] text-[#92958b]">{extra}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3 border-t border-[#dcd7cc] pt-3">
              <div>
                <p className="text-[7px] font-bold uppercase tracking-[.17em] text-[#999387]">Transfer reference</p>
                <p className="ed-mono mt-1 break-all text-[9px] font-medium tracking-[.03em] text-[#416460]">GBX-20261110-8Q4K2P</p>
              </div>
              <div className="flex items-center gap-1.5 pb-0.5 text-[#66816c]">
                <CircleCheck size={13} strokeWidth={1.6} />
                <span className="text-[7px] font-semibold">Settled</span>
              </div>
            </section>

            <footer className="mt-5 flex items-center justify-between gap-3 border-t border-[#e7e2d8] pt-3">
              <div className="flex items-start gap-2">
                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-[#69826f]" />
                <div>
                  <p className="text-[7px] font-semibold text-[#526a65]">Validated by Globus Bank</p>
                  <p className="ed-mono mt-1 text-[6px] tracking-[.06em] text-[#93958a]">CHECKSUM · 4D9A-7C21-118E</p>
                </div>
              </div>
              <p className="ed-serif text-[12px] italic text-[#a77a68]">End of record</p>
            </footer>
          </div>
          <div className="h-[3px] bg-[#ba735c]" />
        </article>

        <div className="ed-actions mt-3 flex items-center justify-between gap-3 px-1">
          <p className="text-[8px] text-[#7d8278]">Prepared 10 November 2026 · Archive series 06</p>
          <button
            type="button"
            onClick={() => { setPrinted(true); window.print(); }}
            className="inline-flex items-center gap-1.5 border border-[#496765] bg-[#496765] px-3 py-2 text-[8px] font-semibold text-[#fbfaf6] transition hover:bg-[#355553] focus:outline-none focus:ring-2 focus:ring-[#ba735c] focus:ring-offset-2"
          >
            <Printer size={11} /> {printed ? 'Print again' : 'Print statement'}
          </button>
        </div>
      </div>
    </main>
  );
}
