import { useState } from 'react';

const receipt = {
  reference: 'GBX-20261110-8Q4K2P',
  sent: '$1,250.00',
  received: '€1,152.50',
  rate: '1 USD = 0.922 EUR',
  date: '10 Nov 2026 · 09:42 UTC',
  recipient: 'Lena Moreau',
  bank: 'Société Générale',
  account: '•••• 4281',
  country: 'France',
  route: 'International wire',
  note: 'A little closer, across borders.',
};

export default function TransferJourney() {
  const [view, setView] = useState<'journey' | 'details'>('journey');
  const [copied, setCopied] = useState(false);

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(receipt.reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="journey-shell">
      <style>{`
        * { box-sizing: border-box; }
        .journey-shell {
          --ink: #203b50; --muted: #82939c; --sea: #347c78; --line: #dce8e4;
          min-height: 100dvh; padding: 24px 18px; display: grid; place-items: center;
          background: radial-gradient(ellipse at 50% 4%, #f4f4e9 0, #e8f0ec 56%, #dfe9e6 100%);
          color: var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
        }
        .journey-card {
          width: min(100%, 414px); overflow: hidden; border-radius: 22px; background: #fffefa;
          box-shadow: 0 24px 60px rgba(31, 64, 73, .13), 0 3px 12px rgba(31, 64, 73, .06);
          animation: rise-in .55s cubic-bezier(.2,.8,.2,1) both;
        }
        .journey-top { padding: 23px 25px 19px; background: #173951; color: #f5f5e9; position: relative; }
        .journey-top:after { content:""; position:absolute; width:185px; height:185px; border-radius:50%; border:1px solid rgba(194,220,205,.18); right:-74px; top:-108px; box-shadow:0 0 0 22px rgba(194,220,205,.035), 0 0 0 46px rgba(194,220,205,.025); }
        .brand-row { position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; }
        .brand { display:flex; align-items:center; gap:9px; font-size:13px; font-weight:750; letter-spacing:.02em; }
        .brand-mark { width:23px; height:23px; border:1px solid #a9c9bc; border-radius:50%; display:grid; place-items:center; color:#bad5c7; font:11px Georgia,serif; }
        .receipt-label { color:#a9c7bd; font-size:9px; letter-spacing:.16em; text-transform:uppercase; font-weight:750; }
        .top-title { margin:23px 0 2px; font:500 25px/1.1 Georgia, 'Times New Roman', serif; letter-spacing:-.035em; }
        .top-sub { margin:0; color:#bed0ca; font-size:11px; }
        .success { display:inline-flex; gap:7px; align-items:center; padding:7px 10px; margin-top:16px; background:#295c57; color:#d9ece0; border-radius:30px; font-size:10px; font-weight:700; }
        .success-dot { width:6px; height:6px; background:#a6d5b4; border-radius:50%; box-shadow:0 0 0 3px rgba(166,213,180,.13); }
        .content { padding:0 25px 21px; }
        .amount-panel { padding:22px 0 20px; border-bottom:1px dashed #d9e3df; }
        .caption { color:var(--muted); text-transform:uppercase; letter-spacing:.12em; font-weight:750; font-size:9px; }
        .amount-flow { display:grid; grid-template-columns:1fr 34px 1fr; align-items:center; margin-top:13px; }
        .money { font:500 24px/1 Georgia, 'Times New Roman', serif; letter-spacing:-.045em; white-space:nowrap; }
        .money.destination { color:var(--sea); text-align:right; }
        .currency-label { margin-top:7px; font-size:10px; color:#788c94; }
        .destination-label { text-align:right; }
        .arrow { height:30px; width:30px; border:1px solid #d7e5dd; color:#548f80; background:#f1f7f1; border-radius:50%; display:grid; place-items:center; font-size:15px; justify-self:center; }
        .rate { text-align:center; margin-top:16px; font:10px ui-monospace, SFMono-Regular, Menlo, monospace; color:#71888c; }
        .tabs { display:flex; gap:22px; margin:16px 0 17px; border-bottom:1px solid #e8eeeb; }
        .tab { border:0; padding:0 0 10px; margin-bottom:-1px; background:none; color:#91a0a4; font:700 10px inherit; font-size:10px; letter-spacing:.03em; cursor:pointer; border-bottom:2px solid transparent; }
        .tab.active { color:#285f60; border-bottom-color:#43877b; }
        .journey { padding:2px 0 4px; }
        .journey-row { display:grid; grid-template-columns:25px 1fr auto; gap:12px; position:relative; min-height:64px; }
        .journey-row:first-child:after { content:""; position:absolute; width:1px; background:#d8e5df; top:18px; bottom:-4px; left:8px; }
        .node { position:relative; z-index:1; margin-top:3px; width:17px; height:17px; display:grid; place-items:center; border-radius:50%; background:#e8f1eb; color:#397b72; font-size:9px; }
        .node.finish { background:#347c78; color:white; }
        .row-title { margin:0; color:#344e5c; font-size:11px; font-weight:700; }
        .row-meta { margin:4px 0 0; color:#89999c; font-size:10px; }
        .row-amount { padding-top:1px; color:#355362; font:600 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
        .details { display:grid; grid-template-columns:1fr 1fr; gap:16px 14px; padding:3px 0 9px; animation: rise-in .25s ease both; }
        .detail-item.wide { grid-column:1 / -1; }
        .detail-value { margin-top:5px; color:#385362; font-size:11px; font-weight:650; overflow-wrap:anywhere; }
        .reference-bar { display:flex; align-items:center; justify-content:space-between; padding:12px 13px; border:1px solid #e3ebe7; border-radius:10px; background:#f8faf6; margin-top:10px; }
        .ref-value { margin-top:4px; color:#45606a; font:10px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing:.01em; }
        .copy-button { border:0; background:transparent; color:#367c73; font-size:10px; font-weight:750; cursor:pointer; padding:7px 2px 7px 8px; }
        .footer { display:flex; align-items:center; justify-content:space-between; border-top:1px solid #e9eeeb; padding:14px 25px 16px; }
        .footer-note { margin:0; font:italic 12px Georgia,serif; color:#809291; }
        .print-button { display:flex; align-items:center; gap:7px; border:1px solid #dbe6e0; border-radius:8px; padding:8px 11px; background:#fffefa; color:#345d62; font-size:10px; font-weight:750; cursor:pointer; transition:transform .18s ease, background .18s ease; }
        .print-button:hover { transform:translateY(-1px); background:#f0f6f1; }
        @keyframes rise-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @media(max-width:420px) { .journey-shell { padding:12px; } .journey-card { border-radius:18px; } .journey-top { padding:20px 21px 18px; } .content { padding-left:21px; padding-right:21px; } .footer { padding-left:21px; padding-right:21px; } .money { font-size:22px; } }
        @media print { .journey-shell { padding:0; background:white; } .journey-card { box-shadow:none; border:1px solid #dfe7e2; } .tabs,.print-button,.copy-button { display:none; } }
      `}</style>
      <section className="journey-card" aria-label="Globus transfer receipt">
        <header className="journey-top">
          <div className="brand-row">
            <div className="brand"><span className="brand-mark">G</span> globus</div>
            <span className="receipt-label">Payment record</span>
          </div>
          <h1 className="top-title">Transfer completed</h1>
          <p className="top-sub">Your money has reached its destination.</p>
          <span className="success"><span className="success-dot" /> Successfully delivered</span>
        </header>

        <div className="content">
          <section className="amount-panel" aria-label="Transfer amounts">
            <div className="caption">Transfer total</div>
            <div className="amount-flow">
              <div><div className="money">{receipt.sent}</div><div className="currency-label">SENT · USD</div></div>
              <span className="arrow" aria-hidden="true">→</span>
              <div className="destination-label"><div className="money destination">{receipt.received}</div><div className="currency-label">ARRIVED · EUR</div></div>
            </div>
            <div className="rate">{receipt.rate}</div>
          </section>

          <nav className="tabs" aria-label="Receipt sections">
            <button type="button" className={`tab ${view === 'journey' ? 'active' : ''}`} onClick={() => setView('journey')}>Transfer journey</button>
            <button type="button" className={`tab ${view === 'details' ? 'active' : ''}`} onClick={() => setView('details')}>Payment details</button>
          </nav>

          {view === 'journey' ? (
            <section className="journey" aria-label="Transfer journey">
              <div className="journey-row">
                <span className="node">↗</span>
                <div><p className="row-title">Sent from Globus</p><p className="row-meta">Your USD account · {receipt.date}</p></div>
                <span className="row-amount">$1,250.00</span>
              </div>
              <div className="journey-row">
                <span className="node finish">✓</span>
                <div><p className="row-title">Delivered to {receipt.recipient}</p><p className="row-meta">{receipt.bank} · {receipt.country}</p></div>
                <span className="row-amount">€1,152.50</span>
              </div>
            </section>
          ) : (
            <section className="details" aria-label="Payment details">
              <div className="detail-item"><div className="caption">Recipient</div><div className="detail-value">{receipt.recipient}</div></div>
              <div className="detail-item"><div className="caption">Destination</div><div className="detail-value">{receipt.country}</div></div>
              <div className="detail-item"><div className="caption">Receiving bank</div><div className="detail-value">{receipt.bank}</div></div>
              <div className="detail-item"><div className="caption">Account</div><div className="detail-value">{receipt.account}</div></div>
              <div className="detail-item"><div className="caption">Transfer route</div><div className="detail-value">{receipt.route}</div></div>
              <div className="detail-item"><div className="caption">Completed</div><div className="detail-value">{receipt.date}</div></div>
            </section>
          )}

          <div className="reference-bar">
            <div><div className="caption">Transfer reference</div><div className="ref-value">{receipt.reference}</div></div>
            <button type="button" className="copy-button" onClick={copyReference} aria-label="Copy transfer reference">{copied ? 'Copied' : 'Copy'}</button>
          </div>
        </div>
        <footer className="footer">
          <p className="footer-note">A little closer, across borders.</p>
          <button className="print-button" type="button" onClick={() => window.print()}><span aria-hidden="true">↗</span> Print receipt</button>
        </footer>
      </section>
    </main>
  );
}
