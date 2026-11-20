import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, BadgeCheck, Check, Copy, FileCheck2, Printer, Scale } from 'lucide-react';

const entries = [
  { code: '2205.410', account: 'Customer funds · USD', side: 'Debit', amount: '1,250.00', currency: 'USD', Icon: ArrowUpRight },
  { code: '1010.025', account: 'International wire clearing', side: 'Credit', amount: '1,250.00', currency: 'USD', Icon: ArrowDownLeft },
  { code: '1010.082', account: 'FX settlement · EUR', side: 'Debit', amount: '1,152.50', currency: 'EUR', Icon: ArrowUpRight },
  { code: '2205.620', account: 'Beneficiary payable · EUR', side: 'Credit', amount: '1,152.50', currency: 'EUR', Icon: ArrowDownLeft },
];

export default function TransferLedgerColumnar() {
  const [copied, setCopied] = useState(false);
  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText('GBX-20261110-8Q4K2P');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="min-h-[100dvh] w-full overflow-y-auto bg-[#e7eeeb] px-3 py-5 text-[#18384b] sm:px-6 sm:py-8">
      <article className="mx-auto max-w-[920px] overflow-hidden border border-[#d4dfda] bg-[#fffefa] shadow-[0_22px_58px_rgba(24,54,64,.14)]">
        <header className="relative overflow-hidden bg-[#173b51] px-6 py-5 text-[#f6f5ec] sm:px-9">
          <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full border border-[#d1bf84]/20" />
          <div className="pointer-events-none absolute right-10 -top-16 h-52 w-52 rounded-full border border-white/[.08]" />
          <div className="relative flex items-center justify-between border-b border-white/15 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-7 w-7 place-items-center rounded-full border border-[#a9cbb9]/50">
                <span className="h-3 w-3 rounded-full border-[1.5px] border-[#a9cbb9]" />
              </div>
              <div>
                <p className="text-[14px] font-bold tracking-[-.04em]">globus<span className="font-medium text-[#a9cbb9]">bank</span></p>
                <p className="text-[7px] font-semibold uppercase tracking-[.18em] text-[#b8ceca]">International banking</p>
              </div>
            </div>
            <span className="font-mono text-[8px] tracking-[.16em] text-[#c2d5d0]">OPERATIONS COPY · 10 NOV 2026</span>
          </div>
          <div className="relative grid gap-5 pt-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[.2em] text-[#a8d0c1]">Transfer settlement record</p>
              <h1 className="mt-1 font-serif text-[29px] leading-none tracking-[-.035em]">Posting ledger</h1>
              <p className="mt-2 text-[9px] text-[#ccd9d7]">International wire · completed and balanced</p>
            </div>
            <div className="inline-flex w-fit items-center gap-1.5 border border-[#a8cdb8]/40 bg-[#5c8976]/20 px-3 py-2 text-[8px] font-bold tracking-[.1em] text-[#d8eadc]">
              <BadgeCheck size={13} /> RECONCILED
            </div>
          </div>
        </header>

        <div className="grid md:grid-cols-[.83fr_1.6fr]">
          <aside className="border-b border-[#e1e8e3] bg-[#f3f6f1] px-6 py-5 sm:px-8 md:border-b-0 md:border-r">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[.16em] text-[#738983]">Transfer reference</p>
                <button onClick={copyReference} className="mt-1.5 flex items-center gap-1 font-mono text-[9px] font-semibold text-[#286568] hover:text-[#173b51]" aria-label="Copy transfer reference">
                  GBX-20261110-8Q4K2P {copied ? <Check size={11} /> : <Copy size={10} />}
                </button>
              </div>
              <span className="mt-1 h-2 w-2 rounded-full bg-[#568675]" />
            </div>

            <div className="mt-6 border-t border-[#dce5df] pt-4">
              <p className="text-[8px] font-bold uppercase tracking-[.16em] text-[#738983]">Parties & route</p>
              <dl className="mt-3 space-y-3">
                <div>
                  <dt className="text-[7px] uppercase tracking-[.12em] text-[#889893]">Beneficiary</dt>
                  <dd className="mt-0.5 text-[10px] font-semibold">Lena Moreau</dd>
                  <dd className="text-[8px] text-[#72858a]">Société Générale · ···· 4281</dd>
                </div>
                <div>
                  <dt className="text-[7px] uppercase tracking-[.12em] text-[#889893]">Settlement route</dt>
                  <dd className="mt-0.5 text-[9px] font-semibold">SWIFT · France</dd>
                  <dd className="text-[8px] text-[#72858a]">Value date 11 Nov 2026</dd>
                </div>
                <div>
                  <dt className="text-[7px] uppercase tracking-[.12em] text-[#889893]">Posting date</dt>
                  <dd className="mt-0.5 text-[9px] font-semibold">10 Nov 2026 · 09:42 UTC</dd>
                </div>
              </dl>
            </div>

            <div className="mt-6 border-t border-[#dce5df] pt-4">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-[#e2ede5] text-[#4d7a6a]"><Scale size={13} /></div>
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#567b70]">Posting control</p>
                  <p className="mt-0.5 text-[8px] text-[#71827e]">Debits equal credits</p>
                </div>
              </div>
              <div className="mt-3 space-y-1 border-l-2 border-[#9cbcab] pl-3 font-mono text-[8px] font-semibold text-[#3b5963]">
                <p>USD 1,250.00 · balanced</p>
                <p>EUR 1,152.50 · balanced</p>
              </div>
            </div>
          </aside>

          <section className="px-5 py-5 sm:px-8">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[.18em] text-[#49807d]">General ledger</p>
                <h2 className="mt-0.5 font-serif text-[21px] leading-none">Posting detail</h2>
              </div>
              <span className="font-mono text-[8px] text-[#8a9998]">BATCH FX-61110-0942</span>
            </div>

            <div className="space-y-4">
              {(['USD', 'EUR'] as const).map((currency) => {
                const rows = entries.filter((entry) => entry.currency === currency);
                const total = currency === 'USD' ? '1,250.00' : '1,152.50';
                return (
                  <section key={currency} className="border border-[#dce4df]">
                    <div className="flex items-center justify-between bg-[#edf3ef] px-3 py-2">
                      <span className="text-[8px] font-bold uppercase tracking-[.13em] text-[#647c75]">{currency} settlement</span>
                      <span className="font-mono text-[8px] font-semibold text-[#365c62]">{currency} {total}</span>
                    </div>
                    {rows.map(({ code, account, side, amount, Icon }) => (
                      <div key={code} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[#e8ece8] px-3 py-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center ${side === 'Debit' ? 'bg-[#e7efeb] text-[#47786c]' : 'bg-[#f2eee2] text-[#8a7952]'}`}><Icon size={12} /></span>
                          <span className="min-w-0">
                            <span className="block truncate text-[9px] font-semibold text-[#354f5c]">{account}</span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[7px] text-[#82918e]"><span className="font-mono text-[#3d7775]">{code}</span><span>·</span>{side}</span>
                          </span>
                        </div>
                        <span className="text-right font-mono text-[9px] font-semibold tabular-nums text-[#294754]">{amount}<small className="ml-1 text-[7px] text-[#82908f]">{currency}</small></span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-dashed border-[#dce5df] px-3 py-2 text-[7px]">
                      <span className="text-[#738783]">Debit equals credit</span>
                      <span className="font-semibold text-[#3d7966]">Variance 0.00 {currency}</span>
                    </div>
                  </section>
                );
              })}
            </div>

            <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e7e1] pt-4">
              <div className="flex items-center gap-1.5 text-[#688078]">
                <FileCheck2 size={12} />
                <span className="text-[7px] leading-3">System posted · control ref <span className="font-mono font-semibold">RCN-884192</span></span>
              </div>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 bg-[#173b51] px-3 py-2 text-[8px] font-bold text-white transition hover:bg-[#24566a]">
                <Printer size={11} /> Print statement
              </button>
            </footer>
          </section>
        </div>
      </article>
    </main>
  );
}
