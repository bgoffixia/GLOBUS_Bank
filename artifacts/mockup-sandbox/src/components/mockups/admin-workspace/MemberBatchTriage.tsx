import { useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowUpRight, BadgeCheck, Bell, Check, ChevronDown,
  ChevronRight, CircleAlert, Clock3, FileCheck2, Filter, Landmark, LockKeyhole,
  Search, ShieldCheck, SlidersHorizontal, UserRound, Users,
} from "lucide-react";

type Member = {
  id: string;
  name: string;
  email: string;
  initials: string;
  joined: string;
  status: "Needs review" | "In review" | "Verified" | "Needs documents";
  amount: string;
  region: string;
  flag: string;
  score: number;
  docs: string;
  lastAction: string;
  color: string;
};

const startingMembers: Member[] = [
  { id: "GL8X2FQ", name: "Avery Morgan", email: "avery.morgan@email.com", initials: "AM", joined: "Today, 09:42", status: "Needs review", amount: "$4,850.00", region: "Portland, OR", flag: "US", score: 82, docs: "2 of 3 received", lastAction: "Passport uploaded 8 min ago", color: "#d9e8dc" },
  { id: "GL6K9TW", name: "Nia Okafor", email: "nia.okafor@email.com", initials: "NO", joined: "Today, 08:17", status: "In review", amount: "$2,140.50", region: "Toronto, ON", flag: "CA", score: 94, docs: "3 of 3 received", lastAction: "Address confirmed 21 min ago", color: "#e6dcd0" },
  { id: "GL4R3PD", name: "Leo Chen", email: "leo.chen@email.com", initials: "LC", joined: "Yesterday, 16:03", status: "Needs documents", amount: "$890.00", region: "Seattle, WA", flag: "US", score: 68, docs: "1 of 3 received", lastAction: "Proof of address requested", color: "#dce3ea" },
  { id: "GL2J8VA", name: "Marta Silva", email: "marta.silva@email.com", initials: "MS", joined: "Yesterday, 13:28", status: "Verified", amount: "$12,400.00", region: "Lisbon, PT", flag: "PT", score: 97, docs: "3 of 3 received", lastAction: "Identity verified yesterday", color: "#e6dfc9" },
  { id: "GL9W5BM", name: "Omar Haddad", email: "omar.haddad@email.com", initials: "OH", joined: "Jun 11, 11:06", status: "Needs review", amount: "$1,275.80", region: "Chicago, IL", flag: "US", score: 76, docs: "2 of 3 received", lastAction: "Selfie uploaded 1 hr ago", color: "#d8e3db" },
];

const tabs = ["Overview", "Identity", "Account activity"] as const;
type Tab = typeof tabs[number];

export default function MemberBatchTriage() {
  const [members, setMembers] = useState(startingMembers);
  const [selectedId, setSelectedId] = useState(startingMembers[0].id);
  const [checkedIds, setCheckedIds] = useState<string[]>(["GL8X2FQ", "GL4R3PD", "GL9W5BM"]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All cases");
  const [tab, setTab] = useState<Tab>("Overview");
  const [notice, setNotice] = useState("");
  const selected = members.find((member) => member.id === selectedId) ?? members[0];
  const filtered = useMemo(() => members.filter((member) => {
    const matchesQuery = `${member.name} ${member.email} ${member.id}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (filter === "All cases" || member.status === filter);
  }), [members, query, filter]);
  const attentionCount = members.filter((member) => member.status === "Needs review" || member.status === "In review").length;
  const missingDocsCount = members.filter((member) => member.docs !== "3 of 3 received" && member.status !== "Verified").length;
  const highRiskCount = members.filter((member) => member.score < 80 && member.status !== "Verified").length;
  const allVisibleChecked = filtered.length > 0 && filtered.every((member) => checkedIds.includes(member.id));

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };
  const changeStatus = (ids: string[], status: Member["status"], message: string) => {
    setMembers((current) => current.map((member) => ids.includes(member.id) ? { ...member, status } : member));
    flash(message);
  };
  const toggleChecked = (id: string) => {
    setCheckedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <div className="min-h-screen bg-[#f1f3ec] text-[#253b43]">
      <header className="flex min-h-[64px] items-center justify-between border-b border-[#dce2d8] bg-[#f8f8f2] px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#173d4a] text-[#e0c77d]"><Landmark size={18} /></div>
          <div className="leading-none"><p className="text-[13px] font-black tracking-[.11em]">GLOBUS</p><p className="mt-1 text-[8px] font-bold tracking-[.2em] text-[#8a9a8d]">MEMBER OPERATIONS</p></div>
          <span className="mx-2 hidden h-7 w-px bg-[#dce2d8] sm:block" />
          <p className="hidden text-[11px] text-[#788782] sm:block">Casework <ChevronRight className="mx-1 inline" size={12} /> <span className="font-semibold text-[#3e5757]">Batch triage</span></p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full bg-[#e9efe5] px-3 py-1.5 text-[9px] font-bold text-[#53705e] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#6c9a77]" /> Secure session</span>
          <button onClick={() => flash("You're all caught up on alerts.")} aria-label="Notifications" className="relative grid h-9 w-9 place-items-center rounded-full border border-[#e1e5dc] bg-[#fbfbf7] text-[#617574] hover:bg-white"><Bell size={15} /><i className="absolute right-[8px] top-[7px] h-1.5 w-1.5 rounded-full bg-[#bd765c]" /></button>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#d8e4dc] text-[10px] font-bold text-[#28505a]">AM</div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 sm:py-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.18em] text-[#64867e]"><ShieldCheck size={13} /> Risk &amp; compliance / Operations view</p>
            <h1 className="text-[28px] font-semibold tracking-[-.045em] text-[#203a45] sm:text-[34px]">Batch triage</h1>
            <p className="mt-1 text-[11px] text-[#788983]">Spot shared evidence gaps and risk signals before opening a case.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#dce3d9] bg-[#f8f8f2] px-3.5 py-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#f3ead0] text-[#947a38]"><Clock3 size={15} /></div>
            <div><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#8c9589]">Review queue</p><p className="mt-0.5 text-[13px] font-bold text-[#304a4e]">{attentionCount} cases <span className="font-normal text-[#89958e]">need attention</span></p></div>
          </div>
        </div>

        <section className="mb-4 grid gap-3 sm:grid-cols-[1.5fr_1fr_1fr]">
          <div className="relative overflow-hidden rounded-[15px] bg-[#173e49] p-4 text-[#edf2e9] sm:p-5">
            <div className="absolute -right-8 -top-12 h-40 w-40 rounded-full border border-white/10" />
            <div className="absolute -right-1 -top-5 h-28 w-28 rounded-full border border-white/10" />
            <p className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[.17em] text-[#b4cbbb]"><Activity size={12} /> Shared signal · this queue</p>
            <p className="mt-2 max-w-[440px] text-[14px] font-semibold leading-snug sm:text-[16px]">{missingDocsCount} open cases are missing at least one verification document.</p>
            <p className="mt-1.5 text-[9px] text-[#b6c8bf]">Compare evidence gaps across the batch before making individual decisions.</p>
          </div>
          <div className="flex items-center justify-between rounded-[15px] border border-[#dce3d9] bg-[#fbfbf6] p-4">
            <div><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#87968d]">Risk signals</p><p className="mt-2 text-[23px] font-semibold tracking-[-.05em] text-[#9a654e]">{highRiskCount}<span className="ml-1.5 text-[11px] font-medium tracking-normal text-[#829087]">below 80 score</span></p><p className="mt-1 text-[9px] text-[#89968d]">Review before approving</p></div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f4e8df] text-[#a46d52]"><CircleAlert size={17} /></span>
          </div>
          <div className="flex items-center justify-between rounded-[15px] border border-[#dce3d9] bg-[#fbfbf6] p-4">
            <div><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#87968d]">Batch selected</p><p className="mt-2 text-[23px] font-semibold tracking-[-.05em] text-[#315d59]">{checkedIds.length}<span className="ml-1.5 text-[11px] font-medium tracking-normal text-[#829087]">of {members.length} cases</span></p><p className="mt-1 text-[9px] text-[#89968d]">Select rows to act together</p></div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e5eee3] text-[#62836a]"><Users size={17} /></span>
          </div>
        </section>

        <section className="overflow-hidden rounded-[16px] border border-[#dce3d9] bg-[#fbfbf6] shadow-[0_5px_18px_rgba(40,60,49,.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7ebe3] px-4 py-3.5 sm:px-5">
            <div><p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#718b7f]">Batch comparison</p><p className="mt-1 text-[14px] font-bold tracking-[-.02em]">Member reviews <span className="ml-1 text-[10px] font-medium text-[#94a098]">{filtered.length} cases</span></p></div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-9 w-[210px] items-center gap-2 rounded-lg border border-[#e1e6de] bg-[#f7f8f2] px-2.5 focus-within:border-[#8aa79a]">
                <Search size={14} className="shrink-0 text-[#899991]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a member or ID" className="min-w-0 flex-1 bg-transparent text-[10px] outline-none placeholder:text-[#a2aaa1]" />
              </label>
              <button onClick={() => setFilter(filter === "All cases" ? "Needs review" : "All cases")} className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e1e6de] px-2.5 text-[9px] font-semibold text-[#6d8178] hover:bg-[#f0f3ec]"><SlidersHorizontal size={13} /><span>{filter === "All cases" ? "All cases" : "Needs review"}</span><ChevronDown size={12} /></button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="bg-[#f5f6ef] text-[8px] font-bold uppercase tracking-[.13em] text-[#87968d]">
                <tr>
                  <th className="w-10 px-4 py-3"><input aria-label="Select all visible cases" type="checkbox" checked={allVisibleChecked} onChange={() => setCheckedIds(allVisibleChecked ? checkedIds.filter((id) => !filtered.some((member) => member.id === id)) : [...new Set([...checkedIds, ...filtered.map((member) => member.id)])])} className="accent-[#426c61]" /></th>
                  <th className="px-2 py-3">Member</th><th className="px-3 py-3">Evidence received</th><th className="px-3 py-3">Risk score</th><th className="px-3 py-3">Balance</th><th className="px-3 py-3">Queue status</th><th className="px-3 py-3">Latest activity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => {
                  const isSelected = member.id === selected.id;
                  const isChecked = checkedIds.includes(member.id);
                  const riskFlag = member.score < 80 && member.status !== "Verified";
                  return <tr key={member.id} onClick={() => { setSelectedId(member.id); setTab("Overview"); }} className={`cursor-pointer border-t border-[#e9ede6] transition-colors ${isSelected ? "bg-[#edf3e9]" : "hover:bg-[#f7f8f2]"}`}>
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}><input aria-label={`Select ${member.name}`} type="checkbox" checked={isChecked} onChange={() => toggleChecked(member.id)} className="accent-[#426c61]" /></td>
                    <td className="px-2 py-3"><div className="flex min-w-[170px] items-center gap-2.5"><span style={{ backgroundColor: member.color }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[9px] font-bold text-[#36515a]">{member.initials}</span><span className="min-w-0"><span className="block text-[10px] font-bold text-[#344a4e]">{member.name}</span><span className="mt-0.5 block text-[8px] text-[#87948d]">{member.id} · {member.flag}</span></span></div></td>
                    <td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 text-[9px] font-semibold ${member.docs === "3 of 3 received" ? "text-[#5d8064]" : "text-[#9a7442]"}`}>{member.docs === "3 of 3 received" ? <Check size={12} /> : <CircleAlert size={12} />}{member.docs}</span><span className="mt-1 block text-[8px] text-[#9aa39a]">{member.docs === "1 of 3 received" ? "2 outstanding" : member.docs === "2 of 3 received" ? "1 outstanding" : "Complete"}</span></td>
                    <td className="px-3 py-3"><span className={`font-mono text-[11px] font-bold ${riskFlag ? "text-[#a4664e]" : "text-[#466c57]"}`}>{member.score}</span><span className={`ml-1.5 rounded-full px-1.5 py-1 text-[7px] font-bold ${riskFlag ? "bg-[#f4e8df] text-[#9a654e]" : "bg-[#e8efe5] text-[#64806a]"}`}>{riskFlag ? "SIGNAL" : "CLEAR"}</span></td>
                    <td className="px-3 py-3 text-[10px] font-semibold text-[#52696a]">{member.amount}</td>
                    <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-[8px] font-semibold ${member.status === "Verified" ? "bg-[#e6efe4] text-[#52775a]" : member.status === "Needs documents" ? "bg-[#f4ead7] text-[#947748]" : member.status === "In review" ? "bg-[#e7edf0] text-[#557282]" : "bg-[#f4e8df] text-[#9a654e]"}`}>{member.status}</span></td>
                    <td className="max-w-[185px] px-3 py-3 text-[8px] text-[#7f8f86]">{member.lastAction}</td>
                  </tr>;
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="px-4 py-10 text-center"><Search size={20} className="mx-auto mb-2 text-[#a9b4a8]" /><p className="text-[11px] font-semibold">No matching cases</p><p className="mt-1 text-[9px] text-[#8c9990]">Try another name or clear the filter.</p><button onClick={() => { setQuery(""); setFilter("All cases"); }} className="mt-3 text-[9px] font-bold text-[#537a70]">Clear search</button></div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e7ebe3] px-4 py-3 sm:px-5">
            <p className="flex items-center gap-1.5 text-[9px] text-[#8b9890]"><Filter size={12} /> Sorted by oldest first <span className="mx-1">·</span> Shared gaps surfaced above</p>
            <div className="flex items-center gap-2">
              <button onClick={() => flash(`Queue rules: oldest submission first. ${missingDocsCount} open document gaps.`)} className="rounded-lg px-2 py-2 text-[9px] font-semibold text-[#56756d] hover:bg-[#f1f4ed]">Queue rules</button>
              <button onClick={() => checkedIds.length ? changeStatus(checkedIds, "In review", `${checkedIds.length} selected ${checkedIds.length === 1 ? "case" : "cases"} moved into review.`) : flash("Select one or more cases first.")} className="flex items-center gap-1.5 rounded-lg bg-[#17424c] px-3.5 py-2 text-[9px] font-bold text-[#f4f4e9] hover:bg-[#225661]"><Check size={12} /> Review selected <span className="rounded-full bg-white/15 px-1.5 py-0.5">{checkedIds.length}</span></button>
            </div>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-[16px] border border-[#dce3d9] bg-[#fbfbf6] shadow-[0_5px_18px_rgba(40,60,49,.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7ebe3] px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
              <div style={{ backgroundColor: selected.color }} className="grid h-10 w-10 place-items-center rounded-full text-[11px] font-bold text-[#36515a]">{selected.initials}</div>
              <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-[15px] font-bold tracking-[-.035em] text-[#2a4249]">{selected.name}</h2><span className="rounded-full bg-[#f3ead9] px-2 py-1 text-[8px] font-bold text-[#927345]">{selected.status}</span></div><p className="mt-1 text-[9px] text-[#85938b]">{selected.email} · <span className="font-mono">{selected.id}</span></p></div>
            </div>
            <p className="flex items-center gap-1.5 text-[8px] text-[#8b9890]"><ShieldCheck size={12} className="text-[#779084]" /> Decision recorded to member audit history</p>
          </div>
          <div className="flex gap-5 border-b border-[#e7ebe3] px-4 sm:px-5">{tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`relative py-3 text-[9px] font-semibold ${tab === item ? "text-[#315a59]" : "text-[#8b9890] hover:text-[#526b68]"}`}>{item}{tab === item && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#668d7d]" />}</button>)}</div>

          {tab === "Overview" && <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_260px]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#82948a]">Selected case · quick assessment</p><p className="mt-1 text-[11px] font-semibold text-[#3c5557]">Evidence is compared alongside the full batch.</p></div>
                <div className="flex items-center gap-2 rounded-lg bg-[#eef3e9] px-2.5 py-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#d8e7d6] text-[#4e7959]"><BadgeCheck size={14} /></span><span><b className="block text-[9px] text-[#496e57]">Trust score</b><small className="text-[7px] text-[#819187]">Automated · updated now</small></span><strong className="ml-2 text-[13px] text-[#42684f]">{selected.score}</strong></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-[#e5e9e0] bg-[#f7f8f2] p-3"><div className="mb-2 flex items-center justify-between text-[#7a8e83]"><UserRound size={14} /><span className="text-[7px] uppercase tracking-[.12em]">Member since</span></div><p className="text-[10px] font-bold text-[#425958]">{selected.joined}</p></div>
                <div className="rounded-xl border border-[#e5e9e0] bg-[#f7f8f2] p-3"><div className="mb-2 flex items-center justify-between text-[#7a8e83]"><FileCheck2 size={14} /><span className="text-[7px] uppercase tracking-[.12em]">Documents</span></div><p className="text-[10px] font-bold text-[#425958]">{selected.docs}</p></div>
                <div className="rounded-xl border border-[#e5e9e0] bg-[#f7f8f2] p-3"><div className="mb-2 flex items-center justify-between text-[#7a8e83]"><Landmark size={14} /><span className="text-[7px] uppercase tracking-[.12em]">Location</span></div><p className="text-[10px] font-bold text-[#425958]">{selected.region}</p></div>
              </div>
              <div><div className="mb-2 flex items-center justify-between"><div><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#82948a]">Verification checklist</p><p className="mt-1 text-[9px] text-[#8d9990]">Review evidence against the member profile.</p></div><button onClick={() => setTab("Identity")} className="text-[8px] font-bold text-[#5b8275]">Open identity <ChevronRight className="ml-1 inline" size={11} /></button></div>
                <div className="overflow-hidden rounded-xl border border-[#e4e9df]">{[["Government ID", "Passport · United States", "Verified"], ["Proof of address", "Utility statement · May 2025", "Verified"], ["Liveness check", "Selfie match · 98.3%", "Review"]].map(([title, description, state], index) => <div key={title} className="flex items-center gap-3 border-b border-[#e9ede6] px-3 py-2 last:border-b-0"><span className={`grid h-7 w-7 place-items-center rounded-lg ${state === "Verified" ? "bg-[#e6efe4] text-[#5c8063]" : "bg-[#f5ecda] text-[#9a7a45]"}`}>{state === "Verified" ? <Check size={13} /> : <CircleAlert size={13} />}</span><div className="min-w-0 flex-1"><p className="text-[9px] font-semibold text-[#465b59]">{title}</p><p className="mt-0.5 truncate text-[8px] text-[#8b9890]">{description}</p></div><span className={`text-[8px] font-semibold ${state === "Verified" ? "text-[#62836a]" : "text-[#9a7a45]"}`}>{state}</span><span className="hidden text-[8px] text-[#a0aaa0] sm:block">0{index + 1}</span></div>)}</div>
              </div>
              <div className="rounded-xl border border-[#e6e9df] bg-[#f7f8f2] p-3"><div className="mb-1.5 flex items-center gap-2"><Activity size={12} className="text-[#779084]" /><p className="text-[8px] font-bold uppercase tracking-[.13em] text-[#71877d]">Latest activity</p></div><p className="text-[9px] text-[#607471]">{selected.lastAction}</p></div>
            </div>
            <aside className="space-y-3">
              <div className="rounded-xl bg-[#173e49] p-4 text-[#e6eeea]"><p className="text-[8px] font-bold uppercase tracking-[.15em] text-[#a9c5b4]">Account at a glance</p><div className="mt-3 flex items-end justify-between"><div><p className="text-[8px] text-[#b4c7be]">Available balance</p><p className="mt-1 text-[20px] font-semibold tracking-[-.045em]">{selected.amount}</p></div><div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-[#d6c17c]"><Users size={15} /></div></div><div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3"><div><p className="text-[8px] text-[#a9bdb5]">Accounts</p><p className="mt-1 text-[10px] font-semibold">1 active</p></div><div><p className="text-[8px] text-[#a9bdb5]">Wallets</p><p className="mt-1 text-[10px] font-semibold">2 linked</p></div></div></div>
              <div className="rounded-xl border border-[#e5e9e0] bg-[#f8f8f3] p-3"><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#87968d]">Recent movement</p><div className="mt-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#e4eee4] text-[#648368]"><ArrowDownLeft size={13} /></span><div className="min-w-0 flex-1"><p className="text-[8px] font-semibold text-[#536662]">Incoming transfer</p><p className="text-[7px] text-[#98a39a]">Today · 08:56</p></div><span className="text-[8px] font-semibold text-[#56735c]">+$380.00</span></div><div className="my-2 border-t border-[#e8ece4]" /><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#f1e9de] text-[#a17b59]"><ArrowUpRight size={13} /></span><div className="min-w-0 flex-1"><p className="text-[8px] font-semibold text-[#536662]">Card authorization</p><p className="text-[7px] text-[#98a39a]">Yesterday · 19:12</p></div><span className="text-[8px] font-semibold text-[#657471]">−$62.40</span></div></div>
              <div className="flex items-start gap-2 rounded-xl border border-[#e5e9e0] bg-[#f6f7f1] p-3"><LockKeyhole size={12} className="mt-0.5 shrink-0 text-[#80938a]" /><p className="text-[8px] leading-[1.6] text-[#819089]">Sensitive account controls are recorded in the audit trail.</p></div>
            </aside>
          </div>}

          {tab === "Identity" && <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_260px]"><div><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#82948a]">Identity evidence</p><h3 className="mt-1 text-[14px] font-bold text-[#334c4e]">Documents submitted by {selected.name.split(" ")[0]}</h3><p className="mt-1 text-[9px] text-[#89978f]">Check submitted evidence against the member profile.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["Government ID", "Passport · United States", "Verified", "Avery_Morgan_Passport.pdf"], ["Proof of address", "Utility statement · May 2025", "Verified", "Portland_Electric_May.pdf"], ["Liveness check", "Selfie match · 98.3%", "Review", "Live capture · 09:38"]].map(([title, description, state, filename]) => <div key={title} className="rounded-xl border border-[#e4e9df] bg-[#f8f8f3] p-4"><div className="flex items-start justify-between"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e8eee5] text-[#678274]"><FileCheck2 size={16} /></span><span className={`rounded-full px-2 py-1 text-[8px] font-bold ${state === "Verified" ? "bg-[#e6efe4] text-[#5c8063]" : "bg-[#f5ecda] text-[#9a7a45]"}`}>{state}</span></div><p className="mt-3 text-[10px] font-bold text-[#445b57]">{title}</p><p className="mt-1 text-[8px] text-[#84928a]">{description}</p><div className="mt-3 truncate rounded-lg border border-[#e6eae2] bg-[#fbfbf7] px-2.5 py-2 text-[8px] text-[#84928a]">{filename}</div><button onClick={() => flash(`${title} document preview opened.`)} className="mt-3 text-[8px] font-bold text-[#56796d]">Preview evidence <ChevronRight className="ml-1 inline" size={11} /></button></div>)}</div></div><aside className="rounded-xl bg-[#173e49] p-4 text-[#e6eeea]"><p className="text-[8px] font-bold uppercase tracking-[.15em] text-[#a9c5b4]">Review guidance</p><p className="mt-3 text-[11px] font-semibold">Check all evidence together.</p><p className="mt-2 text-[9px] leading-relaxed text-[#b8c9c1]">Compare the photo and name on the ID with the submitted profile. Confirm the address is recent and matches the member’s location.</p><div className="mt-4 border-t border-white/10 pt-3 text-[8px] text-[#b8c9c1]">Policy reference <button onClick={() => flash("Identity verification policy opened.")} className="font-semibold text-[#e1cc82]">IDV-04 <ChevronRight className="ml-1 inline" size={10} /></button></div></aside></div>}

          {tab === "Account activity" && <div className="p-4 sm:p-5"><div className="mb-4"><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#82948a]">Member timeline</p><h3 className="mt-1 text-[14px] font-bold text-[#334c4e]">Recent account activity</h3></div>{[[Clock3, "Identity review started", "Assigned to Alex Morgan · Today, 09:38"], [FileCheck2, "Passport received", "Uploaded by member · Today, 09:34"], [Activity, "Incoming transfer", "$380.00 USD · Today, 08:56"], [UserRound, "Member profile created", `${selected.region} · ${selected.joined}`]].map(([Icon, title, detail], index) => { const EventIcon = Icon as typeof Activity; return <div key={String(title)} className="flex gap-3"><div className="flex flex-col items-center"><span className={`grid h-8 w-8 place-items-center rounded-full ${index === 0 ? "bg-[#e5eee3] text-[#65816a]" : "bg-[#eef0e8] text-[#7d8b82]"}`}><EventIcon size={14} /></span>{index < 3 && <span className="my-1 h-7 w-px bg-[#dfe5dc]" />}</div><div className="pt-1"><p className="text-[9px] font-semibold text-[#4d625d]">{String(title)}</p><p className="mt-1 text-[8px] text-[#89968e]">{String(detail)}</p></div></div>; })}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e7ebe3] bg-[#f8f8f3] px-4 py-3 sm:px-5">
            <p className="text-[8px] text-[#8b9890]">Selected case: {selected.name} · {selected.id}</p>
            <div className="flex items-center gap-2"><button onClick={() => changeStatus([selected.id], "Needs documents", `Document request prepared for ${selected.name}.`)} className="rounded-lg border border-[#dfe5dc] bg-[#fbfbf7] px-3 py-2 text-[8px] font-semibold text-[#657772] hover:bg-[#f0f3ec]">Request documents</button><button onClick={() => changeStatus([selected.id], "Verified", `${selected.name} marked verified.`)} className="flex items-center gap-1.5 rounded-lg bg-[#17424c] px-3.5 py-2 text-[8px] font-bold text-[#f4f4e9] hover:bg-[#225661]"><Check size={12} /> Verify member</button></div>
          </div>
        </section>
        {notice && <div role="status" className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 -translate-y-0 rounded-xl bg-[#1c414b] px-4 py-3 text-[10px] font-semibold text-[#edf2e9] shadow-xl">{notice}</div>}
      </main>
    </div>
  );
}
