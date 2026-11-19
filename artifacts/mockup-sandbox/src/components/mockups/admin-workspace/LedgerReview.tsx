import { useMemo, useState } from "react";
import {
  Activity, ArrowLeftRight, Bell, Check,
  ChevronDown, ChevronRight, Clock3, Download, Filter,
  Globe2, LayoutDashboard, LockKeyhole, MoreHorizontal, Search, ShieldCheck,
  SlidersHorizontal, Users, WalletCards, X,
} from "lucide-react";

const transactions = [
  { id: "TX-8492-0318", name: "Maya Chen", initials: "MC", purpose: "Supplier payment · Singapore", currency: "USD", amount: "− 4,280.00", converted: "S$5,742.81", time: "10:42:18", status: "Needs review", kind: "out", flag: "SG" },
  { id: "TX-8492-0314", name: "Daniel Okafor", initials: "DO", purpose: "Wallet funding · Lagos", currency: "EUR", amount: "+ 2,400.00", converted: "€2,400.00", time: "10:38:05", status: "Processing", kind: "in", flag: "NG" },
  { id: "TX-8492-0309", name: "Avery Morgan", initials: "AM", purpose: "Currency exchange · GBP → USD", currency: "GBP", amount: "− 1,150.00", converted: "$1,468.62", time: "10:21:43", status: "Needs review", kind: "exchange", flag: "GB" },
  { id: "TX-8492-0301", name: "Isabella Rossi", initials: "IR", purpose: "International transfer · Milan", currency: "USD", amount: "− 860.00", converted: "€791.20", time: "09:54:11", status: "Completed", kind: "out", flag: "IT" },
  { id: "TX-8492-0298", name: "Samuel Wright", initials: "SW", purpose: "Client invoice · Toronto", currency: "CAD", amount: "+ 3,750.00", converted: "CA$3,750.00", time: "09:32:48", status: "Needs review", kind: "in", flag: "CA" },
  { id: "TX-8492-0291", name: "Lena Fischer", initials: "LF", purpose: "Wallet conversion · EUR → USD", currency: "EUR", amount: "− 920.00", converted: "$1,001.47", time: "09:16:30", status: "Completed", kind: "exchange", flag: "DE" },
];

const balances = [
  { code: "USD", name: "US Dollar", balance: "$482,901.28", change: "+2.4%", tone: "navy", symbol: "$" },
  { code: "EUR", name: "Euro", balance: "€219,450.60", change: "+1.8%", tone: "gold", symbol: "€" },
  { code: "GBP", name: "Pound Sterling", balance: "£86,204.12", change: "−0.6%", tone: "sage", symbol: "£" },
  { code: "CAD", name: "Canadian Dollar", balance: "CA$54,890.00", change: "+0.9%", tone: "plum", symbol: "C$" },
];

function Status({ value }: { value: string }) {
  const style = value === "Needs review"
    ? "bg-[#f7edd8] text-[#8b6b2f] before:bg-[#bf9849]"
    : value === "Processing"
      ? "bg-[#e9eff2] text-[#5b7782] before:bg-[#7898a3]"
      : "bg-[#e8f1eb] text-[#4f7860] before:bg-[#78a184]";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-semibold before:h-1.5 before:w-1.5 before:rounded-full ${style}`}>{value}</span>;
}

export default function LedgerReview() {
  const [activeNav, setActiveNav] = useState("Transactions");
  const [activeTab, setActiveTab] = useState("All activity");
  const [currency, setCurrency] = useState("All currencies");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<(typeof transactions)[number] | null>(transactions[0]);
  const [items, setItems] = useState(transactions);
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [range, setRange] = useState("Today");

  const filtered = useMemo(() => items.filter(item => {
    const matchesQuery = `${item.name} ${item.purpose} ${item.id}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = activeTab === "All activity" || (activeTab === "Needs review" && item.status === "Needs review") || (activeTab === "Processing" && item.status === "Processing");
    const matchesCurrency = currency === "All currencies" || item.currency === currency;
    return matchesQuery && matchesStatus && matchesCurrency;
  }), [items, query, activeTab, currency]);

  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };
  const updateStatus = (status: string) => {
    if (!selected) return;
    setItems(current => current.map(item => item.id === selected.id ? { ...item, status } : item));
    setSelected({ ...selected, status });
    toast(status === "Completed" ? "Transaction approved and recorded" : "Transaction returned for review");
  };

  return (
    <div className="min-h-screen bg-[#f2f5f1] text-[#243d45]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[205px] flex-col bg-[#173b49] text-[#dce9e5] lg:flex">
        <div className="flex h-[68px] items-center gap-3 border-b border-white/[.09] px-5">
          <div className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#d9c27f] font-serif text-[22px] font-bold text-[#173b49]">G</div>
          <div><p className="text-[15px] font-extrabold tracking-[-.07em] text-white">GLOBUS</p><p className="mt-0.5 text-[8px] font-bold tracking-[.2em] text-[#dfc87f]">BANK · OPERATIONS</p></div>
        </div>
        <div className="mx-3.5 my-4 rounded-[10px] border border-white/[.09] bg-white/[.04] px-3 py-2.5">
          <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#a7d1c1]"><span className="h-1.5 w-1.5 rounded-full bg-[#80c5a5]" />Ledger online</p>
          <p className="mt-1 text-[9px] text-[#a9c0c1]">Global settlement · UTC</p>
        </div>
        <p className="px-5 pb-2 text-[8px] font-bold uppercase tracking-[.17em] text-[#829da2]">Workspace</p>
        <nav className="flex-1 space-y-1 px-2.5">
          {[
            { name: "Overview", icon: LayoutDashboard },
            { name: "Transactions", icon: Activity, count: "8" },
            { name: "Members", icon: Users },
            { name: "Accounts", icon: WalletCards },
            { name: "Controls", icon: LockKeyhole },
          ].map(({ name, icon: Icon, count }) => <button key={name} onClick={() => { setActiveNav(name); if (name === "Members") setMemberOpen(true); }} className={`flex w-full items-center gap-3 rounded-[9px] px-3 py-2.5 text-left text-[10px] font-semibold transition ${activeNav === name ? "bg-[#d9c27f] text-[#1d3c48]" : "text-[#c1d2d1] hover:bg-white/[.07] hover:text-white"}`}><Icon size={15} strokeWidth={1.8} /><span className="flex-1">{name}</span>{count && <span className="rounded-full bg-[#294956]/10 px-1.5 py-0.5 text-[9px]">{count}</span>}</button>)}
        </nav>
        <div className="mx-3.5 mb-3 rounded-[9px] border border-white/[.08] bg-white/[.035] p-3">
          <div className="flex items-center gap-2 text-[#c7d6d4]"><ShieldCheck size={14} /><span className="text-[9px] font-semibold">Protected workspace</span></div>
          <p className="mt-1.5 pl-[22px] text-[8px] text-[#8fa9aa]">Actions recorded · MFA active</p>
        </div>
        <div className="border-t border-white/[.09] p-3">
          <div className="flex items-center gap-2.5 rounded-[9px] bg-white/[.045] p-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#d7e8e3] text-[10px] font-bold text-[#244a54]">AD</div>
            <div><p className="text-[10px] font-bold text-white">Operations admin</p><p className="text-[8px] text-[#9eb5b6]">admin@globus.example</p></div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-[205px]">
        <header className="sticky top-0 z-10 flex h-[58px] items-center justify-between border-b border-[#e0e8e2] bg-[#f7f9f5]/95 px-4 backdrop-blur sm:px-7">
          <p className="text-[10px] text-[#859492]"><span className="hidden sm:inline">Globus Bank&nbsp; / &nbsp;</span><span className="font-semibold text-[#3e575b]">Transaction ledger</span></p>
          <div className="flex items-center gap-2.5">
            <div className="hidden items-center gap-1.5 rounded-full border border-[#dce7df] bg-[#f0f6f0] px-2.5 py-1.5 sm:flex"><ShieldCheck size={12} className="text-[#57816d]" /><span className="text-[9px] font-semibold text-[#557364]">Authorized</span></div>
            <button aria-label="Notifications" onClick={() => toast("You’re all caught up")} className="relative rounded-lg p-2 text-[#718583] hover:bg-[#e9efea]"><Bell size={16} /><span className="absolute right-[6px] top-[6px] h-1.5 w-1.5 rounded-full bg-[#bf8254]" /></button>
            <button onClick={() => setMemberOpen(true)} className="grid h-7 w-7 place-items-center rounded-full border border-[#d9e3dd] bg-[#e7efea] text-[9px] font-bold text-[#365963]">AD</button>
          </div>
        </header>

        <main className="mx-auto max-w-[1450px] px-4 pb-8 pt-5 sm:px-7 sm:pt-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[9px] font-bold uppercase tracking-[.17em] text-[#578b85]">Global operations · 18 Mar 2025</p><h1 className="mt-1 text-[25px] font-extrabold tracking-[-.055em] text-[#1c3a47] sm:text-[29px]">Multi-currency ledger</h1><p className="mt-1 text-[10px] text-[#788b89]">Reconcile movement. Review exceptions. Keep every currency in view.</p></div>
            <div className="flex items-center gap-2">
              <button onClick={() => toast("Ledger statement prepared")} className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-[#d9e4dc] bg-[#fffefa] px-3 text-[10px] font-bold text-[#526d69] hover:bg-[#f7faf6]"><Download size={13} /><span className="hidden sm:inline">Export ledger</span><span className="sm:hidden">Export</span></button>
              <button onClick={() => toast("Showing the latest ledger snapshot")} className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-[#1b4351] px-3.5 text-[10px] font-bold text-white shadow-[0_3px_8px_rgba(20,57,68,.12)] hover:bg-[#245565]"><ArrowLeftRight size={13} />Reconcile</button>
            </div>
          </div>

          <section className="mb-4 overflow-hidden rounded-[12px] border border-[#dfe8e2] bg-[#fffefa] shadow-[0_3px_12px_rgba(35,65,62,.035)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9eeea] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded-[8px] bg-[#e9f1eb] text-[#5e8a79]"><Globe2 size={15} /></div><div><h2 className="text-[11px] font-bold text-[#29434a]">Settlement balances</h2><p className="text-[8px] text-[#879592]">Live available balance · equivalent USD $843,446.00</p></div></div>
              <div className="flex items-center gap-1 rounded-[7px] bg-[#f2f5f1] p-1">
                {["Today", "7 days", "30 days"].map(value => <button key={value} onClick={() => setRange(value)} className={`rounded-[5px] px-2.5 py-1.5 text-[8px] font-semibold ${range === value ? "bg-[#fffefa] text-[#345a58] shadow-sm" : "text-[#85938d] hover:text-[#526b68]"}`}>{value}</button>)}
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-[#edf1ed] sm:grid-cols-4 sm:divide-y-0">
              {balances.map((balance, index) => <button key={balance.code} onClick={() => setCurrency(currency === balance.code ? "All currencies" : balance.code)} className={`relative px-4 py-3.5 text-left transition hover:bg-[#fafbf8] sm:px-5 ${currency === balance.code ? "bg-[#f7faf6]" : ""}`}>
                {currency === balance.code && <span className="absolute inset-y-0 left-0 w-[3px] bg-[#5b9385]" />}
                <div className="flex items-center justify-between"><span className="text-[8px] font-bold uppercase tracking-[.12em] text-[#84938d]">{balance.code} <span className="normal-case tracking-normal">· {balance.name}</span></span><span className={`text-[8px] font-semibold ${balance.change.startsWith("+") ? "text-[#5f8b6d]" : "text-[#a98256]"}`}>{balance.change}</span></div>
                <div className="mt-1 flex items-end justify-between gap-2"><strong className="text-[17px] font-extrabold tracking-[-.04em] text-[#24424b] sm:text-[19px]">{balance.balance}</strong><div className="hidden h-7 items-end gap-[3px] sm:flex">{[11,17,13,21,18,25,20,27,23,30].map((height, i) => <span key={i} className={`w-[3px] rounded-t-sm ${index === 1 ? "bg-[#d5c17c]" : "bg-[#8fb4a1]"}`} style={{ height }} />)}</div></div>
              </button>)}
            </div>
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_302px]">
            <section className="min-w-0 overflow-hidden rounded-[12px] border border-[#dfe8e2] bg-[#fffefa] shadow-[0_3px_12px_rgba(35,65,62,.035)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9eeea] px-4 py-3.5 sm:px-5">
                <div><div className="flex items-center gap-2"><h2 className="text-[12px] font-bold text-[#29434a]">Transaction activity</h2><span className="rounded-full bg-[#eef3ef] px-2 py-0.5 text-[8px] font-semibold text-[#70827e]">248 today</span></div><p className="mt-0.5 text-[8px] text-[#879592]">Every posting, across every settlement currency</p></div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <label className="relative min-w-0 flex-1 sm:w-[190px]"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#91a09d]" /><input value={query} onChange={e => setQuery(e.target.value)} className="h-8 w-full rounded-[7px] border border-[#dfe7e2] bg-[#fcfdfa] pl-8 pr-2 text-[9px] text-[#345057] outline-none placeholder:text-[#9aa8a3] focus:border-[#8eb3a5]" placeholder="Search name, reference..." /></label>
                  <button onClick={() => setCurrency(currency === "All currencies" ? "USD" : "All currencies")} className="inline-flex h-8 items-center gap-1 rounded-[7px] border border-[#dfe7e2] px-2.5 text-[9px] font-semibold text-[#657b79] hover:bg-[#f5f8f4]"><Filter size={12} /><span>{currency === "All currencies" ? "Currency" : currency}</span><ChevronDown size={11} /></button>
                </div>
              </div>
              <div className="flex items-center gap-4 border-b border-[#edf1ed] px-4 sm:px-5">
                {["All activity", "Needs review", "Processing"].map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={`relative py-2.5 text-[9px] font-semibold ${activeTab === tab ? "text-[#2f675f]" : "text-[#899693] hover:text-[#526b69]"}`}>{tab}{tab === "Needs review" && <span className="ml-1.5 rounded-full bg-[#f7efdc] px-1.5 py-0.5 text-[8px] text-[#907b49]">3</span>}{activeTab === tab && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#52928a]" />}</button>)}
                <button onClick={() => toast("Sorted by newest posting")} className="ml-auto hidden items-center gap-1 text-[8px] text-[#84928d] sm:flex"><SlidersHorizontal size={11} />Newest first</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[690px] text-left">
                  <thead className="bg-[#f7f9f5] text-[8px] font-bold uppercase tracking-[.1em] text-[#899792]"><tr><th className="px-4 py-2.5 sm:px-5">Member / reference</th><th className="px-3 py-2.5">Activity</th><th className="px-3 py-2.5">Amount</th><th className="px-3 py-2.5">Status</th><th className="px-4 py-2.5 text-right sm:px-5"></th></tr></thead>
                  <tbody>{filtered.map(item => <tr key={item.id} onClick={() => setSelected(item)} className={`cursor-pointer border-t border-[#edf1ed] transition hover:bg-[#fafbf8] ${selected?.id === item.id ? "bg-[#f5f8f3]" : ""}`}>
                    <td className="px-4 py-2.5 sm:px-5"><div className="flex items-center gap-2.5"><div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[9px] font-bold ${item.kind === "in" ? "bg-[#e6f0e9] text-[#47755e]" : item.kind === "exchange" ? "bg-[#f3eedf] text-[#8c784d]" : "bg-[#e7eef1] text-[#527482]"}`}>{item.initials}</div><div><p className="text-[9px] font-bold text-[#344c51]">{item.name}</p><p className="mt-0.5 font-mono text-[8px] text-[#96a29e]">{item.id}</p></div></div></td>
                    <td className="px-3 py-2.5"><p className="max-w-[210px] truncate text-[9px] font-medium text-[#526a67]">{item.purpose}</p><p className="mt-0.5 text-[8px] text-[#97a39e]">{item.time} UTC · {item.flag}</p></td>
                    <td className="px-3 py-2.5"><p className={`whitespace-nowrap text-[9px] font-bold ${item.kind === "in" ? "text-[#4b8067]" : "text-[#405958]"}`}>{item.amount} <span className="text-[8px] font-semibold text-[#889792]">{item.currency}</span></p><p className="mt-0.5 text-[8px] text-[#97a39e]">{item.converted}</p></td>
                    <td className="px-3 py-2.5"><Status value={item.status} /></td>
                    <td className="px-4 py-2.5 text-right sm:px-5"><button aria-label={`Review ${item.id}`} onClick={e => { e.stopPropagation(); setSelected(item); }} className="rounded-md p-1.5 text-[#7d918c] hover:bg-white hover:text-[#315f59]"><ChevronRight size={14} /></button></td>
                  </tr>)}
                  {filtered.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center"><div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-[#edf3ee] text-[#769189]"><Search size={15} /></div><p className="mt-2 text-[10px] font-semibold text-[#526b68]">No activity matches this view</p><p className="mt-1 text-[8px] text-[#899692]">Try another search or clear the currency filter.</p><button onClick={() => { setQuery(""); setCurrency("All currencies"); setActiveTab("All activity"); }} className="mt-2 text-[8px] font-bold text-[#52857c]">Clear filters</button></td></tr>}</tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[#e9eeea] px-4 py-2.5 sm:px-5"><p className="text-[8px] text-[#84928e]">Showing <b className="text-[#526b68]">{filtered.length}</b> of <b className="text-[#526b68]">248</b> postings</p><div className="flex items-center gap-1"><button aria-label="Previous page" onClick={() => toast("You’re viewing the newest activity")} className="grid h-7 w-7 place-items-center rounded-md border border-[#e1e9e3] text-[#8a9994] hover:bg-[#f5f8f4]"><ChevronRight size={13} className="rotate-180" /></button><span className="grid h-7 min-w-7 place-items-center rounded-md bg-[#eaf2ed] px-2 text-[9px] font-bold text-[#476c61]">1</span><button aria-label="Next page" onClick={() => toast("More ledger activity will load here")} className="grid h-7 w-7 place-items-center rounded-md border border-[#e1e9e3] text-[#8a9994] hover:bg-[#f5f8f4]"><ChevronRight size={13} /></button></div></div>
            </section>

            <aside className="space-y-3">
              {selected ? <section className="overflow-hidden rounded-[12px] border border-[#dfe8e2] bg-[#fffefa] shadow-[0_3px_12px_rgba(35,65,62,.035)]">
                <div className="flex items-start justify-between border-b border-[#e9eeea] px-4 py-3.5"><div><p className="text-[8px] font-bold uppercase tracking-[.15em] text-[#598d83]">Review details</p><h2 className="mt-1 text-[12px] font-bold text-[#29434a]">Transaction review</h2></div><button aria-label="Close details" onClick={() => setSelected(null)} className="rounded p-1 text-[#8a9994] hover:bg-[#eef3ee]"><X size={14} /></button></div>
                <div className="px-4 pb-4 pt-3">
                  <div className="flex items-center gap-2.5"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#e7eef1] text-[10px] font-bold text-[#527482]">{selected.initials}</div><div className="min-w-0 flex-1"><p className="text-[10px] font-bold text-[#344c51]">{selected.name}</p><p className="text-[8px] text-[#879793]">Member · {selected.flag} region</p></div><Status value={selected.status} /></div>
                  <div className="mt-4 rounded-[9px] bg-[#f5f8f3] p-3">
                    <p className="text-[8px] font-semibold uppercase tracking-[.1em] text-[#85948c]">Debit amount</p><p className="mt-1 text-[22px] font-extrabold tracking-[-.05em] text-[#24424b]">{selected.amount} <span className="text-[11px] text-[#728680]">{selected.currency}</span></p><p className="mt-0.5 text-[8px] text-[#85948c]">Converted value <b className="text-[#526b68]">{selected.converted}</b></p>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    <div className="flex justify-between gap-3"><span className="text-[8px] text-[#87958f]">Reference</span><span className="font-mono text-[8px] font-semibold text-[#526b68]">{selected.id}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-[8px] text-[#87958f]">Purpose</span><span className="max-w-[165px] text-right text-[8px] font-semibold text-[#526b68]">{selected.purpose}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-[8px] text-[#87958f]">Initiated</span><span className="text-[8px] font-semibold text-[#526b68]">18 Mar · {selected.time} UTC</span></div>
                    <div className="flex justify-between gap-3"><span className="text-[8px] text-[#87958f]">Exchange rate</span><span className="text-[8px] font-semibold text-[#526b68]">1 USD = 1.3418 SGD</span></div>
                  </div>
                  <div className="mt-3 flex items-start gap-2 rounded-[8px] border border-[#eee7d6] bg-[#faf7ed] p-2.5"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-[#9a8252]" /><p className="text-[8px] leading-[1.55] text-[#7e7358]">Verify recipient and funding source before releasing this payment.</p></div>
                  {selected.status === "Needs review" ? <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => updateStatus("Completed")} className="inline-flex items-center justify-center gap-1.5 rounded-[7px] bg-[#1b4351] py-2.5 text-[9px] font-bold text-white hover:bg-[#245565]"><Check size={12} />Approve</button><button onClick={() => updateStatus("Processing")} className="rounded-[7px] border border-[#dce6e0] py-2.5 text-[9px] font-bold text-[#647b77] hover:bg-[#f5f8f4]">Request review</button></div> : <button onClick={() => toast("Full transaction audit trail opened")} className="mt-3 w-full rounded-[7px] border border-[#dce6e0] py-2.5 text-[9px] font-bold text-[#647b77] hover:bg-[#f5f8f4]">Open audit trail</button>}
                </div>
              </section> : <section className="rounded-[12px] border border-[#dfe8e2] bg-[#fffefa] p-5 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#edf3ee] text-[#759187]"><Activity size={17} /></div><p className="mt-2 text-[10px] font-bold text-[#425b58]">Select a ledger entry</p><p className="mt-1 text-[8px] leading-relaxed text-[#899692]">Choose a transaction to review its posting, currency route and audit details.</p></section>}
              <section className="rounded-[12px] border border-[#e4e9df] bg-[#f7f8f0] px-4 py-3.5">
                <div className="flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded-[8px] bg-[#e9eddc] text-[#7d895a]"><Clock3 size={13} /></div><div><p className="text-[9px] font-bold text-[#4b6158]">Review queue</p><p className="text-[8px] text-[#829087]">SLA status · 3 items approaching</p></div><button aria-label="Queue options" onClick={() => toast("Queue options: oldest first")} className="ml-auto rounded p-1 text-[#829087] hover:bg-white/60"><MoreHorizontal size={14} /></button></div>
                <div className="mt-3 flex items-end justify-between"><p className="text-[22px] font-extrabold tracking-[-.05em] text-[#35534c]">08<span className="ml-1 text-[9px] font-semibold tracking-normal text-[#839087]">open items</span></p><button onClick={() => { setActiveTab("Needs review"); toast("Showing items that need review"); }} className="text-[8px] font-bold text-[#63806e] hover:underline">Review queue</button></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e7eadf]"><div className="h-full w-[62%] rounded-full bg-[#8baf8e]" /></div>
                <div className="mt-2 flex justify-between text-[8px] text-[#89958a]"><span>5 within SLA</span><span>3 due in &lt; 1 hr</span></div>
              </section>
              <button onClick={() => setMemberOpen(true)} className="flex w-full items-center gap-3 rounded-[10px] border border-[#dfe8e2] bg-[#fffefa] p-3 text-left hover:bg-[#fafbf8]"><div className="grid h-8 w-8 place-items-center rounded-[8px] bg-[#e9f1eb] text-[#5e8a79]"><Users size={15} /></div><div className="min-w-0 flex-1"><p className="text-[9px] font-bold text-[#405b58]">Member access</p><p className="text-[8px] text-[#8b9993]">Quickly find a member record</p></div><ChevronRight size={14} className="text-[#85958e]" /></button>
            </aside>
          </div>
          <footer className="mt-5 flex items-center justify-between border-t border-[#e1e9e3] pt-3 text-[8px] text-[#98a39f]"><span>Globus Bank · Internal operations · Ledger snapshot 10:45 UTC</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#77a68b]" />Systems operational</span></footer>
        </main>
      </div>

      {memberOpen && <div className="fixed inset-0 z-40 flex justify-end bg-[#17333b]/30" onMouseDown={e => { if (e.target === e.currentTarget) setMemberOpen(false); }}>
        <section className="flex h-full w-full max-w-[390px] flex-col border-l border-[#dce6df] bg-[#fffefa] shadow-[-16px_0_50px_rgba(25,53,57,.13)]">
          <div className="flex items-start justify-between border-b border-[#e9eeea] px-5 py-4"><div><p className="text-[8px] font-bold uppercase tracking-[.16em] text-[#598d83]">Member directory</p><h2 className="mt-1 text-[17px] font-extrabold tracking-[-.04em] text-[#24414a]">Quick member access</h2></div><button aria-label="Close member access" onClick={() => setMemberOpen(false)} className="rounded-md p-1.5 text-[#7d8d88] hover:bg-[#eef3ee]"><X size={16} /></button></div>
          <div className="p-4"><label className="relative block"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#91a09d]" /><input autoFocus value={memberQuery} onChange={e => setMemberQuery(e.target.value)} placeholder="Search name or member ID" className="h-10 w-full rounded-[8px] border border-[#dfe7e2] bg-[#fcfdfa] pl-9 pr-3 text-[10px] outline-none focus:border-[#8eb3a5]" /></label><p className="mt-4 text-[8px] font-bold uppercase tracking-[.12em] text-[#899792]">Recently accessed</p></div>
          <div className="flex-1 overflow-y-auto px-4">
            {[
              { name: "Maya Chen", id: "GL7M4LA", initials: "MC", state: "Verified" },
              { name: "Daniel Okafor", id: "GL2K9PD", initials: "DO", state: "Verified" },
              { name: "Avery Morgan", id: "GL8X2FQ", initials: "AM", state: "In review" },
              { name: "Samuel Wright", id: "GL5N1XR", initials: "SW", state: "Action needed" },
            ].filter(person => `${person.name} ${person.id}`.toLowerCase().includes(memberQuery.toLowerCase())).map(person => <button key={person.id} onClick={() => { toast(`Member record opened · ${person.name}`); setMemberOpen(false); }} className="flex w-full items-center gap-3 border-b border-[#edf1ed] py-3 text-left hover:bg-[#fafbf8]"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#e7eef1] text-[10px] font-bold text-[#527482]">{person.initials}</div><div className="min-w-0 flex-1"><p className="text-[10px] font-bold text-[#344c51]">{person.name}</p><p className="mt-0.5 font-mono text-[8px] text-[#899793]">{person.id}</p></div><span className={`text-[8px] font-semibold ${person.state === "Verified" ? "text-[#5e8b70]" : "text-[#a17e46]"}`}>{person.state}</span><ChevronRight size={13} className="text-[#98a59f]" /></button>)}
            {!memberQuery && <button onClick={() => toast("Full member directory opened")} className="mt-3 w-full rounded-[7px] border border-[#dce6e0] py-2.5 text-[9px] font-bold text-[#56736d] hover:bg-[#f5f8f4]">Open full directory</button>}
            {memberQuery && !["Maya Chen GL7M4LA", "Daniel Okafor GL2K9PD", "Avery Morgan GL8X2FQ", "Samuel Wright GL5N1XR"].some(text => text.toLowerCase().includes(memberQuery.toLowerCase())) && <div className="py-10 text-center text-[9px] text-[#899692]">No member matches that search.</div>}
          </div>
          <div className="border-t border-[#e9eeea] px-5 py-3"><p className="flex items-center gap-2 text-[8px] text-[#84918c]"><LockKeyhole size={12} />Member access is logged to the audit trail.</p></div>
        </section>
      </div>}
      {notice && <div role="status" className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-[9px] bg-[#204653] px-4 py-3 text-[10px] font-semibold text-white shadow-lg"><ShieldCheck size={14} />{notice}</div>}
    </div>
  );
}
