import { useState } from 'react';

const transfer = {
  reference: 'GBX-20261110-8Q4K2P',
  sent: '$1,250.00',
  received: '€1,152.50',
  rate: '1 USD = 0.922 EUR',
  date: '10 November 2026 · 09:42 UTC',
  recipient: 'Lena Moreau',
  bank: 'Société Générale',
  account: '•••• 4281',
  country: 'France',
};

const auditRows = [
  ['Transfer initiated', '10 Nov 2026 · 09:42:16 UTC', 'USD account debited'],
  ['FX conversion booked', '10 Nov 2026 · 09:43:02 UTC', 'Rate locked at 0.922 EUR'],
  ['Settlement confirmed', '10 Nov 2026 · 10:18:41 UTC', 'Beneficiary bank acknowledged'],
];

export default function SettlementStatement() {
  const [copied, setCopied] = useState(false);

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(transfer.reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="statement-stage">
      <style>{`
        * { box-sizing: border-box; }
        .statement-stage {
          --navy: #173b4b; --ink: #28444c; --muted: #71868a; --rule: #dce4df;
          --paper: #fcfcf7; --sage: #dcebe1; --accent: #39786d;
          min-height: 100dvh; padding: 28px 20px; display: grid; place-items: center;
          color: var(--ink); background: #e8eeea;
          font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
        }
        .statement-paper {
          width: min(100%, 760px); overflow: hidden; background: var(--paper);
          border: 1px solid #d7e0da; box-shadow: 0 24px 64px rgba(28, 56, 59, .13);
          animation: statement-arrive .45s cubic-bezier(.2,.8,.2,1) both;
        }
        .statement-masthead {
          padding: 25px 42px 22px; color: #f4f4e9; background: var(--navy);
          display: flex; justify-content: space-between; align-items: center;
          border-bottom: 4px solid #a8c3b0;
        }
        .wordmark { font-size: 15px; letter-spacing: .045em; font-weight: 760; }
        .wordmark-mark { color: #a8cbb6; font-size: 18px; margin-right: 8px; }
        .masthead-note { color: #c2d0c8; text-align: right; font: 9px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .07em; text-transform: uppercase; }
        .statement-intro { padding: 30px 42px 25px; display: flex; align-items: end; justify-content: space-between; gap: 22px; }
        .eyebrow { margin: 0 0 9px; color: #718b81; font-size: 9px; font-weight: 800; letter-spacing: .17em; text-transform: uppercase; }
        .statement-title { margin: 0; color: #173b4b; font: 500 34px/.98 Georgia, 'Times New Roman', serif; letter-spacing: -.045em; }
        .intro-meta { max-width: 190px; color: var(--muted); text-align: right; font: 10px/1.65 ui-monospace, SFMono-Regular, Menlo, monospace; }
        .paid-stamp { display: inline-flex; align-items: center; gap: 7px; margin-top: 9px; padding: 5px 9px; color: #316e60; border: 1px solid #bfd5c6; border-radius: 2px; font: 800 9px ui-sans-serif, system-ui; letter-spacing: .12em; }
        .paid-dot { width: 6px; height: 6px; border-radius: 50%; background: #4d9079; }
        .statement-section { padding: 21px 42px; border-top: 1px solid var(--rule); }
        .section-label { display: flex; align-items: baseline; gap: 11px; margin: 0 0 15px; color: #183d4b; font-size: 11px; font-weight: 800; letter-spacing: .045em; }
        .section-number { color: #779387; font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; }
        .beneficiary-layout { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
        .field-label { display: block; margin-bottom: 6px; color: #82928e; font-size: 8px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
        .field-value { display: block; color: #294850; font-size: 12px; font-weight: 650; line-height: 1.45; }
        .field-value.large { font: 500 19px/1.1 Georgia, 'Times New Roman', serif; letter-spacing: -.02em; }
        .settlement { background: #f3f6f0; }
        .settlement-grid { display: grid; grid-template-columns: 1fr 48px 1fr; gap: 17px; align-items: center; }
        .settlement-cell:last-child { text-align: right; }
        .money { color: #203f49; font: 500 29px/1 Georgia, 'Times New Roman', serif; letter-spacing: -.045em; white-space: nowrap; }
        .settlement-cell:last-child .money { color: var(--accent); }
        .money-caption { margin-top: 8px; color: #83928c; font-size: 8px; font-weight: 800; letter-spacing: .13em; }
        .exchange-mark { width: 32px; height: 32px; display: grid; place-items: center; margin: auto; border: 1px solid #d1dfd5; border-radius: 50%; color: #648878; font-size: 14px; }
        .settlement-foot { display: flex; justify-content: space-between; gap: 16px; margin-top: 18px; padding-top: 12px; border-top: 1px solid #dfe7de; color: #718580; font: 9px ui-monospace, SFMono-Regular, Menlo, monospace; }
        .audit-table { width: 100%; border-collapse: collapse; }
        .audit-table th { padding: 0 8px 8px 0; color: #82928e; text-align: left; font-size: 8px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
        .audit-table td { padding: 9px 8px 9px 0; border-top: 1px solid #e5ebe5; color: #38545a; font-size: 9px; line-height: 1.4; }
        .audit-table td:first-child { font-weight: 750; }
        .audit-table td:nth-child(2) { color: #738783; font: 8px ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
        .audit-table td:last-child { text-align: right; color: #628175; }
        .reference-box { padding: 14px 17px; display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #f6f7f2; border: 1px solid #dce5dc; }
        .reference-code { color: #395b62; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .035em; }
        .copy-button, .print-button { border: 1px solid #cad9cf; background: transparent; color: #3e756a; cursor: pointer; font-size: 9px; font-weight: 800; letter-spacing: .04em; }
        .copy-button { min-width: 65px; padding: 8px 10px; }
        .copy-button:hover, .print-button:hover { background: #eaf1e9; }
        .statement-footer { padding: 14px 42px 18px; border-top: 1px solid var(--rule); display: flex; justify-content: space-between; align-items: center; gap: 12px; color: #82918c; font-size: 9px; }
        .footer-legal { max-width: 430px; margin: 0; line-height: 1.55; }
        .print-button { padding: 8px 11px; white-space: nowrap; }
        @keyframes statement-arrive { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 620px) {
          .statement-stage { padding: 12px; align-items: start; }
          .statement-masthead { padding: 20px 22px 18px; }
          .statement-intro { padding: 25px 22px 21px; align-items: start; flex-direction: column; }
          .statement-title { font-size: 31px; }
          .intro-meta { max-width: none; text-align: left; }
          .statement-section { padding: 19px 22px; }
          .beneficiary-layout { grid-template-columns: 1fr 1fr; row-gap: 16px; }
          .settlement-grid { grid-template-columns: 1fr 30px 1fr; gap: 7px; }
          .money { font-size: clamp(20px, 6vw, 27px); }
          .audit-table th:nth-child(3), .audit-table td:nth-child(3) { display: none; }
          .audit-table td:nth-child(2) { white-space: normal; }
          .statement-footer { padding: 14px 22px 18px; align-items: start; flex-direction: column; }
        }
        @media print { .statement-stage { padding: 0; background: white; } .statement-paper { width: 100%; box-shadow: none; border: 0; } .copy-button, .print-button { display: none; } }
        @media (prefers-reduced-motion: reduce) { .statement-paper { animation: none; } }
      `}</style>
      <article className="statement-paper" aria-label="Globus bank transfer statement">
        <header className="statement-masthead">
          <div className="wordmark"><span className="wordmark-mark">◉</span>globus</div>
          <div className="masthead-note">Payments &amp; settlements<br />Official transaction record</div>
        </header>

        <section className="statement-intro">
          <div>
            <p className="eyebrow">International transfer statement</p>
            <h1 className="statement-title">Settlement<br />confirmation</h1>
            <div className="paid-stamp"><span className="paid-dot" /> COMPLETED</div>
          </div>
          <div className="intro-meta">STATEMENT DATE<br />{transfer.date}<br />RECORD TYPE · OUTBOUND PAYMENT</div>
        </section>

        <section className="statement-section" aria-labelledby="beneficiary-heading">
          <h2 className="section-label" id="beneficiary-heading"><span className="section-number">01</span> Beneficiary details</h2>
          <div className="beneficiary-layout">
            <div><span className="field-label">Beneficiary</span><span className="field-value large">{transfer.recipient}</span></div>
            <div><span className="field-label">Receiving institution</span><span className="field-value">{transfer.bank}</span></div>
            <div><span className="field-label">Account / destination</span><span className="field-value">{transfer.account}<br />{transfer.country}</span></div>
          </div>
        </section>

        <section className="statement-section settlement" aria-labelledby="settlement-heading">
          <h2 className="section-label" id="settlement-heading"><span className="section-number">02</span> Settlement particulars</h2>
          <div className="settlement-grid">
            <div className="settlement-cell"><div className="money">{transfer.sent}</div><div className="money-caption">DEBITED · USD</div></div>
            <span className="exchange-mark" aria-hidden="true">→</span>
            <div className="settlement-cell"><div className="money">{transfer.received}</div><div className="money-caption">SETTLED · EUR</div></div>
          </div>
          <div className="settlement-foot"><span>Exchange rate · {transfer.rate}</span><span>Fees · $0.00</span></div>
        </section>

        <section className="statement-section" aria-labelledby="audit-heading">
          <h2 className="section-label" id="audit-heading"><span className="section-number">03</span> Audit trail</h2>
          <table className="audit-table">
            <thead><tr><th>Event</th><th>Recorded (UTC)</th><th>Posting detail</th></tr></thead>
            <tbody>{auditRows.map((row) => <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody>
          </table>
        </section>

        <section className="statement-section" aria-labelledby="reference-heading">
          <h2 className="section-label" id="reference-heading"><span className="section-number">04</span> Audit reference</h2>
          <div className="reference-box">
            <div><span className="field-label">Globus transaction identifier</span><span className="reference-code">{transfer.reference}</span></div>
            <button type="button" className="copy-button" onClick={copyReference}>{copied ? 'COPIED' : 'COPY ID'}</button>
          </div>
        </section>

        <footer className="statement-footer">
          <p className="footer-legal">This statement confirms completion of the transfer listed above. Retain the transaction identifier for future enquiries.</p>
          <button type="button" className="print-button" onClick={() => window.print()}>Print statement</button>
        </footer>
      </article>
    </main>
  );
}
