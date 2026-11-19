import { useMemo, useState } from "react";
import {
  Activity, BadgeCheck, Bell, Check, CheckCheck, ChevronRight, CircleAlert, Clock3,
  FileCheck2, FileWarning, Landmark, LockKeyhole, Search, ShieldAlert, ShieldCheck,
  SlidersHorizontal, Sparkles, Users, X,
} from "lucide-react";

type CaseStatus = "Needs review" | "In review" | "Needs documents" | "Verified";
type CaseRecord = {
  id: string;
  name: string;
  initials: string;
  email: string;
  submitted: string;
  status: CaseStatus;
  docs: number;
  required: number;
  missing: string[];
  risk: "Low" | "Elevated" | "High";
  score: number;
  region: string;
  amount: string;
  signal: string;
  tint: string;
};

const seedCases: CaseRecord[] = [
  { id: "GL8X2FQ", name: "Avery Morgan", initials: "AM", email: "avery.morgan@email.com", submitted: "09:42 today", status: "Needs review", docs: 2, required: 3, missing: ["Proof of address"], risk: "Elevated", score: 82, region: "Portland, OR", amount: "$4,850.00", signal: "Device differs from sign-up location", tint: "#dbe9dc" },
  { id: "GL6K9TW", name: "Nia Okafor", initials: "NO", email: "nia.okafor@email.com", submitted: "08:17 today", status: "In review", docs: 3, required: 3, missing: [], risk: "Low", score: 94, region: "Toronto, ON", amount: "$2,140.50", signal: "No material risk signals", tint: "#e8ddd2" },
  { id: "GL4R3PD", name: "Leo Chen", initials: "LC", email: "leo.chen@email.com", submitted: "16:03 yesterday", status: "Needs documents", docs: 1, required: 3, missing: ["Proof of address", "Government ID"], risk: "High", score: 68, region: "Seattle, WA", amount: "$890.00", signal: "Two required documents missing", tint: "#dce4eb" },
  { id: "GL9W5BM", name: "Omar Haddad", initials: "OH", email: "omar.haddad@email.com", submitted: "11:06 Jun 11", status: "Needs review", docs: 2, required: 3, missing: ["Proof of address"], risk: "Elevated", score: 76, region: "Chicago, IL", amount: "$1,275.80", signal: "Name format mismatch on ID", tint: "#e4e4d4" },
  { id: "GL3V7NK", name: "Priya Raman", initials: "PR", email: "priya.raman@email.com", submitted: "10:51 Jun 11", status: "Needs review", docs: 2, required: 3, missing: ["Proof of address"], risk: "Low", score: 91, region: "Austin, TX", amount: "$3,620.00", signal: "Address document not submitted", tint: "#eadfe5" },
  { id: "GL2J8VA", name: "Marta Silva", initials: "MS", email: "marta.silva@email.com", submitted: "13:28 yesterday", status: "Verified", docs: 3, required: 3, missing: [], risk: "Low", score: 97, region: "Lisbon, PT", amount: "$12,400.00", signal: "All checks cleared", tint: "#e6dfc9" },
];

const statusClass: Record<CaseStatus, string> = {
  "Needs review": "bg-[#f7e9dd] text-[#9a654b]",
  "In review": "bg-[#e7edf0] text-[#557282]",
  "Needs documents": "bg-[#f4ecd9] text-[#947848]",
  Verified: "bg-[#e5eee4] text-[#54795b]",
};

export default function BatchVerificationTriage() {
  const [cases, setCases] = useState(seedCases);
  const [selected, setSelected] = useState<string[]>(["GL8X2FQ", "GL4R3PD", "GL9W5BM", "GL3V7NK"]);
  const [focusId, setFocusId] = useState("GL8X2FQ");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"Open cases" | "All cases" | "High risk">("Open cases");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"Shared gaps" | "Risk signals">("Shared gaps");
  const [sortNewest, setSortNewest] = useState(false);

  const filtered = useMemo(() => cases.filter((item) => {
    const matches = `${item.name} ${item.id} ${item.email}`.toLowerCase().includes(query.toLowerCase());
    const show = filter === "All cases" || (filter === "High risk" ? item.risk === "High" : item.status !== "Verified");
    return matches && show;
  }), [cases, query, filter]);
  const ordered = sortNewest ? [...filtered].reverse() : filtered;
  const batch = cases.filter((item) => selected.includes(item.id));
  const focusCase = cases.find((item) => item.id === focusId) ?? cases[0];
  const missingCounts = useMemo(() => {
    const count: Record<string, number> = {};
    batch.forEach((item) => item.missing.forEach((doc) => { count[doc] = (count[doc] ?? 0) + 1; }));
    return Object.entries(count).sort((a, b) => b[1] - a[1]);
  }, [batch]);
  const unresolved = cases.filter((item) => item.status !== "Verified").length;
  const highRisk = cases.filter((item) => item.risk === "High" && item.status !== "Verified").length;
  const setToast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };
  const toggleCase = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const markSelected = (status: CaseStatus, message: string) => {
    if (!selected.length) return setToast("Select at least one case to continue.");
    setCases((current) => current.map((item) => selected.includes(item.id) ? { ...item, status } : item));
    setToast(`${selected.length} cases updated · ${message}`);
  };
  const selectVisible = () => setSelected((current) => {
    const visible = ordered.filter((item) => item.status !== "Verified").map((item) => item.id);
    return visible.every((id) => current.includes(id)) ? current.filter((id) => !visible.includes(id)) : [...new Set([...current, ...visible])];
  });

  return (
    <div className="min-h-[100dvh] bg-[#f1f3ec] text-[#253b43]">
      <header className="flex h-[66px] items-center justify-between border-b border-[#dce2d8] bg-[#f8f8f2] px-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#173d4a] text-[#e0c77d]"><Landmark size={18} /></div>
          <div className="leading-none"><p className="text-[13px] font-black tracking-[.11em]">GLOBUS</p><p className="mt-1 text-[8px] font-bold tracking-[.2em] text-[#8a9a8d]">MEMBER OPERATIONS</p></div>
          <span className="mx-1 hidden h-7 w-px bg-[#dce2d8] sm:block" />
          <p className="hidden text-[11px] text-[#788782] sm:block">Casework <ChevronRight className="mx-1 inline" size={12} /> <span className="font-semibold text-[#3e5757]">Batch triage</span></p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full bg-[#e9efe5] px-3 py-1.5 text-[9px] font-bold text-[#53705e] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#6c9a77]" /> Secure session</span>
          <button onClick={() => setToast("You're all caught up on alerts.")} aria-label="Notifications" className="relative grid h-9 w-9 place-items-center rounded-full border border-[#e1e5dc] bg-[#fbfbf7] text-[#617574] hover:bg-white"><Bell size={15} /><i className="absolute right-[8px] top-[7px] h-1.5 w-1.5 rounded-full bg-[#bd765c]" /></button>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#d8e4dc] text-[10px] font-bold text-[#28505a]">AM</div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 sm:py-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.18em] text-[#64867e]"><ShieldCheck size={13} /> Risk &amp; compliance <span className="text-[#a2aaa0]">/</span> Operations</p>
            <h1 className="text-[28px] font-semibold tracking-[-.045em] text-[#203a45] sm:text-[34px]">Batch verification triage</h1>
            <p className="mt-1 text-[11px] text-[#788983]">Spot repeated gaps and shared signals before opening individual decisions.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#dce3d9] bg-[#f8f8f2] px-3.5 py-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#f3ead0] text-[#947a38]"><Clock3 size={15} /></div>
            <div><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#8c9589]">Open queue</p><p className="mt-0.5 text-[13px] font-bold text-[#304a4e]">{unresolved} cases <span className="font-normal text-[#89958e]">awaiting review</span></p></div>
          </div>
        </div>

        <section className="mb-4 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr]">
          <div className="relative overflow-hidden rounded-[15px] bg-[#173e49] p-4 text-[#edf2e9] md:row-span-2 md:p-5">
            <div className="absolute -right-5 -top-8 h-36 w-36 rounded-full border border-white/10" />
            <div className="absolute -right-1 -top-4 h-28 w-28 rounded-full border border-white/10" />
            <div className="relative flex items-center gap-2 text-[#c5d6c9]"><Sparkles size={14} /><p className="text-[8px] font-bold uppercase tracking-[.15em]">Batch pattern · {batch.length} selected</p></div>
            <h2 className="relative mt-3 max-w-[290px] text-[19px] font-semibold leading-tight tracking-[-.035em] sm:text-[22px]">One missing document is slowing this group down.</h2>
            <p className="relative mt-2 max-w-[340px] text-[10px] leading-relaxed text-[#bed0c7]">Proof of address is the most common gap in your selection. Resolve the shared request first, then assess individual risk.</p>
            <div className="relative mt-5 flex flex-wrap items-end gap-2">
              {missingCounts.map(([doc, count]) => <div key={doc} className="flex min-w-[142px] items-center gap-2 rounded-xl border border-white/10 bg-white/[.06] px-3 py-2.5"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#d9e8d7] text-[#46694d]"><FileWarning size={14} /></span><span className="flex-1"><b className="block text-[10px]">{doc}</b><small className="text-[8px] text-[#b5c8bf]">{count} of {batch.length} selected</small></span><strong className="text-[15px] text-[#e4d195]">{count}</strong></div>)}
              {!missingCounts.length && <p className="text-[10px] text-[#c5d6c9]">Selected cases have no shared document gaps.</p>}
            </div>
            <div className="relative mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-[9px] text-[#c0d0c8]"><LockKeyhole size={12} className="text-[#d4c27e]" /> Batch actions are logged case-by-case to the audit trail.</div>
          </div>

          <div className="flex items-center gap-3 rounded-[15px] border border-[#e3e6dc] bg-[#fbfbf6] p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f5ead9] text-[#9a7847]"><FileCheck2 size={18} /></div>
            <div className="min-w-0 flex-1"><p className="text-[8px] font-bold uppercase tracking-[.13em] text-[#8a988d]">Most common gap</p><p className="mt-1 text-[12px] font-bold text-[#405752]">Proof of address</p><p className="mt-1 text-[9px] text-[#89968d]">Missing from {cases.filter((item) => item.missing.includes("Proof of address") && item.status !== "Verified").length} open cases</p></div>
            <span className="text-[18px] font-semibold tracking-tight text-[#9a7847]">{Math.round(cases.filter((item) => item.missing.includes("Proof of address") && item.status !== "Verified").length / Math.max(1, unresolved) * 100)}<small className="text-[10px]">%</small></span>
          </div>
          <div className="flex items-center gap-3 rounded-[15px] border border-[#e3e6dc] bg-[#fbfbf6] p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f3e4da] text-[#a5654e]"><ShieldAlert size={18} /></div>
            <div className="min-w-0 flex-1"><p className="text-[8px] font-bold uppercase tracking-[.13em] text-[#8a988d]">Elevated risk</p><p className="mt-1 text-[12px] font-bold text-[#405752]">{highRisk} high-risk case{highRisk === 1 ? "" : "s"}</p><p className="mt-1 text-[9px] text-[#89968d]">Escalate before any batch decision</p></div>
            <button onClick={() => setFilter(filter === "High risk" ? "Open cases" : "High risk")} className="whitespace-nowrap rounded-lg border border-[#e5e4db] px-2.5 py-2 text-[9px] font-semibold text-[#826b57] hover:bg-[#f6f1e8]">{filter === "High risk" ? "Clear" : "Review"} <ChevronRight size={11} className="ml-1 inline" /></button>
          </div>
          <div className="flex items-center gap-3 rounded-[15px] border border-[#e3e6dc] bg-[#fbfbf6] p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e6eee3] text-[#64816b]"><Users size={18} /></div>
            <div className="min-w-0 flex-1"><p className="text-[8px] font-bold uppercase tracking-[.13em] text-[#8a988d]">Selection</p><p className="mt-1 text-[12px] font-bold text-[#405752]">{selected.length} cases selected</p><p className="mt-1 text-[9px] text-[#89968d]">From {unresolved} open reviews</p></div>
            <button onClick={selectVisible} className="whitespace-nowrap rounded-lg border border-[#e5e9e0] px-2.5 py-2 text-[9px] font-semibold text-[#60776d] hover:bg-[#f1f4ed]">Select all</button>
          </div>
          <div className="flex items-center gap-3 rounded-[15px] border border-[#e3e6dc] bg-[#fbfbf6] p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e9ece9] text-[#687c7d]"><Activity size={18} /></div>
            <div className="min-w-0 flex-1"><p className="text-[8px] font-bold uppercase tracking-[.13em] text-[#8a988d]">Review window</p><p className="mt-1 text-[12px] font-bold text-[#405752]">Oldest first</p><p className="mt-1 text-[9px] text-[#89968d]">Queue order prioritizes wait time</p></div>
            <button onClick={() => { setSortNewest((value) => !value); setToast(`Queue sorted ${sortNewest ? "oldest" : "newest"} first.`); }} aria-label="Toggle queue sort" className="grid h-8 w-8 place-items-center rounded-lg border border-[#e5e9e0] text-[#73867e] hover:bg-[#f0f3ec]"><SlidersHorizontal size={14} /></button>
          </div>
        </section>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.85fr)]">
          <section className="min-w-0 overflow-hidden rounded-[16px] border border-[#dce3d9] bg-[#fbfbf6] shadow-[0_5px_18px_rgba(40,60,49,.04)]">
            <div className="border-b border-[#e7ebe3] p-4 sm:px-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#718b7f]">Casework</p><h2 className="mt-1 text-[15px] font-bold tracking-[-.02em]">Member reviews <span className="ml-1 text-[10px] font-medium text-[#94a098]">{filtered.length}</span></h2></div>
                <div className="flex items-center gap-2 rounded-lg bg-[#f1f3ed] p-1">
                  {(["Open cases", "All cases"] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-md px-2.5 py-1.5 text-[9px] font-semibold ${filter === item ? "bg-[#fbfbf7] text-[#385653] shadow-sm" : "text-[#829088]"}`}>{item}</button>)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex h-9 min-w-[190px] flex-1 items-center gap-2 rounded-lg border border-[#e1e6de] bg-[#f7f8f2] px-2.5 focus-within:border-[#8aa79a]">
                  <Search size={14} className="text-[#899991]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a member or ID" className="min-w-0 flex-1 bg-transparent text-[10px] outline-none placeholder:text-[#a2aaa1]" />
                  {query && <button onClick={() => setQuery("")} aria-label="Clear search" className="text-[#81918a]"><X size={13} /></button>}
                </label>
                <button onClick={selectVisible} className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e1e6de] px-3 text-[9px] font-semibold text-[#61776e] hover:bg-[#f1f4ed]"><CheckCheck size={13} /> Select open</button>
              </div>
            </div>
            <div className="hidden grid-cols-[34px_minmax(150px,1.2fr)_minmax(108px,.8fr)_100px_90px] items-center gap-2 border-b border-[#e9ede6] bg-[#f7f8f2] px-4 py-2 text-[8px] font-bold uppercase tracking-[.11em] text-[#929e94] md:grid">
              <button onClick={selectVisible} aria-label="Select all open cases" className="grid h-5 w-5 place-items-center rounded border border-[#d9e1d7] text-[#668276]">{selected.length > 0 && <Check size={12} />}</button><span>Member / submitted</span><span>Document status</span><span>Risk</span><span className="text-right">Trust score</span>
            </div>
            <div className="max-h-[475px] overflow-y-auto p-2">
              {ordered.map((item) => {
                const isSelected = selected.includes(item.id);
                return <div key={item.id} className={`mb-1 grid grid-cols-[28px_minmax(0,1fr)] items-start gap-2 rounded-[11px] border p-2.5 transition-colors md:grid-cols-[34px_minmax(150px,1.2fr)_minmax(108px,.8fr)_100px_90px] md:items-center md:px-3 ${focusId === item.id ? "border-[#c8d7c9] bg-[#f0f4eb]" : "border-transparent hover:bg-[#f5f6f0]"}`}>
                  <button onClick={() => toggleCase(item.id)} aria-label={`${isSelected ? "Deselect" : "Select"} ${item.name}`} className={`mt-1 grid h-5 w-5 place-items-center rounded border ${isSelected ? "border-[#668879] bg-[#668879] text-white" : "border-[#d7dfd5] bg-[#fbfbf7] text-transparent"} md:mt-0`}>{isSelected && <Check size={12} />}</button>
                  <button onClick={() => setFocusId(item.id)} className="min-w-0 text-left md:col-auto">
                    <span className="flex items-center gap-2.5"><span style={{ backgroundColor: item.tint }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[10px] font-bold text-[#36515a]">{item.initials}</span><span className="min-w-0"><span className="block truncate text-[10px] font-bold text-[#344a4e]">{item.name}</span><span className="mt-1 block truncate text-[8px] text-[#87948d]"><span className="font-mono">{item.id}</span> <span className="px-1">·</span>{item.submitted}</span></span></span>
                  </button>
                  <button onClick={() => setFocusId(item.id)} className="col-start-2 mt-2 flex items-center gap-1.5 text-left md:col-auto md:mt-0"><span className={`grid h-6 w-6 place-items-center rounded-md ${item.missing.length ? "bg-[#f4ead7] text-[#947748]" : "bg-[#e6efe4] text-[#5c8063]"}`}><FileCheck2 size={12} /></span><span><span className="block text-[9px] font-semibold text-[#536662]">{item.docs}/{item.required} received</span><span className="block text-[8px] text-[#929d93]">{item.missing[0] ?? "Complete"}</span></span></button>
                  <button onClick={() => setFocusId(item.id)} className="col-start-2 mt-2 flex items-center gap-1.5 text-left md:col-auto md:mt-0"><span className={`h-1.5 w-1.5 rounded-full ${item.risk === "High" ? "bg-[#b6634c]" : item.risk === "Elevated" ? "bg-[#c29b53]" : "bg-[#6f9a76]"}`} /><span className={`text-[9px] font-semibold ${item.risk === "High" ? "text-[#a35f49]" : item.risk === "Elevated" ? "text-[#987b44]" : "text-[#63806a]"}`}>{item.risk}</span></button>
                  <button onClick={() => setFocusId(item.id)} className="col-start-2 mt-2 flex items-center justify-between gap-2 text-left md:col-auto md:mt-0 md:justify-end"><span className="text-[8px] text-[#9aa39a] md:hidden">Trust score</span><span className="font-mono text-[10px] font-semibold text-[#526969]">{item.score}<span className="text-[#a5afa6"> / 100</span></span></button>
                </div>;
              })}
              {ordered.length === 0 && <div className="px-4 py-12 text-center"><Search size={20} className="mx-auto mb-2 text-[#a9b4a8]" /><p className="text-[11px] font-semibold">No matching cases</p><p className="mt-1 text-[9px] text-[#8c9990]">Try another name or clear your filter.</p><button onClick={() => { setQuery(""); setFilter("All cases"); }} className="mt-3 text-[9px] font-bold text-[#537a70]">Clear filters</button></div>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e7ebe3] px-4 py-3 text-[9px] text-[#8d9991]"><span>Sorted by {sortNewest ? "newest" : "oldest"} submission</span><button onClick={() => setToast("Queue rules prioritize member wait time and unresolved document gaps.")} className="font-semibold text-[#56756d]">Queue rules <ChevronRight className="ml-1 inline" size={11} /></button></div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-[16px] border border-[#dce3d9] bg-[#fbfbf6] shadow-[0_5px_18px_rgba(40,60,49,.04)]">
            <div className="flex items-start justify-between gap-3 border-b border-[#e7ebe3] px-4 py-4 sm:px-5">
              <div><p className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.15em] text-[#718b7f]"><CircleAlert size={12} /> Signal review</p><h2 className="mt-1.5 text-[15px] font-bold tracking-[-.03em] text-[#2a4249]">{focusCase.name}</h2><p className="mt-1 text-[9px] text-[#85938b]">{focusCase.email} · <span className="font-mono">{focusCase.id}</span></p></div>
              <span className={`rounded-full px-2 py-1 text-[8px] font-bold ${statusClass[focusCase.status]}`}>{focusCase.status}</span>
            </div>
            <div className="flex gap-5 border-b border-[#e7ebe3] px-4 sm:px-5">
              {(["Shared gaps", "Risk signals"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`relative py-3 text-[9px] font-semibold ${tab === item ? "text-[#315a59]" : "text-[#8b9890] hover:text-[#526b68]"}`}>{item}{tab === item && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#668d7d]" />}</button>)}
            </div>
            {tab === "Shared gaps" ? <div className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f5f6ef] p-3">
                <div className="flex items-center gap-2.5"><span style={{ backgroundColor: focusCase.tint }} className="grid h-9 w-9 place-items-center rounded-full text-[10px] font-bold text-[#36515a]">{focusCase.initials}</span><span><b className="block text-[10px] text-[#455b56]">{focusCase.docs} of {focusCase.required} documents</b><small className="text-[8px] text-[#8c9990]">{focusCase.region} · {focusCase.submitted}</small></span></div>
                <span className="font-mono text-[11px] font-semibold text-[#526969]">{focusCase.score}<small className="text-[8px] font-normal text-[#9aa49b]"> / 100</small></span>
              </div>
              <div><div className="mb-2 flex items-center justify-between"><p className="text-[8px] font-bold uppercase tracking-[.13em] text-[#82948a]">Outstanding for this member</p><span className="text-[8px] text-[#9aa49b]">{focusCase.missing.length} missing</span></div>
                {focusCase.missing.length ? focusCase.missing.map((doc) => <div key={doc} className="mb-2 flex items-center gap-2.5 rounded-lg border border-[#e7e8df] bg-[#f9f9f4] p-2.5"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f4ead7] text-[#947748]"><FileWarning size={13} /></span><span className="flex-1"><b className="block text-[9px] text-[#52635c]">{doc}</b><small className="text-[8px] text-[#929d93]">{doc === "Proof of address" ? "No recent statement on file" : "Identity evidence not submitted"}</small></span><span className="rounded-full bg-[#f4ecd9] px-2 py-1 text-[7px] font-bold text-[#947848]">Missing</span></div>) : <div className="rounded-lg border border-[#e5e9e0] bg-[#f8f8f3] px-3 py-4 text-center text-[9px] text-[#65816b]"><BadgeCheck size={16} className="mx-auto mb-1" />All required documents received</div>}
              </div>
              <div className="rounded-xl border border-[#e4e8de] p-3"><p className="text-[8px] font-bold uppercase tracking-[.13em] text-[#82948a]">Shared queue pattern</p><div className="mt-3 space-y-2">{missingCounts.length ? missingCounts.slice(0, 3).map(([doc, count]) => <div key={doc} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#bd9653]" /><span className="flex-1 text-[9px] text-[#64756c]">{doc}</span><div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#ebeee6]"><span className="block h-full rounded-full bg-[#c4a86d]" style={{ width: `${Math.max(12, count / Math.max(1, batch.length) * 100)}%` }} /></div><b className="w-5 text-right text-[8px] text-[#687c71]">{count}</b></div>) : <p className="text-[9px] text-[#88978e]">No recurring document gaps in the current selection.</p>}</div></div>
              <button onClick={() => setToast(`Document request prepared for ${focusCase.name}.`)} className="w-full rounded-lg border border-[#dfe5dc] bg-[#fbfbf7] px-3 py-2.5 text-[9px] font-semibold text-[#657772] hover:bg-[#f0f3ec]"><FileCheck2 size={12} className="mr-1.5 inline" />Request missing document</button>
            </div> : <div className="space-y-3 p-4 sm:p-5">
              <div className={`rounded-xl border p-3 ${focusCase.risk === "High" ? "border-[#ead5ca] bg-[#fbf1eb]" : focusCase.risk === "Elevated" ? "border-[#ebdfc5] bg-[#faf5e9]" : "border-[#dfe8dc] bg-[#f3f7f0]"}`}>
                <div className="flex items-center gap-2"><span className={`grid h-7 w-7 place-items-center rounded-lg ${focusCase.risk === "High" ? "bg-[#f3dfd5] text-[#a35f49]" : focusCase.risk === "Elevated" ? "bg-[#f0e5c8] text-[#987b44]" : "bg-[#e5eee2] text-[#62816a]"}`}><ShieldAlert size={14} /></span><div><p className="text-[9px] font-bold text-[#4c5e57]">{focusCase.risk} risk signal</p><p className="text-[8px] text-[#8c9990]">Automated screen · review required</p></div></div>
                <p className="mt-3 text-[10px] leading-relaxed text-[#62736b]">{focusCase.signal}</p>
              </div>
              <div className="rounded-xl border border-[#e4e8de] p-3"><p className="text-[8px] font-bold uppercase tracking-[.13em] text-[#82948a]">Review considerations</p><div className="mt-3 space-y-2.5"><div className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c29b53]" /><p className="text-[9px] leading-relaxed text-[#66776f]">Compare identity details across submitted evidence before deciding.</p></div><div className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c29b53]" /><p className="text-[9px] leading-relaxed text-[#66776f]">Automated scores guide review; they are not a decision on their own.</p></div><div className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c29b53]" /><p className="text-[9px] leading-relaxed text-[#66776f]">Resolve shared document gaps without clearing distinct risk signals.</p></div></div></div>
              <div className="flex items-start gap-2 rounded-xl border border-[#e5e9e0] bg-[#f6f7f1] p-3"><LockKeyhole size={13} className="mt-0.5 shrink-0 text-[#80938a]" /><p className="text-[8px] leading-[1.6] text-[#819089]">Each individual decision remains attributable. Batch tools only change the selected queue status.</p></div>
            </div>}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e7ebe3] bg-[#f8f8f3] px-4 py-3 sm:px-5">
              <p className="flex items-center gap-1.5 text-[8px] text-[#8b9890]"><ShieldCheck size={12} className="text-[#779084]" /> Audit history enabled</p>
              <button onClick={() => { setFocusId(focusCase.id); setToast(`Individual review opened for ${focusCase.name}.`); }} className="flex items-center gap-1.5 rounded-lg border border-[#dfe5dc] px-3 py-2 text-[9px] font-semibold text-[#526b6e] hover:bg-[#f1f4ed]">Open individual review <ChevronRight size={12} /></button>
            </div>
          </section>
        </div>

        <div className="sticky bottom-3 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#dce3d9] bg-[#fbfbf6]/95 px-4 py-3 shadow-[0_8px_28px_rgba(40,60,49,.12)] backdrop-blur sm:px-5">
          <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e7eee5] text-[#5a7b61]"><CheckCheck size={14} /></span><span><b className="block text-[10px] text-[#405752]">{selected.length} selected</b><small className="text-[8px] text-[#89968d]">Actions apply to selected cases</small></span></div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => markSelected("Needs documents", "document requests queued")} disabled={!selected.length} className="rounded-lg border border-[#dfe5dc] bg-[#fbfbf7] px-3 py-2 text-[9px] font-semibold text-[#657772] hover:bg-[#f0f3ec] disabled:opacity-40">Request documents</button>
            <button onClick={() => markSelected("In review", "moved to active review")} disabled={!selected.length} className="rounded-lg border border-[#dfe5dc] bg-[#fbfbf7] px-3 py-2 text-[9px] font-semibold text-[#657772] hover:bg-[#f0f3ec] disabled:opacity-40">Assign to review</button>
            <button onClick={() => markSelected("Verified", "marked verified")} disabled={!selected.length} className="flex items-center gap-1.5 rounded-lg bg-[#17424c] px-3.5 py-2 text-[9px] font-bold text-[#f4f4e9] hover:bg-[#225661] disabled:opacity-40"><Check size={12} /> Verify selected</button>
          </div>
        </div>
      </main>
      {notice && <div role="status" className="fixed bottom-5 left-1/2 z-30 max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl bg-[#1c414b] px-4 py-3 text-center text-[10px] font-semibold text-[#edf2e9] shadow-xl">{notice}</div>}
    </div>
  );
}
