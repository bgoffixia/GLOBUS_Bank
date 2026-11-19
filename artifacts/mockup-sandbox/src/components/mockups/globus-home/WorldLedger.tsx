import { useState } from 'react';
import './worldledger.css';

const wallets = [
  { code: 'USD', label: 'US dollar', mark: '$', tone: 'usd' },
  { code: 'EUR', label: 'Euro', mark: '€', tone: 'eur' },
  { code: 'GBP', label: 'British pound', mark: '£', tone: 'gbp' },
  { code: 'CAD', label: 'Canadian dollar', mark: 'C$', tone: 'cad' },
];

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4" /></svg>;
}

function GlobeMark() {
  return (
    <span className="wl-globe-mark" aria-hidden="true">
      <svg viewBox="0 0 42 42">
        <circle cx="21" cy="21" r="15.5" />
        <ellipse cx="21" cy="21" rx="7" ry="15.5" />
        <path d="M6 21h30M9.5 12.5h23M9.5 29.5h23" />
        <path className="wl-globe-accent" d="M31.5 9.5 36 7" />
      </svg>
    </span>
  );
}

export function WorldLedger() {
  const [currency, setCurrency] = useState('USD');
  const [accessOpen, setAccessOpen] = useState(false);
  const [email, setEmail] = useState('');
  const selectedWallet = wallets.find((wallet) => wallet.code === currency) ?? wallets[0];

  return (
    <main className="wl-page">
      <div className="wl-topline">
        <span>International money, made more legible.</span>
        <span className="wl-topline-right"><i /> Globus account workspace</span>
      </div>
      <header className="wl-header">
        <a className="wl-brand" href="#top" aria-label="Globus Bank home">
          <GlobeMark />
          <span className="wl-wordmark"><strong>GLOBUS</strong><small>BANK</small></span>
        </a>
        <nav className="wl-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#account-details">Account details</a>
          <a href="#support">Support</a>
        </nav>
        <div className="wl-header-actions">
          <button className="wl-signin" type="button" onClick={() => setAccessOpen(true)}>Sign in</button>
          <button className="wl-open-account" type="button" onClick={() => setAccessOpen(true)}>Open an account <ArrowIcon /></button>
        </div>
      </header>

      <section className="wl-hero" id="top">
        <div className="wl-copy">
          <div className="wl-kicker"><span className="wl-kicker-line" /> A more considered way to hold money</div>
          <h1>Your money,<br /><em>in its element.</em></h1>
          <p className="wl-lede">Bring your currencies together in one clear account. See what’s held, understand what’s moving, and make your next step with confidence.</p>
          <div className="wl-hero-actions">
            <button className="wl-primary" type="button" onClick={() => setAccessOpen(true)}>Explore your account <ArrowIcon /></button>
            <a className="wl-secondary" href="#how-it-works">See how Globus works <span>↓</span></a>
          </div>
          <div className="wl-trustline">
            <span className="wl-trust-icon"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5 16 5v4.6c0 3.5-2.5 6.2-6 7.9-3.5-1.7-6-4.4-6-7.9V5l6-2.5Z" /><path d="m7.5 10 1.7 1.7 3.5-3.6" /></svg></span>
            <span><b>Clear records, at every step</b><small>Globus activity is identified and easy to review.</small></span>
          </div>
        </div>

        <div className="wl-visual">
          <div className="wl-visual-caption"><span>YOUR ACCOUNT, IN PERSPECTIVE</span><span className="wl-caption-index">01 — 04</span></div>
          <div className="wl-orbit wl-orbit-a" /><div className="wl-orbit wl-orbit-b" />
          <div className="wl-globe-illustration"><GlobeMark /><span className="wl-orbit-node" /></div>
          <div className="wl-account-card">
            <div className="wl-card-top">
              <div><span className="wl-card-overline">MULTI-CURRENCY ACCOUNT</span><strong>One view. Many destinations.</strong></div>
              <span className="wl-card-badge"><i /> ACCOUNT OVERVIEW</span>
            </div>
            <div className="wl-balance">
              <div><span className="wl-card-overline">TOTAL WALLET BALANCE</span><p>••••••••</p><small>Sign in to view your balances</small></div>
              <span className="wl-balance-symbol">{selectedWallet.mark}</span>
            </div>
            <div className="wl-wallet-head"><span>YOUR WALLETS</span><span>Choose a currency</span></div>
            <div className="wl-wallet-list">
              {wallets.map((wallet) => (
                <button className={`wl-wallet-row ${currency === wallet.code ? 'is-selected' : ''}`} type="button" key={wallet.code} onClick={() => setCurrency(wallet.code)} aria-pressed={currency === wallet.code}>
                  <span className={`wl-currency-icon ${wallet.tone}`}>{wallet.mark}</span>
                  <span className="wl-wallet-name"><b>{wallet.label}</b><small>{wallet.code} wallet</small></span>
                  <span className="wl-wallet-value">{currency === wallet.code ? '••••••' : '—'}</span>
                  <span className="wl-row-chevron">↗</span>
                </button>
              ))}
            </div>
            <div className="wl-card-foot"><span><i /> Account data stays private</span><span>ILLUSTRATIVE PREVIEW</span></div>
          </div>
          <div className="wl-note"><span className="wl-note-icon">↗</span><span><b>Movement, made visible</b><small>Follow activity with its own clear reference.</small></span></div>
        </div>
      </section>

      <section className="wl-proof-strip" id="account-details">
        <div className="wl-proof-intro"><span>THE GLOBUS DIFFERENCE</span><b>A clearer picture<br />of your money.</b></div>
        <div className="wl-proof-item"><span className="wl-proof-number">01</span><div><b>Four wallet currencies</b><small>Hold USD, EUR, GBP and CAD in one place.</small></div></div>
        <div className="wl-proof-item"><span className="wl-proof-number">02</span><div><b>Traceable transfers</b><small>Know the route, conversion and recorded status.</small></div></div>
        <div className="wl-proof-item"><span className="wl-proof-number">03</span><div><b>Records you can follow</b><small>Every activity has a timestamp and reference.</small></div></div>
      </section>

      <section className="wl-how" id="how-it-works">
        <div className="wl-how-heading">
          <div><span className="wl-section-label">CLARITY BEFORE CURRENCY MOVES</span><h2>Know what happens<br />before you press send.</h2></div>
          <p>Make informed choices from the first review to the final record. Globus gives each part of the journey room to be understood.</p>
        </div>
        <div className="wl-journey">
          <article><span className="wl-journey-index">01 / SEE</span><div className="wl-journey-icon">◎</div><h3>Get the whole picture</h3><p>Review wallets, pending amounts and account activity from a single workspace.</p></article>
          <div className="wl-journey-rule" />
          <article><span className="wl-journey-index">02 / MOVE</span><div className="wl-journey-icon">↗</div><h3>Choose your route</h3><p>Review local or international transfer details and the currency conversion before proceeding.</p></article>
          <div className="wl-journey-rule" />
          <article><span className="wl-journey-index">03 / FOLLOW</span><div className="wl-journey-icon">⌁</div><h3>Keep a lasting record</h3><p>Return to each transaction with its own status, timestamp and reference.</p></article>
        </div>
      </section>

      <section className="wl-bottom-cta" id="support">
        <div className="wl-cta-globe"><GlobeMark /></div>
        <div><span>YOUR WORLD, IN ONE PLACE</span><h2>Start with a clearer view.</h2><p>See how a Globus account can bring your currencies into focus.</p></div>
        <button type="button" onClick={() => setAccessOpen(true)}>Get to know Globus <ArrowIcon /></button>
      </section>

      <footer className="wl-footer">
        <a className="wl-brand wl-footer-brand" href="#top"><GlobeMark /><span className="wl-wordmark"><strong>GLOBUS</strong><small>BANK</small></span></a>
        <span>© 2025 Globus. A multi-currency software platform.</span>
        <div><a href="#account-details">Account details</a><a href="#support">Support</a><a href="#top">Back to top ↑</a></div>
      </footer>

      {accessOpen && (
        <div className="wl-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAccessOpen(false); }}>
          <section className="wl-modal" role="dialog" aria-modal="true" aria-labelledby="wl-modal-title">
            <button className="wl-modal-close" type="button" aria-label="Close" onClick={() => setAccessOpen(false)}>×</button>
            <GlobeMark />
            <span className="wl-section-label">GLOBUS MEMBER ACCESS</span>
            <h2 id="wl-modal-title">A clearer view starts here.</h2>
            <p>This preview does not collect personal information. Continue to the Globus account experience when you’re ready.</p>
            <label htmlFor="wl-email">Email address</label>
            <input id="wl-email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            <button className="wl-primary wl-modal-submit" type="button" onClick={() => setAccessOpen(false)}>Continue to Globus <ArrowIcon /></button>
            <small className="wl-modal-note">Preview only · no information is submitted</small>
          </section>
        </div>
      )}
    </main>
  );
}
