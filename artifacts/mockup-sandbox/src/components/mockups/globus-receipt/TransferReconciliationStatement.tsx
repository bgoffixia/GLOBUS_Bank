import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, BadgeCheck, Check, Copy, FileCheck2, Printer, Scale } from 'lucide-react';

const postings = [
  { code: '2205.410', account: 'Customer funds · USD', side: 'Debit', amount: '1,250.00', currency: 'USD', icon: ArrowUpRight },
  { code: '1010.025', account: 'International wire clearing', side: 'Credit', amount: '1,250.00', currency: 'USD', icon: ArrowDownLeft },
  { code: '1010.082', account: 'FX settlement · EUR', side: 'Debit', amount: '1,152.50', currency: 'EUR', icon: ArrowUpRight },
  { code: '2205.620', account: 'Beneficiary payable · EUR', side: 'Credit', amount: '1,152.50', currency: 'EUR', icon: ArrowDownLeft },
];

export default function TransferReconciliationStatement() {
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
    <main className="min-h-[100dvh] w-full overflow-y-auto bg-[#e9efed] px-3 py-5 text-[#18364c] sm:px-6 sm:py-8">
      <article className="mx-auto w-full max-w-[440px] overflow-hidden border border-[#d7e0dc] bg-[#fffefa] shadow-[0_18px_50px_rgba(28,55,67,.14)]">
        <header className="relative overflow-hidden bg-[#173b51] px-5 pb-5 pt-5 text-[#f7f6ef] sm:px-7">
          <div className="pointer-events-none absolute -right-9 -top-12 h-36 w-36 rounded-full border border-[#d3b973]/25" />
          <div className="pointer-events-none absolute -right-1 -top-5 h-24 w-24 rounded-full border border-white/10" />
          <div className="relative flex items-center justify-between border-b border-white/15 pb-3">
            <img src="/__mockup/images/globus-wordmark-transparent.png" alt="Globus Bank" className="h-auto w-[103px] brightness-0 invert" />
            <span className="font-mono text-[8px] tracking-[.15em] text-[#bfd1d1]">OPERATIONS COPY</span>
          </div>
          <div className="relative mt-4 flex items-start justify-between gap-2">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[.2em] text-[#a8d0ca]">Transfer settlement record</p>
              <h1 className="mt-1 font-serif text-[25px] leading-none tracking-[-.035em]">Posting statement</h1>
              <p className="mt-2 text-[9px] text-[#ccdad9]">International wire · completed and balanced</p>
            </div>
            <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 border border-[#a8cfc0]/35 bg-[#5c8976]/20 px-2 py-1.5 text-[8px] font-bold tracking-[.1em] text-[#d4eadc]">
              <BadgeCheck size={12} /> RECONCILED
            </span>
          </div>
        </header>

        <section className="px-5 pt-4 sm:px-7">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-[#e4e8e3] pb-4">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#849494]">Transfer reference</p>
              <button onClick={copyReference} className="mt-1 flex items-center gap-1 font-mono text-[9px] font-semibold text-[#245f65] hover:text-[#173b51]" aria-label="Copy transfer reference">
                GBX-20261110-8Q4K2P {copied ? <Check size={11} /> : <Copy size={10} />}
              </button>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#849494]">Posting date</p>
              <p className="mt-1 text-[9px] font-semibold">10 Nov 2026 · 09:42 UTC</p>
            </div>
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#849494]">Beneficiary</p>
              <p className="mt-1 text-[9px] font-semibold">Lena Moreau</p>
              <p className="text-[8px] text-[#72858a]">Société Générale · ···· 4281</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#849494]">Settlement route</p>
              <p className="mt-1 text-[9px] font-semibold">SWIFT · France</p>
              <p className="text-[8px] text-[#72858a]">Value date 11 Nov 2026</p>
            </div>
          </div>
        </section>

        <section className="px-5 pb-4 pt-3 sm:px-7">
          <div className="mb-2 flex items-end justify-between">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[.18em] text-[#49807d]">General ledger</p>
              <h2 className="mt-0.5 font-serif text-[18px] leading-none">Posting detail</h2>
            </div>
            <span className="font-mono text-[8px] text-[#8a9998]">BATCH FX-61110-0942</span>
          </div>
          <div className="overflow-hidden border border-[#dce4df]">
            <div className="grid grid-cols-[1.1fr_1.65fr_.75fr] bg-[#edf3ef] px-2.5 py-2 text-[7px] font-bold uppercase tracking-[.1em] text-[#718480]">
              <span>Ledger code</span><span>Account</span><span className="text-right">Posting</span>
            </div>
            {postings.map(({ code, account, side, amount, currency, icon: Icon }, index) => (
              <div key={code} className={`grid grid-cols-[1.1fr_1.65fr_.75fr] items-center gap-1 border-t border-[#e8ece8] px-2.5 py-2.5 ${index % 2 ? 'bg-[#fcfcf8]' : 'bg-white'}`}>
                <span className="font-mono text-[8px] font-semibold text-[#346c6d]">{code}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[8px] font-semibold text-[#354f5c]">{account}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[7px] text-[#889695]"><Icon size={9} />{side}</span>
                </span>
                <span className="text-right font-mono text-[8px] font-semibold tabular-nums text-[#294754]">{amount}<small className="ml-0.5 text-[7px] text-[#82908f]">{currency}</small></span>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="border border-[#dfe7e1] bg-[#f5f8f3] px-3 py-2">
              <p className="text-[7px] font-bold uppercase tracking-[.12em] text-[#788b84]">USD ledger totals</p>
              <div className="mt-1 flex justify-between font-mono text-[8px]"><span>Dr 1,250.00</span><span>Cr 1,250.00</span></div>
              <p className="mt-1 text-right text-[7px] font-bold text-[#3d7966]">Variance 0.00 USD</p>
            </div>
            <div className="border border-[#dfe7e1] bg-[#f5f8f3] px-3 py-2">
              <p className="text-[7px] font-bold uppercase tracking-[.12em] text-[#788b84]">EUR ledger totals</p>
              <div className="mt-1 flex justify-between font-mono text-[8px]"><span>Dr 1,152.50</span><span>Cr 1,152.50</span></div>
              <p className="mt-1 text-right text-[7px] font-bold text-[#3d7966]">Variance 0.00 EUR</p>
            </div>
          </div>
        </section>

        <section className="mx-5 mb-4 border-y border-[#e1e7e1] py-3 sm:mx-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-[#e8f1eb] text-[#4f806e]"><Scale size={13} /></div>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#567b70]">Posting control</p>
                <p className="mt-0.5 text-[8px] text-[#71827e]">Debits equal credits · both currencies</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-[8px] font-semibold">USD 1,250.00</p>
              <p className="font-mono text-[8px] font-semibold">EUR 1,152.50</p>
            </div>
          </div>
        </section>

        <footer className="flex items-center justify-between gap-2 px-5 pb-4 sm:px-7">
          <div className="flex items-center gap-1.5 text-[#688078]">
            <FileCheck2 size={12} />
            <span className="text-[7px] leading-3">System posted · control ref <span className="font-mono font-semibold">RCN-884192</span></span>
          </div>
          <button type="button" onClick={() => window.print()} className="inline-flex shrink-0 items-center gap-1.5 bg-[#173b51] px-3 py-2 text-[8px] font-bold text-white transition hover:bg-[#24566a]">
            <Printer size={11} /> Print statement
          </button>
        </footer>
      </article>
    </main>
  );
}
