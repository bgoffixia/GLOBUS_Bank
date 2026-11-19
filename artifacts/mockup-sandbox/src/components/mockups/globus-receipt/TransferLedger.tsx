import { useState } from 'react';

const transfer = {
  reference: 'GBX-20261110-8Q4K2P',
  sent: '$1,250.00',
  received: '€1,152.50',
  rate: '1 USD = 0.922 EUR',
  date: '10 Nov 2026 · 09:42 UTC',
  recipient: 'Lena Moreau',
  bank: 'Société Générale',
  account: '•••• 4281',
  country: 'France',
};

const stages = [
  { title: 'Transfer initiated', time: '09:42 UTC', note: 'Funds left your Globus USD account.', mark: '01', amount: '− $1,250.00' },
  { title: 'Currency exchanged', time: '09:43 UTC', note: 'Converted at the rate locked for this transfer.', mark: '02', amount: '1 USD → 0.922 EUR' },
  { title: 'Payment delivered', time: '10:18 UTC', note: 'Received by Société Générale in France.', mark: '03', amount: '+ €1,152.50' },
];

export default function TransferLedger() {
  const [expanded, setExpanded] = useState<number | null>(2);
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
    <main className="ledger-page">
      <style>{`
        * { box-sizing: border-box; }
        .ledger-page {
          --ink:#183e4a; --sub:#70868a; --line:#dce6df; --mint:#e7f1e8; --teal:#387c70;
          min-height:100dvh; padding:22px 15px; display:flex; justify-content:center; align-items:center;
          background:#e9efea; color:var(--ink); font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;
        }
        .ledger {
          width:min(100%,420px); overflow:hidden; background:#fbfcf7; border-radius:21px;
          box-shadow:0 22px 55px rgba(29,61,65,.14); animation:ledger-in .5s cubic-bezier(.2,.8,.2,1) both;
        }
        .ledger-head { padding:22px 24px 20px; background:#173c4b; color:#f1f4e9; }
        .ledger-brand { display:flex; justify-content:space-between; align-items:center; color:#bfcec4; font-size:10px; letter-spacing:.15em; text-transform:uppercase; font-weight:750; }
        .ledger-wordmark { color:#f1f4e9; letter-spacing:.04em; font-size:12px; }
        .head-kicker { margin:25px 0 8px; color:#a8cbb7; font-size:9px; font-weight:750; letter-spacing:.18em; text-transform:uppercase; }
        .head-title { margin:0; font:500 29px/1.06 Georgia,serif; letter-spacing:-.04em; }
        .head-status { margin:13px 0 0; color:#c8d8cf; font-size:11px; display:flex; align-items:center; gap:8px; }
        .status-check { width:17px; height:17px; border-radius:50%; display:grid; place-items:center; background:#427d6d; color:#e9f5e8; font-size:10px; }
        .recipient-block { padding:21px 24px 19px; border-bottom:1px solid var(--line); }
        .overline { color:#859895; font-size:9px; font-weight:750; letter-spacing:.15em; text-transform:uppercase; }
        .recipient-row { display:flex; align-items:center; gap:12px; margin-top:12px; }
        .recipient-initial { width:40px; height:40px; border-radius:50%; display:grid; place-items:center; color:#397367; background:#e3eee5; font:17px Georgia,serif; }
        .recipient-name { margin:0; font:500 19px/1.15 Georgia,serif; letter-spacing:-.02em; }
        .recipient-bank { margin:5px 0 0; color:var(--sub); font-size:10px; }
        .country-tag { margin-left:auto; align-self:flex-start; border:1px solid #dce7df; border-radius:99px; padding:6px 9px; color:#52766e; font-size:9px; font-weight:700; }
        .amount-section { padding:19px 24px 20px; background:#f4f6ef; border-bottom:1px solid var(--line); }
        .amount-grid { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:11px; margin-top:12px; }
        .amount { font:500 23px/1 Georgia,serif; letter-spacing:-.045em; white-space:nowrap; }
        .amount.to { color:var(--teal); text-align:right; }
        .amount-label { color:#82928d; font-size:9px; margin-top:7px; letter-spacing:.09em; }
        .amount-label.to { text-align:right; }
        .conversion { color:#6f9180; border:1px solid #dce8dc; background:#fbfcf7; width:30px; height:30px; border-radius:50%; display:grid; place-items:center; font-size:14px; }
        .fx-line { margin-top:13px; text-align:center; font:10px ui-monospace,SFMono-Regular,Menlo,monospace; color:#7e918c; }
        .timeline { padding:20px 24px 8px; }
        .section-heading { margin:0 0 14px; display:flex; justify-content:space-between; align-items:center; }
        .section-heading strong { font-size:11px; letter-spacing:.02em; }
        .section-heading span { color:#8b9a96; font-size:9px; }
        .stage { display:grid; grid-template-columns:27px 1fr; gap:11px; position:relative; padding-bottom:6px; }
        .stage:not(:last-child):before { content:""; position:absolute; left:8px; top:20px; bottom:-2px; border-left:1px dashed #cbdad0; }
        .stage-button { position:relative; z-index:1; display:grid; place-items:center; width:18px; height:18px; margin-top:2px; border-radius:50%; background:#dcebe0; color:#367a6c; font-size:9px; }
        .stage-button.current { background:#3d806f; color:#f3f7ea; }
        .stage-main { width:100%; padding:0 0 12px; border:0; background:none; text-align:left; cursor:pointer; color:inherit; }
        .stage-topline { display:flex; justify-content:space-between; gap:8px; align-items:baseline; }
        .stage-title { font-size:11px; font-weight:750; }
        .stage-time { color:#899b96; font:9px ui-monospace,SFMono-Regular,Menlo,monospace; white-space:nowrap; }
        .stage-note { margin:5px 0 0; color:#7a8e8b; font-size:10px; line-height:1.45; }
        .stage-amount { margin-top:8px; color:#3c7169; font:10px ui-monospace,SFMono-Regular,Menlo,monospace; }
        .reference { margin:5px 24px 19px; padding:12px 13px; display:flex; align-items:center; justify-content:space-between; border:1px solid #dfe8df; border-radius:10px; background:#f9faf5; }
        .ref-code { margin-top:5px; color:#426169; font:10px ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.01em; }
        .copy { border:0; background:none; padding:7px 0 7px 8px; color:#397a70; font-size:10px; font-weight:750; cursor:pointer; }
        .ledger-foot { padding:13px 24px 16px; border-top:1px solid #e5ebe4; display:flex; align-items:center; justify-content:space-between; }
        .foot-note { margin:0; color:#83938e; font:italic 11px Georgia,serif; }
        .print { border:1px solid #dbe5dc; border-radius:8px; background:#fbfcf7; padding:8px 10px; color:#3b6266; font-size:9px; font-weight:750; cursor:pointer; }
        .print:hover { background:#edf4ed; }
        @keyframes ledger-in { from { opacity:0; transform:translateY(9px); } to { opacity:1; transform:translateY(0); } }
        @media(max-width:390px) { .ledger-page{padding:10px}.ledger-head{padding:20px}.recipient-block,.amount-section,.timeline{padding-left:20px;padding-right:20px}.reference{margin-left:20px;margin-right:20px}.ledger-foot{padding-left:20px;padding-right:20px}.amount{font-size:21px} }
        @media print { .ledger-page{padding:0;background:#fff}.ledger{box-shadow:none;border:1px solid #dce6df}.copy,.print{display:none} }
        @media(prefers-reduced-motion:reduce) { .ledger{animation:none} }
      `}</style>
      <article className="ledger" aria-label="Globus international transfer record">
        <header className="ledger-head">
          <div className="ledger-brand"><span className="ledger-wordmark">◉ &nbsp;globus</span><span>Transfer record</span></div>
          <p className="head-kicker">International payment · complete</p>
          <h1 className="head-title">Delivered,<br />down to the last cent.</h1>
          <p className="head-status"><span className="status-check">✓</span> Funds received · {transfer.date}</p>
        </header>

        <section className="recipient-block" aria-label="Beneficiary">
          <div className="overline">Delivered to</div>
          <div className="recipient-row">
            <div className="recipient-initial" aria-hidden="true">L</div>
            <div><h2 className="recipient-name">{transfer.recipient}</h2><p className="recipient-bank">{transfer.bank} · {transfer.account}</p></div>
            <span className="country-tag">{transfer.country}</span>
          </div>
        </section>

        <section className="amount-section" aria-label="Settled amounts">
          <div className="overline">Settlement summary</div>
          <div className="amount-grid">
            <div><div className="amount">{transfer.sent}</div><div className="amount-label">YOU SENT · USD</div></div>
            <span className="conversion" aria-hidden="true">→</span>
            <div><div className="amount to">{transfer.received}</div><div className="amount-label to">RECIPIENT GOT · EUR</div></div>
          </div>
          <div className="fx-line">{transfer.rate}</div>
        </section>

        <section className="timeline" aria-label="Transfer stages">
          <div className="section-heading"><strong>Funds, step by step</strong><span>3 completed stages</span></div>
          {stages.map((stage, index) => (
            <div className="stage" key={stage.mark}>
              <span className={`stage-button ${index === 2 ? 'current' : ''}`} aria-hidden="true">{index === 2 ? '✓' : stage.mark}</span>
              <button className="stage-main" type="button" aria-expanded={expanded === index} onClick={() => setExpanded(expanded === index ? null : index)}>
                <span className="stage-topline"><span className="stage-title">{stage.title}</span><span className="stage-time">{stage.time}</span></span>
                {expanded === index && <><p className="stage-note">{stage.note}</p><div className="stage-amount">{stage.amount}</div></>}
              </button>
            </div>
          ))}
        </section>

        <div className="reference">
          <div><div className="overline">Transfer reference</div><div className="ref-code">{transfer.reference}</div></div>
          <button type="button" className="copy" onClick={copyReference}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <footer className="ledger-foot">
          <p className="foot-note">A little closer, across borders.</p>
          <button type="button" className="print" onClick={() => window.print()}>↗ &nbsp;Print record</button>
        </footer>
      </article>
    </main>
  );
}
