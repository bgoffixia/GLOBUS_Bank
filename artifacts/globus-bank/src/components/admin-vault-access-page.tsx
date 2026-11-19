import { useState, type FormEvent } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListAdminVaultAccessQueryKey,
  useGrantAdminVaultAccess,
  useListAdminVaultAccess,
  useRevokeAdminVaultAccess,
  type AdminVaultAccessRecord,
} from "@workspace/api-client-react";
import { Check, Search, ShieldCheck, X } from "lucide-react";

const panelClass =
  "rounded-[18px] border border-[#dce5e8] bg-[#fffefa] shadow-[0_4px_16px_rgba(28,53,69,.035)]";
const inputClass =
  "h-10 w-full rounded-[9px] border border-[#d8e1e3] bg-[#fffefa] px-3 text-[12px] text-[#253c4c] outline-none focus:border-[#43898a] focus:ring-2 focus:ring-[#43898a]/10";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-[9px] bg-[#173b50] px-4 py-2.5 text-[11px] font-bold text-white transition hover:bg-[#24576a] disabled:cursor-not-allowed disabled:opacity-50";
const quietButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[9px] border border-[#dbe4e5] bg-[#fffefa] px-3 py-2.5 text-[11px] font-semibold text-[#425d69] hover:bg-[#f3f7f5] disabled:opacity-50";

function dateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function sourceLabel(source: AdminVaultAccessRecord["accessSource"]) {
  if (source === "admin_grant") return "Admin-granted access";
  if (source === "paystack_subscription") return "Paid subscription";
  return "No active access";
}

function accessTone(source: AdminVaultAccessRecord["accessSource"]) {
  return source === "none"
    ? "bg-[#f2eeee] text-[#845c54]"
    : source === "admin_grant"
      ? "bg-[#e9f3ee] text-[#316b58]"
      : "bg-[#eef2f8] text-[#466383]";
}

export function AdminVaultAccessPage() {
  const { user } = useUser();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [target, setTarget] = useState<AdminVaultAccessRecord | null>(null);
  const [action, setAction] = useState<"grant" | "revoke" | null>(null);
  const [reason, setReason] = useState("");
  const [transactionPin, setTransactionPin] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const searchQuery = useListAdminVaultAccess(
    { search: submittedSearch },
    {
      query: {
        queryKey: getListAdminVaultAccessQueryKey({ search: submittedSearch }),
        enabled: submittedSearch.length >= 2,
        retry: false,
      },
    },
  );
  const grantMutation = useGrantAdminVaultAccess();
  const revokeMutation = useRevokeAdminVaultAccess();
  const mutationPending = grantMutation.isPending || revokeMutation.isPending;

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSubmittedSearch(search.trim());
  };

  const openAction = (
    record: AdminVaultAccessRecord,
    nextAction: "grant" | "revoke",
  ) => {
    setTarget(record);
    setAction(nextAction);
    setReason("");
    setTransactionPin("");
    setConfirmed(false);
    setError("");
  };

  const closeAction = () => {
    if (mutationPending) return;
    setTarget(null);
    setAction(null);
    setError("");
  };

  const submitAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target || !action) return;
    setError("");
    setMessage("");
    try {
      const variables = {
        userId: target.userId,
        data: { reason: reason.trim(), transactionPin, confirmed: true as const },
      };
      if (action === "grant") await grantMutation.mutateAsync(variables);
      else await revokeMutation.mutateAsync(variables);
      await client.invalidateQueries({
        queryKey: getListAdminVaultAccessQueryKey({ search: submittedSearch }),
      });
      setMessage(
        action === "grant"
          ? `Admin-granted Vault access was granted to ${target.email}.`
          : `The Admin-granted access for ${target.email} was revoked. Any paid subscription remains unchanged.`,
      );
      setTarget(null);
      setAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The Vault access change could not be saved.");
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#4f8888]">Customer management</p>
          <h1 className="mt-1 text-[28px] font-extrabold tracking-[-.055em] text-[#203b4c] sm:text-[34px]">Private Vault access</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-[#71858b]">
            Review paid access separately from administrator grants. Granting access does not create a payment or subscription record.
          </p>
        </div>
      </header>

      <section className={panelClass}>
        <div className="border-b border-[#e8eeeb] px-5 py-4 sm:px-6">
          <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#468383]">Find a customer</p>
          <h2 className="mt-1 text-[15px] font-bold text-[#263e4b]">Search Vault entitlement</h2>
          <p className="mt-1 text-[10px] leading-4 text-[#7c8e92]">Search by email, Customer ID, or the customer’s Clerk user identifier.</p>
        </div>
        <form onSubmit={submitSearch} className="flex flex-col gap-2 p-4 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Email, Customer ID, or user identifier</span>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a9a9b]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${inputClass} pl-9`}
              placeholder="Email, Customer ID, or user identifier"
              maxLength={100}
              autoComplete="off"
            />
          </label>
          <button className={buttonClass} disabled={search.trim().length < 2}>
            <Search size={14} /> Search
          </button>
        </form>
      </section>

      {message && <p role="status" className="rounded-xl border border-[#cfe3d7] bg-[#f0f8f2] p-3 text-[11px] text-[#356b55]">{message}</p>}
      {search.trim().length === 1 && <p className="text-[10px] text-[#829195]">Enter at least two characters to search.</p>}
      {submittedSearch.length >= 2 && (
        <section className={panelClass}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8eeeb] px-5 py-4 sm:px-6">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#468383]">Search results</p>
              <h2 className="mt-1 text-[15px] font-bold text-[#263e4b]">Matching users</h2>
            </div>
            <span className="text-[10px] text-[#899799]">Up to 25 results</span>
          </div>
          {searchQuery.isLoading ? (
            <p className="p-6 text-[11px] text-[#71858b]">Searching customer records…</p>
          ) : searchQuery.isError ? (
            <div role="alert" className="m-4 rounded-xl border border-[#f0d4cc] bg-[#fff7f3] p-4 text-[11px] text-[#9a5044]">
              Customer records could not be loaded.
              <button type="button" className="ml-2 font-bold underline" onClick={() => void searchQuery.refetch()}>Retry</button>
            </div>
          ) : searchQuery.data?.items.length ? (
            <div className="divide-y divide-[#edf0ed]">
              {searchQuery.data.items.map((record) => {
                const isSelf = record.userId === user?.id;
                const name = [record.firstName, record.lastName].filter(Boolean).join(" ") || "Globus member";
                return (
                  <article key={record.userId} className="flex flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[12px] font-bold text-[#294754]">{name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${accessTone(record.accessSource)}`}>{sourceLabel(record.accessSource)}</span>
                      </div>
                      <p className="mt-1 break-all text-[10px] text-[#71858b]">{record.email}</p>
                      <dl className="mt-3 grid gap-x-5 gap-y-2 text-[9px] sm:grid-cols-2 lg:grid-cols-3">
                        <div><dt className="font-bold uppercase tracking-wide text-[#879596]">Customer ID</dt><dd className="mt-0.5 font-mono text-[#49646e]">{record.customerId || "—"}</dd></div>
                        <div><dt className="font-bold uppercase tracking-wide text-[#879596]">User identifier</dt><dd className="mt-0.5 break-all font-mono text-[#49646e]">{record.userId}</dd></div>
                        <div><dt className="font-bold uppercase tracking-wide text-[#879596]">Paid subscription</dt><dd className="mt-0.5 text-[#49646e]">{record.subscriptionActive ? `Active${record.subscriptionExpiresAt ? ` · expires ${dateTime(record.subscriptionExpiresAt)}` : ""}` : record.subscriptionStatus.replaceAll("_", " ")}</dd></div>
                        <div><dt className="font-bold uppercase tracking-wide text-[#879596]">Admin grant</dt><dd className="mt-0.5 text-[#49646e]">{record.adminGrantActive ? `Active since ${dateTime(record.adminGrantAt)}` : "None"}</dd></div>
                        {record.adminGrantActive && <div><dt className="font-bold uppercase tracking-wide text-[#879596]">Granting administrator</dt><dd className="mt-0.5 break-all font-mono text-[#49646e]">{record.adminGrantByUserId || "—"}</dd></div>}
                        {record.adminGrantReason && <div className="sm:col-span-2"><dt className="font-bold uppercase tracking-wide text-[#879596]">Grant reason</dt><dd className="mt-0.5 break-words text-[#49646e]">{record.adminGrantReason}</dd></div>}
                      </dl>
                      {isSelf && <p className="mt-2 text-[9px] font-semibold text-[#a45247]">Self-grants and self-revocations are blocked.</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {!record.adminGrantActive ? (
                        <button type="button" disabled={isSelf} onClick={() => openAction(record, "grant")} className={buttonClass}>
                          <ShieldCheck size={14} /> Grant access
                        </button>
                      ) : (
                        <button type="button" disabled={isSelf} onClick={() => openAction(record, "revoke")} className={quietButtonClass}>
                          Revoke admin grant
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-10 text-center">
              <p className="text-[12px] font-bold text-[#3b545d]">No users found</p>
              <p className="mt-1 text-[10px] text-[#819195]">Try another email, Customer ID, or user identifier.</p>
            </div>
          )}
        </section>
      )}

      {target && action && (
        <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[#142a35]/55 p-3 backdrop-blur-[2px]">
          <section role="dialog" aria-modal="true" aria-labelledby="vault-access-action-title" className="my-auto max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-[20px] border border-[#dce5e5] bg-[#fffefa] shadow-2xl">
            <header className="flex items-center justify-between border-b border-[#e7eeeb] px-5 py-4">
              <h2 id="vault-access-action-title" className="text-[15px] font-bold text-[#263f4b]">{action === "grant" ? "Grant Private Vault access" : "Revoke Admin grant"}</h2>
              <button type="button" onClick={closeAction} aria-label="Close dialog" className="rounded-lg p-2 text-[#687d82] hover:bg-[#edf3ef]"><X size={16} /></button>
            </header>
            <form onSubmit={submitAction} className="space-y-4 p-5">
              <div className="rounded-xl bg-[#f3f7f4] p-3 text-[10px] leading-5 text-[#617b7d]">
                <strong className="block text-[#34535e]">{target.email}</strong>
                {action === "grant"
                  ? "This adds a separate admin entitlement. It does not create or modify a payment, transaction, or subscription."
                  : "This removes only the admin entitlement. Any active paid subscription remains unchanged."}
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.11em] text-[#71848b]">Reason</span>
                <textarea required minLength={5} maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-[9px] border border-[#d8e1e3] bg-[#fffefa] px-3 py-2 text-[11px] text-[#253c4c] outline-none focus:border-[#43898a]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.11em] text-[#71848b]">Administrator transaction PIN</span>
                <input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" value={transactionPin} onChange={(event) => setTransactionPin(event.target.value.replace(/\D/g, "").slice(0, 6))} className={inputClass} />
              </label>
              <label className="flex items-start gap-2 rounded-xl bg-[#f6f7f1] p-3 text-[10px] leading-4 text-[#718386]">
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)} className="mt-0.5 accent-[#438481]" />
                <span>I confirm this access change is authorized and understand it will be recorded in the audit trail.</span>
              </label>
              {error && <p role="alert" className="text-[10px] text-[#a45247]">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" disabled={mutationPending} className={quietButtonClass} onClick={closeAction}>Cancel</button>
                <button type="submit" disabled={mutationPending || transactionPin.length !== 6 || reason.trim().length < 5 || !confirmed} className={buttonClass}>
                  {mutationPending ? "Saving…" : action === "grant" ? "Confirm grant" : "Confirm revocation"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-[#dce5e8] bg-[#f8faf7] p-4 text-[10px] leading-5 text-[#708487]">
        <Check size={15} className="mt-0.5 shrink-0 text-[#4c8980]" />
        <p>Admin grants and paid subscriptions are stored separately. Revoking an admin grant never cancels, fabricates, or edits a Paystack payment.</p>
      </div>
    </div>
  );
}
