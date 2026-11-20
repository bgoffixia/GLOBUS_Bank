import { useState } from 'react';
import { ArrowDownLeft, ArrowRight, BadgeCheck, Banknote, Check, Clock3, FileCheck2, Printer, ShieldCheck, Sparkles } from 'lucide-react';

export default function SettlementTimeline() {
  const [printed, setPrinted] = useState(false);

  const milestones = [
    {
      time: '09:18 UTC',
      date: '10 November 2026',
      title: 'Transfer initiated',
      detail: 'USD 1,250.00 released from your Globus multi-currency account.',
      icon: ArrowDownLeft,
      state: 'complete',
      tag: 'DEBIT',
    },
    {
      time: '09:26 UTC',
      date: '10 November 2026',
      title: 'Exchange applied',
      detail: 'Converted at the applied rate of 1 USD = 0.922 EUR.',
      icon: Sparkles,
      state: 'complete',
      tag: 'FX LOCKED',
    },
    {
      time: '09:31 UTC',
      date: '10 November 2026',
      title: 'Sent to receiving bank',
      detail: 'International wire routed to Société Générale · France.',
      icon: ArrowRight,
      state: 'complete',
      tag: 'IN TRANSIT',
    },
    {
      time: '09:42 UTC',
      date: '10 November 2026',
      title: 'Funds settled',
      detail: 'Lena Moreau received €1,152.50 in her EUR account.',
      icon: Check,
      state: 'current',
      tag: 'COMPLETED',
    },
  ];

  return (
    <main className="min-h-[100dvh] bg-[#e8edf0] px-3 py-5 text-[#21384b] sm:px-6 sm:py-8">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
        .timeline-layout { font-family: 'DM Sans', sans-serif; }
        .timeline-layout h1, .timeline-layout .timeline-amount { font-family: 'Instrument Serif', serif; }
        .timeline-mono { font-family: 'DM Mono', monospace; }
        @media print {
          .timeline-actions { display: none !important; }
          .timeline-sheet { box-shadow: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
      <div className="timeline-layout mx-auto max-w-[840px]">
        <article className="timeline-sheet overflow-hidden border border-[#d5dfe2] bg-[#fffefa] shadow-[0_18px_52px_rgba(30,55,72,.15)]">
          <header className="relative overflow-hidden bg-[#183b4b] px-6 pb-7 pt-6 text-[#f7f7ed] sm:px-9 sm:pb-8 sm:pt-7">
            <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border border-white/[.09]" />
            <div className="pointer-events-none absolute -right-2 -top-16 h-44 w-44 rounded-full border border-[#b9d4c4]/20" />
            <div className="relative flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-full border border-[#b9d4c4]/45">
                  <span className="h-3 w-3 rounded-full border-[1.5px] border-[#9ec7b5]" />
                </div>
                <div>
                  <p className="text-[15px] font-bold tracking-[-.04em]">globus<span className="font-medium text-[#9ec7b5]">bank</span></p>
                  <p className="mt-0.5 text-[7px] font-semibold uppercase tracking-[.19em] text-[#b7c8c8]">International banking</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 border border-[#a8ccb7]/35 bg-[#dcebe0]/10 px-2.5 py-1.5 text-[#d2e7d8]">
                <BadgeCheck size={13} strokeWidth={1.8} />
                <span className="text-[7px] font-bold uppercase tracking-[.14em]">Settled · Verified</span>
              </div>
            </div>

            <div className="relative mt-8 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[.2em] text-[#a7c9b9]">Your payment, step by step</p>
                <h1 className="mt-2 text-[34px] leading-[.97] tracking-[-.025em] sm:text-[40px]">A clear path<br className="sm:hidden" /> to settled.</h1>
                <p className="mt-3 max-w-[390px] text-[10px] leading-relaxed text-[#c0d0ce]">Every checkpoint, from the first debit to final delivery.</p>
              </div>
              <div className="sm:text-right">
                <p className="text-[7px] font-bold uppercase tracking-[.17em] text-[#a9c1c0]">Beneficiary received</p>
                <p className="timeline-amount mt-1 text-[35px] leading-none tracking-[-.035em] text-[#f7f7ed]">€1,152.50</p>
                <p className="mt-1.5 text-[8px] text-[#b5c9c7]">EUR · Lena Moreau</p>
              </div>
            </div>
          </header>

          <div className="grid sm:grid-cols-[minmax(0,1.4fr)_minmax(210px,.8fr)]">
            <section className="px-6 py-7 sm:px-9" aria-labelledby="payment-timeline-heading">
              <div className="mb-6 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[7px] font-bold uppercase tracking-[.18em] text-[#8a999a]">Settlement journey</p>
                  <h2 id="payment-timeline-heading" className="mt-1 text-[14px] font-semibold tracking-[-.02em] text-[#254356]">Tuesday, 10 November</h2>
                </div>
                <span className="timeline-mono text-[7px] text-[#93a0a2]">4 CHECKPOINTS</span>
              </div>

              <ol className="relative">
                {milestones.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.title} className={`relative grid grid-cols-[31px_minmax(0,1fr)] gap-3 ${index < milestones.length - 1 ? 'pb-7' : ''}`}>
                      {index < milestones.length - 1 && <span className="absolute bottom-0 left-[14px] top-[30px] w-px bg-[#dce5df]" />}
                      <span className={`relative z-[1] grid h-[30px] w-[30px] place-items-center rounded-full border ${item.state === 'current' ? 'border-[#8db29d] bg-[#e7f0e8] text-[#3f7568]' : 'border-[#d5e2d9] bg-[#f2f6f0] text-[#638679]'}`}>
                        <Icon size={13} strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <h3 className="text-[10px] font-semibold text-[#294657]">{item.title}</h3>
                          <span className={`timeline-mono text-[7px] font-medium tracking-[.04em] ${item.state === 'current' ? 'text-[#4f8277]' : 'text-[#839397]'}`}>{item.time}</span>
                        </div>
                        <p className="mt-1 text-[8px] leading-[1.65] text-[#77888d]">{item.detail}</p>
                        <p className="timeline-mono mt-2 text-[6px] font-medium tracking-[.14em] text-[#91a29e]">{item.tag}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-1 flex items-center gap-2 border-t border-dashed border-[#dfe7e1] pt-4 text-[8px] text-[#7d8d90]">
                <Clock3 size={12} className="text-[#668a7d]" />
                All times shown in UTC
              </div>
            </section>

            <aside className="border-t border-[#e4e9e5] bg-[#f7f8f3] px-6 py-7 sm:border-l sm:border-t-0 sm:px-6">
              <p className="text-[7px] font-bold uppercase tracking-[.18em] text-[#8a999a]">Payment details</p>
              <div className="mt-4 border-y border-[#e2e8e2] py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[7px] font-bold uppercase tracking-[.16em] text-[#87969a]">You sent</p>
                    <p className="timeline-amount mt-1 text-[24px] leading-none text-[#1c4055]">$1,250.00</p>
                    <p className="mt-1 text-[7px] text-[#829198]">USD · Globus multi-currency</p>
                  </div>
                  <Banknote size={18} strokeWidth={1.4} className="text-[#6b8e82]" />
                </div>
                <div className="mt-4 flex justify-between gap-3 border-t border-dashed border-[#d9e2df] pt-3 text-[8px]">
                  <span className="text-[#6e8188]">Exchange rate</span>
                  <span className="timeline-mono text-[7px] font-medium text-[#385e68]">1 USD = 0.922 EUR</span>
                </div>
              </div>
              <dl className="space-y-3 pt-4">
                <div>
                  <dt className="text-[7px] text-[#829096]">Receiving institution</dt>
                  <dd className="mt-0.5 text-[8px] font-semibold text-[#385267]">Société Générale · France</dd>
                </div>
                <div>
                  <dt className="text-[7px] text-[#829096]">Destination account</dt>
                  <dd className="timeline-mono mt-0.5 text-[8px] font-medium text-[#385267]">FR•• •••• •••• 4281</dd>
                </div>
                <div>
                  <dt className="text-[7px] text-[#829096]">Payment route</dt>
                  <dd className="mt-0.5 text-[8px] font-semibold text-[#385267]">International wire · EUR</dd>
                </div>
              </dl>
              <div className="mt-5 flex items-start gap-2 border-t border-[#e1e8e1] pt-4">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#4f8277]" />
                <div>
                  <p className="text-[8px] font-semibold text-[#3d5968]">Validated settlement record</p>
                  <p className="timeline-mono mt-1 text-[6px] text-[#8a999a]">CHECKSUM · 4D9A-7C21-118E</p>
                </div>
              </div>
            </aside>
          </div>

          <footer className="flex flex-col gap-3 border-t border-[#e3e8e5] bg-[#fffefa] px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-9">
            <div>
              <p className="text-[7px] font-bold uppercase tracking-[.16em] text-[#839096]">Transfer reference</p>
              <p className="timeline-mono mt-1 text-[8px] font-medium text-[#34716f]">GBX-20261110-8Q4K2P</p>
            </div>
            <div className="flex items-center gap-2 text-[7px] text-[#829096]">
              <FileCheck2 size={13} className="text-[#6b8e82]" />
              <span>Document GB-ARC-26-1109-08417 · Archive series 06</span>
            </div>
          </footer>
          <div className="h-[3px] bg-[#dcebe2]" />
        </article>

        <div className="timeline-actions mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-[9px] text-[#74858d]">A payment timeline, from initiation through settlement.</p>
          <button type="button" onClick={() => { setPrinted(true); window.print(); }} className="inline-flex items-center gap-1.5 rounded-sm bg-[#1c4d5a] px-3 py-2 text-[9px] font-semibold text-[#f8fbf7] transition hover:bg-[#28636b] focus:outline-none focus:ring-2 focus:ring-[#7ba7a0] focus:ring-offset-2">
            <Printer size={12} /> {printed ? 'Print again' : 'Print timeline'}
          </button>
        </div>
      </div>
    </main>
  );
}
