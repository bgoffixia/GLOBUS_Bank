import { useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowUpRight, BadgeCheck, Bell, Check, ChevronDown,
  ChevronRight, CircleAlert, Clock3, FileCheck2, Filter, Landmark, LockKeyhole,
  MoreHorizontal, Search, ShieldCheck, SlidersHorizontal, UserRound, Users,
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

const initialMembers: Member[] = [
  { id: "GL8X2FQ", name: "Avery Morgan", email: "avery.morgan@email.com", initials: "AM", joined: "Today, 09:42", status: "Needs review", amount: "$4,850.00", region: "Portland, OR", flag: "US", score: 82, docs: "2 of 3 received", lastAction: "Passport uploaded 8 min ago", color: "#d9e8dc" },
  { id: "GL6K9TW", name: "Nia Okafor", email: "nia.okafor@email.com", initials: "NO", joined: "Today, 08:17", status: "In review", amount: "$2,140.50", region: "Toronto, ON", flag: "CA", score: 94, docs: "3 of 3 received", lastAction: "Address confirmed 21 min ago", color: "#e6dcd0" },
  { id: "GL4R3PD", name: "Leo Chen", email: "leo.chen@email.com", initials: "LC", joined: "Yesterday, 16:03", status: "Needs documents", amount: "$890.00", region: "Seattle, WA", flag: "US", score: 68, docs: "1 of 3 received", lastAction: "Proof of address requested", color: "#dce3ea" },
  { id: "GL2J8VA", name: "Marta Silva", email: "marta.silva@email.com", initials: "MS", joined: "Yesterday, 13:28", status: "Verified", amount: "$12,400.00", region: "Lisbon, PT", flag: "PT", score: 97, docs: "3 of 3 received", lastAction: "Identity verified yesterday", color: "#e6dfc9" },
  { id: "GL9W5BM", name: "Omar Haddad", email: "omar.haddad@email.com", initials: "OH", joined: "Jun 11, 11:06", status: "Needs review", amount: "$1,275.80", region: "Chicago, IL", flag: "US", score: 76, docs: "2 of 3 received", lastAction: "Selfie uploaded 1 hr ago", color: "#d8e3db" },
];

const tabs = ["Overview", "Identity", "Account activity"] as const;
type Tab = typeof tabs[number];

export default function MemberReviewDesk() {
  const [members, setMembers] = useState(initialMembers);
  const [selectedId, setSelectedId] = useState(initialMembers[0].id);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All cases");
  const [tab, setTab] = useState<Tab>("Overview");
  const [notice, setNotice] = useState("");
  const [showActions, setShowActions] = useState(false);

  const filtered = useMemo(() => members.filter((member) => {
    const matchesSearch = `${member.name} ${member.email} ${member.id}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "All cases" || member.status === filter;
    return matchesSearch && matchesFilter;
  }), [members, query, filter]);
  const selected = members.find((member) => member.id === selectedId) ?? members[0];
  const pendingCount = members.filter((member) => member.status === "Needs review" || member.status === "In review").length;

  const updateStatus = (status: Member["status"], message: string) => {
    setMembers((current) => current.map((member) => member.id === selected.id ? { ...member, status } : member));
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };

  return (
    <div className="min-h-screen bg-[#f1f3ec] text-[#253b43]">
      <header className="flex h-[65px] items-center justify-between border-b border-[#dce2d8] bg-[#f8f8f2] px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#173d4a] text-[#e0c77d]"><Landmark size={18} /></div>
          <div className="leading-none"><p className="text-[13px] font-black tracking-[.11em]">GLOBUS</p><p className="mt-1 text-[8px] font-bold tracking-[.2em] text-[#8a9a8d]">MEMBER OPERATIONS</p></div>
          <span className="mx-2 hidden h-7 w-px bg-[#dce2d8] sm:block" />
          <p className="hidden text-[11px] text-[#788782] sm:block">Casework <ChevronRight className="mx-1 inline" size={12} /> <span className="font-semibold text-[#3e5757]">Identity review</span></p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full bg-[#e9efe5] px-3 py-1.5 text-[9px] font-bold text-[#53705e] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#6c9a77]" /> Secure session</span>
          <button onClick={() => setNotice("You're all caught up on alerts.")} aria-label="Notifications" className="relative grid h-9 w-9 place-items-center rounded-full border border-[#e1e5dc] bg-[#fbfbf7] text-[#617574] hover:bg-white"><Bell size={15} /><i className="absolute right-[8px] top-[7px] h-1.5 w-1.5 rounded-full bg-[#bd765c]" /></button>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#d8e4dc] text-[10px] font-bold text-[#28505a]">AM</div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 sm:py-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.18em] text-[#64867e]"><ShieldCheck size={13} /> Risk &amp; compliance</p>
            <h1 className="text-[28px] font-semibold tracking-[-.045em] text-[#203a45] sm:text-[34px]">Identity review</h1>
            <p className="mt-1 text-[11px] text-[#788983]">A focused desk for getting member accounts ready to move.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#dce3d9] bg-[#f8f8f2] px-3.5 py-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#f3ead0] text-[#947a38]"><Clock3 size={15} /></div>
            <div><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#8c9589]">Review queue</p><p className="mt-0.5 text-[13px] font-bold text-[#304a4e]">{pendingCount} cases <span className="font-normal text-[#89958e]">need attention</span></p></div>
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-[16px] border border-[#dce3d9] bg-[#fbfbf6] shadow-[0_5px_18px_rgba(40,60,49,.04)]">
            <div className="border-b border-[#e7ebe3] p-4">
              <div className="mb-3 flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#718b7f]">Case queue</p><p className="mt-1 text-[14px] font-bold tracking-[-.02em]">Member reviews <span className="ml-1 text-[10px] font-medium text-[#94a098]">{filtered.length}</span></p></div><button onClick={() => setFilter(filter === "All cases" ? "Needs review" : "All cases")} title="Toggle queue filter" className="grid h-8 w-8 place-items-center rounded-lg border border-[#e3e8df] text-[#73867e] hover:bg-[#f0f3ec]"><SlidersHorizontal size={14} /></button></div>
              <label className="flex h-9 items-center gap-2 rounded-lg border border-[#e1e6de] bg-[#f7f8f2] px-2.5 focus-within:border-[#8aa79a]">
                <Search size={14} className="text-[#899991]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a member or ID" className="min-w-0 flex-1 bg-transparent text-[10px] outline-none placeholder:text-[#a2aaa1]" />
                <button onClick={() => setFilter(filter === "All cases" ? "Needs review" : "All cases")} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] font-semibold text-[#6d8178] hover:bg-[#e8eee6]"><Filter size={11} /><span className="hidden sm:inline">{filter === "All cases" ? "All" : "Needs review"}</span><ChevronDown size={11} /></button>
              </label>
            </div>
            <div className="max-h-[500px] overflow-y-auto p-2">
              {filtered.map((member) => {
                const isSelected = member.id === selected.id;
                return <button key={member.id} onClick={() => { setSelectedId(member.id); setTab("Overview"); setNotice(""); }} className={`mb-1 w-full rounded-[11px] border p-3 text-left transition-colors ${isSelected ? "border-[#c8d7c9] bg-[#edf3e9]" : "border-transparent hover:bg-[#f4f6ef]"}`}>
                  <div className="flex items-start gap-2.5">
                    <span style={{ backgroundColor: member.color }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[10px] font-bold text-[#36515a]">{member.initials}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-1"><span className="truncate text-[11px] font-bold text-[#344a4e]">{member.name}</span><span className="text-[8px] text-[#9aa39a]">{member.flag}</span></span>
                      <span className="mt-1 block truncate text-[9px] text-[#87948d]">{member.id} <span className="px-1">·</span> {member.joined}</span>
                      <span className="mt-2 flex items-center justify-between gap-2"><span className={`rounded-full px-2 py-1 text-[8px] font-semibold ${member.status === "Verified" ? "bg-[#e6efe4] text-[#52775a]" : member.status === "Needs documents" ? "bg-[#f4ead7] text-[#947748]" : member.status === "In review" ? "bg-[#e7edf0] text-[#557282]" : "bg-[#f4e8df] text-[#9a654e]"}`}>{member.status}</span><span className="text-[9px] font-semibold text-[#52696a]">{member.amount}</span></span>
                    </span>
                  </div>
                </button>;
              })}
              {filtered.length === 0 && <div className="px-4 py-12 text-center"><Search size={20} className="mx-auto mb-2 text-[#a9b4a8]" /><p className="text-[11px] font-semibold">No matching cases</p><p className="mt-1 text-[9px] text-[#8c9990]">Try another name or clear the filter.</p><button onClick={() => { setQuery(""); setFilter("All cases"); }} className="mt-3 text-[9px] font-bold text-[#537a70]">Clear search</button></div>}
            </div>
            <div className="flex items-center justify-between border-t border-[#e7ebe3] px-4 py-3 text-[9px] text-[#8d9991]"><span>Sorted by oldest first</span><button onClick={() => setNotice("Queue sort: oldest submission first.")} className="font-semibold text-[#56756d]">Queue rules <ChevronRight className="ml-1 inline" size={11} /></button></div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-[16px] border border-[#dce3d9] bg-[#fbfbf6] shadow-[0_5px_18px_rgba(40,60,49,.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e7ebe3] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div style={{ backgroundColor: selected.color }} className="grid h-11 w-11 place-items-center rounded-full text-[12px] font-bold text-[#36515a]">{selected.initials}</div>
                <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-[17px] font-bold tracking-[-.035em] text-[#2a4249]">{selected.name}</h2><span className="rounded-full bg-[#f3ead9] px-2 py-1 text-[8px] font-bold text-[#927345]">{selected.status}</span></div><p className="mt-1 text-[10px] text-[#85938b]">{selected.email} <span className="mx-1.5">·</span> <span className="font-mono">{selected.id}</span></p></div>
              </div>
              <div className="relative flex items-center gap-2">
                <button onClick={() => setShowActions(!showActions)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#e2e7de] text-[#76877f] hover:bg-[#f1f4ed]" aria-label="More member actions"><MoreHorizontal size={15} /></button>
                {showActions && <div className="absolute right-0 top-10 z-10 w-44 rounded-xl border border-[#dfe5dc] bg-[#fffefa] p-1.5 shadow-lg"><button onClick={() => { updateStatus("Needs documents", "Document request prepared for " + selected.name + "."); setShowActions(false); }} className="w-full rounded-lg px-2.5 py-2 text-left text-[10px] hover:bg-[#f2f4ed]">Request documents</button><button onClick={() => { setNotice("Account controls opened for " + selected.name + "."); setShowActions(false); }} className="w-full rounded-lg px-2.5 py-2 text-left text-[10px] hover:bg-[#f2f4ed]">Account controls</button></div>}
                <button onClick={() => setNotice("Member record opened in this review desk.")} className="flex h-8 items-center gap-1.5 rounded-lg border border-[#e2e7de] px-3 text-[9px] font-semibold text-[#526b6e] hover:bg-[#f1f4ed]">Full record <ChevronRight size={12} /></button>
              </div>
            </div>
            <div className="flex gap-5 border-b border-[#e7ebe3] px-5 sm:px-6">
              {tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`relative py-3 text-[10px] font-semibold ${tab === item ? "text-[#315a59]" : "text-[#8b9890] hover:text-[#526b68]"}`}>{item}{tab === item && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#668d7d]" />}</button>)}
            </div>

            {tab === "Overview" && <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_245px]">
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#82948a]">Review snapshot</p><p className="mt-1 text-[12px] font-semibold text-[#3c5557]">Ready for your decision</p></div>
                  <div className="flex items-center gap-2 rounded-lg bg-[#eef3e9] px-2.5 py-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#d8e7d6] text-[#4e7959]"><BadgeCheck size={14} /></span><span><b className="block text-[10px] text-[#496e57]">Trust score</b><small className="text-[8px] text-[#819187]">Automated · updated now</small></span><strong className="ml-2 text-[13px] text-[#42684f]">{selected.score}</strong></div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-[#e5e9e0] bg-[#f7f8f2] p-3"><div className="mb-2 flex items-center justify-between text-[#7a8e83]"><UserRound size={14} /><span className="text-[8px] uppercase tracking-[.12em]">Member since</span></div><p className="text-[11px] font-bold text-[#425958]">{selected.joined}</p></div>
                  <div className="rounded-xl border border-[#e5e9e0] bg-[#f7f8f2] p-3"><div className="mb-2 flex items-center justify-between text-[#7a8e83]"><FileCheck2 size={14} /><span className="text-[8px] uppercase tracking-[.12em]">Documents</span></div><p className="text-[11px] font-bold text-[#425958]">{selected.docs}</p></div>
                  <div className="rounded-xl border border-[#e5e9e0] bg-[#f7f8f2] p-3"><div className="mb-2 flex items-center justify-between text-[#7a8e83]"><Landmark size={14} /><span className="text-[8px] uppercase tracking-[.12em]">Location</span></div><p className="text-[11px] font-bold text-[#425958]">{selected.region}</p></div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#82948a]">Verification checklist</p><p className="mt-1 text-[10px] text-[#8d9990]">Review the submitted evidence before approval.</p></div><button onClick={() => setTab("Identity")} className="text-[9px] font-bold text-[#5b8275]">Open identity <ChevronRight className="ml-1 inline" size={11} /></button></div>
                  <div className="overflow-hidden rounded-xl border border-[#e4e9df]">
                    {[["Government ID", "Passport · United States", "Verified"], ["Proof of address", "Utility statement · May 2025", "Verified"], ["Liveness check", "Selfie match · 98.3%", "Review"]].map(([title, description, status], index) => <div key={title} className="flex items-center gap-3 border-b border-[#e9ede6] px-3 py-2.5 last:border-b-0"><span className={`grid h-7 w-7 place-items-center rounded-lg ${status === "Verified" ? "bg-[#e6efe4] text-[#5c8063]" : "bg-[#f5ecda] text-[#9a7a45]"}`}>{status === "Verified" ? <Check size={13} /> : <CircleAlert size={13} />}</span><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold text-[#465b59]">{title}</p><p className="mt-0.5 truncate text-[9px] text-[#8b9890]">{description}</p></div><span className={`text-[9px] font-semibold ${status === "Verified" ? "text-[#62836a]" : "text-[#9a7a45]"}`}>{status}</span><span className="hidden text-[8px] text-[#a0aaa0] sm:block">0{index + 1}</span></div>)}
                  </div>
                </div>
                <div className="rounded-xl border border-[#e6e9df] bg-[#f7f8f2] p-3.5">
                  <div className="mb-2 flex items-center gap-2"><Activity size={13} className="text-[#779084]" /><p className="text-[9px] font-bold uppercase tracking-[.13em] text-[#71877d]">Latest activity</p></div>
                  <div className="flex items-center justify-between gap-3"><p className="text-[10px] text-[#607471]">{selected.lastAction}</p><span className="whitespace-nowrap text-[8px] text-[#a0aaa0]">Just now</span></div>
                </div>
              </div>
              <aside className="space-y-3">
                <div className="rounded-xl bg-[#173e49] p-4 text-[#e6eeea]">
                  <p className="text-[8px] font-bold uppercase tracking-[.15em] text-[#a9c5b4]">Account at a glance</p>
                  <div className="mt-4 flex items-end justify-between"><div><p className="text-[8px] text-[#b4c7be]">Available balance</p><p className="mt-1 text-[21px] font-semibold tracking-[-.045em]">{selected.amount}</p></div><div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-[#d6c17c]"><Users size={15} /></div></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-3"><div><p className="text-[8px] text-[#a9bdb5]">Accounts</p><p className="mt-1 text-[11px] font-semibold">1 active</p></div><div><p className="text-[8px] text-[#a9bdb5]">Wallets</p><p className="mt-1 text-[11px] font-semibold">2 linked</p></div></div>
                </div>
                <div className="rounded-xl border border-[#e5e9e0] bg-[#f8f8f3] p-3.5">
                  <p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#87968d]">Recent movement</p>
                  <div className="mt-3 flex items-center gap-2.5"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#e4eee4] text-[#648368]"><ArrowDownLeft size={13} /></span><div className="min-w-0 flex-1"><p className="text-[9px] font-semibold text-[#536662]">Incoming transfer</p><p className="text-[8px] text-[#98a39a]">Today · 08:56</p></div><span className="text-[9px] font-semibold text-[#56735c]">+$380.00</span></div>
                  <div className="my-2 border-t border-[#e8ece4]" />
                  <div className="flex items-center gap-2.5"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#f1e9de] text-[#a17b59]"><ArrowUpRight size={13} /></span><div className="min-w-0 flex-1"><p className="text-[9px] font-semibold text-[#536662]">Card authorization</p><p className="text-[8px] text-[#98a39a]">Yesterday · 19:12</p></div><span className="text-[9px] font-semibold text-[#657471]">−$62.40</span></div>
                </div>
                <div className="flex items-start gap-2 rounded-xl border border-[#e5e9e0] bg-[#f6f7f1] p-3"><LockKeyhole size={13} className="mt-0.5 shrink-0 text-[#80938a]" /><p className="text-[8px] leading-[1.6] text-[#819089]">Sensitive account controls are recorded in the audit trail.</p></div>
              </aside>
            </div>}

            {tab === "Identity" && <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_245px]">
              <div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#82948a]">Identity evidence</p><h3 className="mt-1 text-[15px] font-bold text-[#334c4e]">Documents submitted by {selected.name.split(" ")[0]}</h3><p className="mt-1 text-[10px] text-[#89978f]">Check the evidence against the member profile before making a decision.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[["Government ID", "Passport · United States", "Verified", "Avery_Morgan_Passport.pdf"], ["Proof of address", "Utility statement · May 2025", "Verified", "Portland_Electric_May.pdf"], ["Liveness check", "Selfie match · 98.3%", "Review", "Live capture · 09:38"]].map(([title, description, state, filename]) => <div key={title} className="rounded-xl border border-[#e4e9df] bg-[#f8f8f3] p-4"><div className="flex items-start justify-between"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e8eee5] text-[#678274]"><FileCheck2 size={16} /></span><span className={`rounded-full px-2 py-1 text-[8px] font-bold ${state === "Verified" ? "bg-[#e6efe4] text-[#5c8063]" : "bg-[#f5ecda] text-[#9a7a45]"}`}>{state}</span></div><p className="mt-3 text-[11px] font-bold text-[#445b57]">{title}</p><p className="mt-1 text-[9px] text-[#84928a]">{description}</p><div className="mt-3 truncate rounded-lg border border-[#e6eae2] bg-[#fbfbf7] px-2.5 py-2 text-[9px] text-[#84928a]">{filename}</div><button onClick={() => setNotice(`${title} document preview opened.`)} className="mt-3 text-[9px] font-bold text-[#56796d]">Preview evidence <ChevronRight className="ml-1 inline" size={11} /></button></div>)}
                </div>
              </div>
              <aside className="rounded-xl bg-[#173e49] p-4 text-[#e6eeea]"><p className="text-[8px] font-bold uppercase tracking-[.15em] text-[#a9c5b4]">Review guidance</p><p className="mt-3 text-[12px] font-semibold">Check all evidence together.</p><p className="mt-2 text-[9px] leading-relaxed text-[#b8c9c1]">Compare the photo and name on the ID with the submitted profile. Confirm the address is recent and matches the member’s location.</p><div className="mt-4 border-t border-white/10 pt-3 text-[9px] text-[#b8c9c1]">Policy reference <button onClick={() => setNotice("Identity verification policy opened.")} className="font-semibold text-[#e1cc82]">IDV-04 <ChevronRight className="ml-1 inline" size={10} /></button></div></aside>
            </div>}

            {tab === "Account activity" && <div className="p-5 sm:p-6"><div className="mb-4"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#82948a]">Member timeline</p><h3 className="mt-1 text-[15px] font-bold text-[#334c4e]">Recent account activity</h3></div><div className="space-y-0">{[[Clock3, "Identity review started", "Assigned to Alex Morgan · Today, 09:38"], [FileCheck2, "Passport received", "Uploaded by member · Today, 09:34"], [Activity, "Incoming transfer", "$380.00 USD · Today, 08:56"], [UserRound, "Member profile created", `${selected.region} · ${selected.joined}`]].map(([Icon, title, detail], index) => { const EventIcon = Icon as typeof Activity; return <div key={String(title)} className="flex gap-3"><div className="flex flex-col items-center"><span className={`grid h-8 w-8 place-items-center rounded-full ${index === 0 ? "bg-[#e5eee3] text-[#65816a]" : "bg-[#eef0e8] text-[#7d8b82]"}`}><EventIcon size={14} /></span>{index < 3 && <span className="my-1 h-7 w-px bg-[#dfe5dc]" />}</div><div className="pt-1"><p className="text-[10px] font-semibold text-[#4d625d]">{String(title)}</p><p className="mt-1 text-[9px] text-[#89968e]">{String(detail)}</p></div></div>; })}</div></div>}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e7ebe3] bg-[#f8f8f3] px-5 py-3.5 sm:px-6">
              <p className="flex items-center gap-1.5 text-[9px] text-[#8b9890]"><ShieldCheck size={12} className="text-[#779084]" /> Decision recorded to member audit history</p>
              <div className="flex items-center gap-2">
                <button onClick={() => updateStatus("Needs documents", "Document request prepared for " + selected.name + ".")} className="rounded-lg border border-[#dfe5dc] bg-[#fbfbf7] px-3 py-2 text-[9px] font-semibold text-[#657772] hover:bg-[#f0f3ec]">Request documents</button>
                <button onClick={() => updateStatus("Verified", `${selected.name} marked verified.`)} className="flex items-center gap-1.5 rounded-lg bg-[#17424c] px-3.5 py-2 text-[9px] font-bold text-[#f4f4e9] hover:bg-[#225661]"><Check size={12} /> Verify member</button>
              </div>
            </div>
          </section>
        </div>
        {notice && <div role="status" className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-xl bg-[#1c414b] px-4 py-3 text-[10px] font-semibold text-[#edf2e9] shadow-xl">{notice}</div>}
      </main>
    </div>
  );
}
