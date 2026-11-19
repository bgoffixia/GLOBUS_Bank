import { useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, Bell, Check, ChevronDown, ChevronRight,
  CircleAlert, Clock3, FileCheck2, Fingerprint, Landmark, LockKeyhole, Search,
  ShieldCheck, UserRound, Users, X,
} from "lucide-react";

type Member = {
  id: string; name: string; email: string; initials: string; joined: string;
  status: "Needs review" | "In review" | "Verified" | "Needs documents";
  amount: string; region: string; flag: string; score: number; docs: string; color: string;
};

const seedMembers: Member[] = [
  { id: "GL8X2FQ", name: "Avery Morgan", email: "avery.morgan@email.com", initials: "AM", joined: "Today, 09:42", status: "Needs review", amount: "$4,850.00", region: "Portland, OR", flag: "US", score: 82, docs: "2 of 3 received", color: "#d7e7d9" },
  { id: "GL6K9TW", name: "Nia Okafor", email: "nia.okafor@email.com", initials: "NO", joined: "Today, 08:17", status: "In review", amount: "$2,140.50", region: "Toronto, ON", flag: "CA", score: 94, docs: "3 of 3 received", color: "#e7ddd0" },
  { id: "GL4R3PD", name: "Leo Chen", email: "leo.chen@email.com", initials: "LC", joined: "Yesterday, 16:03", status: "Needs documents", amount: "$890.00", region: "Seattle, WA", flag: "US", score: 68, docs: "1 of 3 received", color: "#dce4e9" },
  { id: "GL2J8VA", name: "Marta Silva", email: "marta.silva@email.com", initials: "MS", joined: "Yesterday, 13:28", status: "Verified", amount: "$12,400.00", region: "Lisbon, PT", flag: "PT", score: 97, docs: "3 of 3 received", color: "#e8e1cc" },
  { id: "GL9W5BM", name: "Omar Haddad", email: "omar.haddad@email.com", initials: "OH", joined: "Jun 11, 11:06", status: "Needs review", amount: "$1,275.80", region: "Chicago, IL", flag: "US", score: 76, docs: "2 of 3 received", color: "#d8e3dc" },
];

type EventItem = { id: string; time: string; date: string; title: string; detail: string; type: "review" | "document" | "account" | "profile" | "risk"; state: string; expanded: boolean };

const eventSeeds: EventItem[] = [
  { id: "review", time: "09:38", date: "Today", title: "Identity review opened", detail: "Assigned to Alex Morgan · Manual review", type: "review", state: "In progress", expanded: true },
  { id: "passport", time: "09:34", date: "Today", title: "Passport received", detail: "Uploaded by member · US passport", type: "document", state: "Evidence · 4.2 MB", expanded: true },
  { id: "liveness", time: "09:31", date: "Today", title: "Liveness check completed", detail: "Selfie match · 98.3% confidence", type: "risk", state: "Needs your decision", expanded: true },
  { id: "transfer", time: "08:56", date: "Today", title: "Incoming transfer", detail: "First account activity · Origin: Northstar Payroll", type: "account", state: "+$380.00", expanded: false },
  { id: "profile", time: "09:42", date: "Today", title: "Member profile created", detail: "Portland, OR · Account ending 2841", type: "profile", state: "Profile event", expanded: false },
];

const statusStyle: Record<Member["status"], string> = {
  "Needs review": "bg-[#f5e9de] text-[#986d4b]",
  "In review": "bg-[#e7edf0] text-[#587583]",
  Verified: "bg-[#e5efe3] text-[#57785e]",
  "Needs documents": "bg-[#f3ecd9] text-[#947948]",
};

export default function MemberInvestigationTimeline() {
  const [members, setMembers] = useState(seedMembers);
  const [selectedId, setSelectedId] = useState(seedMembers[0].id);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All cases");
  const [events, setEvents] = useState(eventSeeds);
  const [notice, setNotice] = useState("");
  const [activeEvent, setActiveEvent] = useState("liveness");
  const [showEvidence, setShowEvidence] = useState(false);
  const selected = members.find((m) => m.id === selectedId) ?? members[0];
  const filtered = useMemo(() => members.filter((m) =>
    `${m.name} ${m.email} ${m.id}`.toLowerCase().includes(query.toLowerCase()) &&
    (filter === "All cases" || m.status === filter)), [members, query, filter]);
  const pending = members.filter((m) => m.status === "Needs review" || m.status === "In review").length;

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const decide = (status: Member["status"], message: string, eventId = activeEvent) => {
    setMembers((current) => current.map((m) => m.id === selected.id ? { ...m, status } : m));
    setEvents((current) => current.map((item) => item.id === eventId
      ? { ...item, state: status === "Verified" ? "Decision recorded · Verified" : "Follow-up requested" } : item));
    notify(message);
  };
  const toggleEvent = (id: string) => setEvents((current) =>
    current.map((item) => item.id === id ? { ...item, expanded: !item.expanded } : item));
  const chooseMember = (id: string) => {
    setSelectedId(id);
    setEvents(eventSeeds.map((event) => ({ ...event })));
    setActiveEvent("liveness");
  };

  return (
    <div className="min-h-screen bg-[#eef1e9] text-[#263f45]">
      <header className="flex h-[62px] items-center justify-between border-b border-[#dbe2d8] bg-[#f8f8f2] px-4 sm:px-7">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#173e49] text-[#dfca83]"><Landmark size={17} /></div>
          <div><p className="text-[12px] font-black tracking-[.12em]">GLOBUS</p><p className="text-[8px] font-bold tracking-[.19em] text-[#84958b]">MEMBER OPERATIONS</p></div>
          <span className="mx-2 hidden h-7 w-px bg-[#dfe5db] sm:block" />
          <p className="hidden text-[10px] text-[#7c8b84] sm:block">Casework <ChevronRight className="mx-1 inline" size={11} /> <b className="font-semibold text-[#405c59]">Investigation desk</b></p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full bg-[#e8efe5] px-3 py-1.5 text-[9px] font-bold text-[#59765f] sm:flex"><i className="h-1.5 w-1.5 rounded-full bg-[#6b9672]" /> Secure session</span>
          <button aria-label="Alerts" onClick={() => notify("You're up to date on alerts.")} className="grid h-9 w-9 place-items-center rounded-full border border-[#e1e6dd] text-[#71857c] hover:bg-white"><Bell size={15} /></button>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#d8e4dc] text-[10px] font-bold text-[#28505a]">AM</div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 sm:py-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><p className="mb-1.5 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.18em] text-[#65877c]"><ShieldCheck size={13} /> Risk & compliance / casework</p>
            <h1 className="text-[28px] font-semibold tracking-[-.045em] text-[#203c45] sm:text-[34px]">Member investigation</h1>
            <p className="mt-1 text-[11px] text-[#7d8e86]">Follow the evidence in sequence. Make each call where it belongs.</p></div>
          <div className="flex items-center gap-3 rounded-xl border border-[#dce3d9] bg-[#f8f8f2] px-3.5 py-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f2ead4] text-[#947a3d]"><Clock3 size={15} /></span>
            <div><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#8c968c]">Open workload</p><p className="mt-0.5 text-[13px] font-bold text-[#304a4e]">{pending} <span className="font-normal text-[#89958e]">need attention</span></p></div>
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[16px] border border-[#dce3d9] bg-[#fbfbf6] shadow-[0_5px_18px_rgba(40,60,49,.04)]">
            <div className="border-b border-[#e7ebe3] p-4">
              <div className="mb-3 flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#718b7f]">Case queue</p><p className="mt-1 text-[14px] font-bold">Investigations <span className="ml-1 text-[10px] font-medium text-[#94a098]">{filtered.length}</span></p></div>
                <button aria-label="Toggle review filter" onClick={() => setFilter(filter === "All cases" ? "Needs review" : "All cases")} className="rounded-lg border border-[#e3e8df] px-2.5 py-1.5 text-[9px] font-semibold text-[#6c8178] hover:bg-[#f0f3ec]">{filter === "All cases" ? "All" : "Needs review"} <ChevronDown className="ml-1 inline" size={11} /></button></div>
              <label className="flex h-9 items-center gap-2 rounded-lg border border-[#e1e6de] bg-[#f7f8f2] px-2.5 focus-within:border-[#8aa79a]"><Search size={14} className="text-[#899991]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search member or case ID" className="min-w-0 flex-1 bg-transparent text-[10px] outline-none placeholder:text-[#a2aaa1]" /></label>
            </div>
            <div className="max-h-[540px] overflow-y-auto p-2">
              {filtered.map((member) => <button key={member.id} onClick={() => chooseMember(member.id)} className={`mb-1 w-full rounded-[11px] border p-3 text-left transition-colors ${member.id === selected.id ? "border-[#c8d7c9] bg-[#edf3e9]" : "border-transparent hover:bg-[#f4f6ef]"}`}>
                <span className="flex items-start gap-2.5"><span style={{ backgroundColor: member.color }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[10px] font-bold text-[#36515a]">{member.initials}</span>
                  <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-1"><b className="truncate text-[11px] text-[#344a4e]">{member.name}</b><span className="text-[8px] text-[#9aa39a]">{member.flag}</span></span>
                    <span className="mt-1 block text-[9px] text-[#87948d]">{member.id} <span className="px-1">·</span>{member.joined}</span>
                    <span className="mt-2 flex items-center justify-between gap-2"><span className={`rounded-full px-2 py-1 text-[8px] font-semibold ${statusStyle[member.status]}`}>{member.status}</span><span className="text-[9px] font-semibold text-[#52696a]">{member.amount}</span></span>
                  </span></span></button>)}
              {filtered.length === 0 && <div className="px-4 py-12 text-center"><Search size={20} className="mx-auto mb-2 text-[#a9b4a8]" /><p className="text-[11px] font-semibold">No matching investigations</p><button onClick={() => { setQuery(""); setFilter("All cases"); }} className="mt-3 text-[9px] font-bold text-[#537a70]">Clear search and filters</button></div>}
            </div>
            <div className="border-t border-[#e7ebe3] px-4 py-3 text-[9px] text-[#8d9991]">Ordered by oldest unresolved event</div>
          </aside>

          <section className="min-w-0 overflow-hidden rounded-[16px] border border-[#dce3d9] bg-[#fbfbf6] shadow-[0_5px_18px_rgba(40,60,49,.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e7ebe3] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3"><div style={{ backgroundColor: selected.color }} className="grid h-11 w-11 place-items-center rounded-full text-[12px] font-bold text-[#36515a]">{selected.initials}</div>
                <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-[17px] font-bold tracking-[-.035em] text-[#2a4249]">{selected.name}</h2><span className={`rounded-full px-2 py-1 text-[8px] font-bold ${statusStyle[selected.status]}`}>{selected.status}</span></div><p className="mt-1 text-[10px] text-[#85938b]">{selected.email} <span className="mx-1.5">·</span><span className="font-mono">{selected.id}</span></p></div></div>
              <button onClick={() => notify("Member record opened in this review desk.")} className="flex h-8 items-center gap-1.5 rounded-lg border border-[#e2e7de] px-3 text-[9px] font-semibold text-[#526b6e] hover:bg-[#f1f4ed]">Full record <ChevronRight size={12} /></button>
            </div>

            <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_235px]">
              <div className="min-w-0">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div><p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#82948a]">Chronology · 5 events</p><h3 className="mt-1 text-[15px] font-bold text-[#334c4e]">Investigation trail</h3></div>
                  <button onClick={() => setEvents((current) => current.map((item) => ({ ...item, expanded: true })))} className="text-[9px] font-bold text-[#5b8275]">Expand all</button>
                </div>
                <div className="relative">
                  <div className="absolute bottom-7 left-[15px] top-4 w-px bg-[#dce4da]" />
                  <div className="space-y-3">
                    {events.map((event) => {
                      const Icon = event.type === "review" ? ShieldCheck : event.type === "document" ? FileCheck2 : event.type === "account" ? ArrowDownLeft : event.type === "profile" ? UserRound : Fingerprint;
                      const selectedEvent = activeEvent === event.id;
                      return <article key={event.id} className={`relative ml-0 rounded-xl border transition-colors ${selectedEvent ? "border-[#c8d8ca] bg-[#f5f8f1]" : "border-[#e5e9e0] bg-[#fbfbf7]"}`}>
                        <div className="flex items-start gap-3 p-3 sm:p-3.5">
                          <span className={`relative z-[1] mt-0.5 grid h-[31px] w-[31px] shrink-0 place-items-center rounded-full border-[3px] border-[#fbfbf6] ${selectedEvent ? "bg-[#dcebd9] text-[#537a60]" : "bg-[#edf0e9] text-[#7d8e83]"}`}><Icon size={13} /></span>
                          <button onClick={() => { setActiveEvent(event.id); toggleEvent(event.id); }} className="min-w-0 flex-1 text-left">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-[11px] font-bold text-[#435a57]">{event.title}</span><span className="rounded-full bg-[#edf0e9] px-2 py-0.5 text-[8px] font-medium text-[#788981]">{event.state}</span></div>
                            <p className="mt-1 text-[9px] text-[#87948d]">{event.detail}</p>
                          </button>
                          <span className="whitespace-nowrap pt-0.5 text-right"><b className="block text-[9px] font-semibold text-[#61756c]">{event.time}</b><small className="text-[8px] text-[#a0aaa0]">{event.date}</small></span>
                          <button aria-label={event.expanded ? "Collapse event details" : "Expand event details"} onClick={() => { setActiveEvent(event.id); toggleEvent(event.id); }} className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#89988e] hover:bg-[#eaf0e7]">{event.expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>
                        </div>
                        {event.expanded && <div className="ml-[57px] mr-3 border-t border-[#e6ebe2] pb-3 pt-3 sm:mr-4">
                          {event.id === "passport" ? <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e8eee5] text-[#698475]"><FileCheck2 size={13} /></span><div><p className="text-[9px] font-semibold text-[#536662]">Avery_Morgan_Passport.pdf</p><p className="text-[8px] text-[#99a49a]">Image quality: clear · Name matches profile</p></div></div><button onClick={() => { setShowEvidence(true); setActiveEvent(event.id); }} className="rounded-lg border border-[#dfe6dc] px-2.5 py-1.5 text-[8px] font-bold text-[#5b7b6d] hover:bg-white">Review document</button></div>
                            : event.id === "liveness" ? <><div className="mb-2 flex items-center justify-between gap-2"><div><p className="text-[9px] font-semibold text-[#536662]">Match confidence <b className="ml-1 text-[#52765b]">98.3%</b></p><p className="mt-0.5 text-[8px] text-[#99a49a]">Face present · No replay detected · Captured 09:31</p></div><span className="rounded-full bg-[#e7efe4] px-2 py-1 text-[8px] font-semibold text-[#5b7c60]">Passed checks</span></div>
                              <div className="flex flex-wrap items-center gap-2"><button onClick={() => { setActiveEvent(event.id); decide("Verified", `Liveness evidence accepted for ${selected.name}.`); }} className="flex items-center gap-1 rounded-lg bg-[#204a4d] px-3 py-2 text-[8px] font-bold text-[#f5f4ea] hover:bg-[#2a5c59]"><Check size={11} /> Accept match</button><button onClick={() => { setActiveEvent(event.id); decide("In review", `Follow-up review requested for ${selected.name}.`); }} className="flex items-center gap-1 rounded-lg border border-[#e1d8c5] bg-[#faf7ef] px-3 py-2 text-[8px] font-semibold text-[#8d754e] hover:bg-white"><CircleAlert size={11} /> Escalate for review</button></div></>
                            : event.id === "review" ? <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[9px] text-[#74857c]">Checklist <b className="ml-1 text-[#536662]">2 of 3 evidence items reviewed</b></p><button onClick={() => notify("Review assignment remains with Alex Morgan.")} className="text-[8px] font-bold text-[#5b7b6d]">View checklist <ChevronRight className="ml-1 inline" size={10} /></button></div>
                            : event.id === "transfer" ? <div className="flex items-center gap-2 text-[9px] text-[#667970]"><ArrowDownLeft size={13} className="text-[#718b77]" /> First inbound activity · Source is consistent with stated employment.</div>
                            : <div className="flex items-center gap-2 text-[9px] text-[#667970]"><LockKeyhole size={12} /> Region and account details align with submitted profile.</div>}
                        </div>}
                      </article>;
                    })}
                  </div>
                </div>
              </div>

              <aside className="space-y-3">
                <div className="rounded-xl bg-[#173e49] p-4 text-[#e6eeea]">
                  <div className="flex items-center justify-between"><p className="text-[8px] font-bold uppercase tracking-[.15em] text-[#a9c5b4]">Case snapshot</p><ShieldCheck size={15} className="text-[#d4c27e]" /></div>
                  <div className="mt-4 flex items-end justify-between"><div><p className="text-[8px] text-[#b4c7be]">Trust score</p><p className="mt-1 text-[27px] font-semibold leading-none tracking-[-.05em]">{selected.score}<span className="ml-1 text-[10px] font-medium text-[#aec1b7]">/ 100</span></p></div><span className="rounded-full bg-white/10 px-2 py-1 text-[8px] text-[#d9e3da]">Auto-assessed</span></div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div style={{ width: `${selected.score}%` }} className="h-full rounded-full bg-[#b4c994]" /></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-3"><div><p className="text-[8px] text-[#a9bdb5]">Documents</p><p className="mt-1 text-[10px] font-semibold">{selected.docs}</p></div><div><p className="text-[8px] text-[#a9bdb5]">Balance</p><p className="mt-1 text-[10px] font-semibold">{selected.amount}</p></div></div>
                </div>
                <div className="rounded-xl border border-[#e5e9e0] bg-[#f8f8f3] p-3.5">
                  <p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#87968d]">Member context</p>
                  <div className="mt-3 flex items-center gap-2.5"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e8eee5] text-[#698475]"><UserRound size={13} /></span><div><p className="text-[9px] font-semibold text-[#536662]">Joined {selected.joined}</p><p className="text-[8px] text-[#98a39a]">{selected.region} · {selected.flag}</p></div></div>
                  <div className="my-3 border-t border-[#e8ece4]" />
                  <div className="flex items-center gap-2.5"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e9edf0] text-[#6d8290]"><Users size={13} /></span><div><p className="text-[9px] font-semibold text-[#536662]">1 active account</p><p className="text-[8px] text-[#98a39a]">2 linked wallets</p></div></div>
                </div>
                <div className="flex items-start gap-2 rounded-xl border border-[#e5e9e0] bg-[#f6f7f1] p-3"><LockKeyhole size={13} className="mt-0.5 shrink-0 text-[#80938a]" /><p className="text-[8px] leading-[1.6] text-[#819089]">Every event-level decision is preserved in the audit trail.</p></div>
              </aside>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e7ebe3] bg-[#f8f8f3] px-5 py-3.5 sm:px-6">
              <p className="flex items-center gap-1.5 text-[9px] text-[#8b9890]"><Activity size={12} className="text-[#779084]" /> Decision attaches to the selected event</p>
              <div className="flex items-center gap-2"><button onClick={() => { setActiveEvent("passport"); decide("Needs documents", `Additional evidence requested from ${selected.name}.`, "passport"); }} className="rounded-lg border border-[#dfe5dc] bg-[#fbfbf7] px-3 py-2 text-[9px] font-semibold text-[#657772] hover:bg-[#f0f3ec]">Request evidence</button>
                <button onClick={() => { setActiveEvent("liveness"); decide("Verified", `${selected.name} marked verified.`, "liveness"); }} className="flex items-center gap-1.5 rounded-lg bg-[#17424c] px-3.5 py-2 text-[9px] font-bold text-[#f4f4e9] hover:bg-[#225661]"><Check size={12} /> Verify member</button></div>
            </div>
          </section>
        </div>
        {notice && <div role="status" className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[#1c414b] px-4 py-3 text-[10px] font-semibold text-[#edf2e9] shadow-xl">{notice}</div>}
        {showEvidence && <div role="dialog" aria-modal="true" aria-label="Evidence preview" className="fixed inset-0 z-40 grid place-items-center bg-[#183b40]/35 p-4" onClick={() => setShowEvidence(false)}><div className="w-full max-w-[430px] rounded-2xl border border-[#dce3d9] bg-[#fbfbf6] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#82948a]">Evidence preview</p><h3 className="mt-1 text-[16px] font-bold text-[#334c4e]">Passport · United States</h3></div><button aria-label="Close preview" onClick={() => setShowEvidence(false)} className="grid h-8 w-8 place-items-center rounded-lg text-[#73867e] hover:bg-[#edf1e9]"><X size={15} /></button></div><div className="my-4 grid min-h-[150px] place-items-center rounded-xl border border-dashed border-[#d5dfd5] bg-[#f3f5ee]"><div className="text-center"><FileCheck2 size={24} className="mx-auto mb-2 text-[#73907e]" /><p className="text-[10px] font-semibold text-[#536662]">Secure document viewer</p><p className="mt-1 text-[9px] text-[#89968e]">Avery_Morgan_Passport.pdf · 4.2 MB</p></div></div><p className="text-[9px] leading-relaxed text-[#7e8d84]">Document preview is available in the member record. This evidence was uploaded today at 09:34.</p><button onClick={() => setShowEvidence(false)} className="mt-4 w-full rounded-lg bg-[#204a4d] py-2.5 text-[9px] font-bold text-[#f5f4ea] hover:bg-[#2a5c59]">Return to timeline</button></div></div>}
      </main>
    </div>
  );
}
