import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Check, Edit3, Plus, Search, ShieldCheck, Tag } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListAdminAccountTiersQueryKey,
  getListAdminUsersQueryKey,
  useCreateAdminAccountTier,
  useListAdminAccountTiers,
  useListAdminUsers,
  useSetAdminUserAccountTier,
  useUpdateAdminAccountTier,
} from '@workspace/api-client-react';
import type { AdminAccountTier, AdminUser, ListAdminUsersParams } from '@workspace/api-client-react';

const panel = 'rounded-[18px] border border-[#dce5e8] bg-[#fffefa] shadow-[0_4px_16px_rgba(28,53,69,.035)]';
const input = 'h-10 w-full rounded-[9px] border border-[#d8e1e3] bg-[#fffefa] px-3 text-[12px] text-[#253c4c] outline-none transition focus:border-[#43898a] focus:ring-2 focus:ring-[#43898a]/10';
const primary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] bg-[#173b50] px-4 py-2.5 text-[11px] font-bold text-white transition hover:bg-[#24576a] disabled:cursor-not-allowed disabled:opacity-50';
const quiet = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-[9px] border border-[#dbe4e5] bg-[#fffefa] px-3 py-2 text-[10px] font-semibold text-[#425d69] transition hover:bg-[#f3f7f5] disabled:opacity-50';
type TierValues = { name: string; description: string; vaultPlanCode: '' | '1m' | '3m' | '1y'; active: boolean; transactionPin: string; confirmed: boolean };
const emptyValues: TierValues = { name: '', description: '', vaultPlanCode: '', active: true, transactionPin: '', confirmed: false };
const planLabel = (code: string | null) => code ? ({ '1m': '1 month', '3m': '3 months', '1y': '1 year' }[code] || code) : 'No Vault plan mapped';
const displayName = (user: Pick<AdminUser, 'firstName' | 'lastName'>) => [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Globus member';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.11em] text-[#71848b]">{label}</span>{children}</label>;
}

function TierForm({ initial, busy, onCancel, onSubmit, error, success }: {
  initial: TierValues; busy: boolean; onCancel?: () => void; onSubmit: (values: TierValues) => Promise<void>; error: string; success?: string;
}) {
  const [values, setValues] = useState(initial);
  const [localError, setLocalError] = useState('');
  const change = <K extends keyof TierValues>(key: K, value: TierValues[K]) => setValues(current => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (values.name.trim().length < 2) return setLocalError('Tier name must contain at least two characters.');
    if (!/^\d{6}$/.test(values.transactionPin)) return setLocalError('Enter your six-digit transaction PIN.');
    if (!values.confirmed) return setLocalError('Confirm that this catalog change is intentional.');
    setLocalError('');
    await onSubmit(values);
  };
  return <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
    <Field label="Tier name"><input required minLength={2} maxLength={80} value={values.name} onChange={e => change('name', e.target.value)} className={input} /></Field>
    <Field label="Vault subscription plan mapping">
      <select value={values.vaultPlanCode} onChange={e => change('vaultPlanCode', e.target.value as TierValues['vaultPlanCode'])} className={input}>
        <option value="">No plan mapping</option><option value="1m">1 month</option><option value="3m">3 months</option><option value="1y">1 year</option>
      </select>
    </Field>
    <Field label="Description"><input maxLength={240} value={values.description} onChange={e => change('description', e.target.value)} className={input} placeholder="Optional context for this tier" /></Field>
    <label className="flex min-h-10 items-center gap-2 self-end rounded-lg border border-[#e2e9e7] bg-[#f8faf7] px-3 text-[10px] font-semibold text-[#536b70]"><input type="checkbox" checked={values.active} onChange={e => change('active', e.target.checked)} className="accent-[#43898a]" /> Tier is active</label>
    <Field label="Administrator transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={values.transactionPin} onChange={e => change('transactionPin', e.target.value.replace(/\D/g, '').slice(0, 6))} className={input} autoComplete="current-password" /></Field>
    <label className="flex items-start gap-2 text-[10px] leading-4 text-[#657a7e] sm:col-span-2"><input type="checkbox" checked={values.confirmed} onChange={e => change('confirmed', e.target.checked)} className="mt-0.5 accent-[#43898a]" /><span>I confirm this tier catalog change and its Vault plan mapping.</span></label>
    {(localError || error) && <p role="alert" className="rounded-lg bg-[#fff1ef] px-3 py-2 text-[10px] text-[#a24940] sm:col-span-2">{localError || error}</p>}
    {success && <p role="status" className="rounded-lg bg-[#edf7f1] px-3 py-2 text-[10px] text-[#39745d] sm:col-span-2">{success}</p>}
    <div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={busy} className={primary}>{busy ? 'Saving…' : 'Save tier'}</button>{onCancel && <button type="button" onClick={onCancel} className={quiet}>Cancel</button>}</div>
  </form>;
}

export function AdminAccountTiersPage() {
  const client = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminAccountTier | null>(null);
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState<AdminUser | null>(null);
  const [tierId, setTierId] = useState('');
  const [pin, setPin] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentSuccess, setAssignmentSuccess] = useState('');
  const [tierError, setTierError] = useState('');
  const [tierSuccess, setTierSuccess] = useState('');
  const [searchError, setSearchError] = useState('');
  const params: ListAdminUsersParams = useMemo(() => ({ search: search.trim(), page: 1, limit: 15 }), [search]);
  const tiers = useListAdminAccountTiers({ query: { queryKey: getListAdminAccountTiersQueryKey(), retry: false } });
  const users = useListAdminUsers(params, { query: { queryKey: getListAdminUsersQueryKey(params), enabled: search.trim().length >= 2, retry: false } });
  const createTier = useCreateAdminAccountTier();
  const updateTier = useUpdateAdminAccountTier();
  const assignTier = useSetAdminUserAccountTier();
  const refreshTiers = async () => client.invalidateQueries({ queryKey: getListAdminAccountTiersQueryKey() });
  const toInput = (values: TierValues) => ({
    name: values.name.trim(), description: values.description.trim() || null,
    vaultPlanCode: values.vaultPlanCode || null, active: values.active,
    transactionPin: values.transactionPin, confirmed: true as const,
  });
  const saveNewTier = async (values: TierValues) => {
    setTierError(''); setTierSuccess('');
    try {
      await createTier.mutateAsync({ data: toInput(values) });
      await refreshTiers();
      setTierSuccess('Tier created and catalog refreshed.');
      setShowCreate(false);
    } catch (err) { setTierError(err instanceof Error ? err.message : 'The tier could not be created.'); }
  };
  const saveTier = async (values: TierValues) => {
    if (!editing) return;
    setTierError(''); setTierSuccess('');
    try {
      await updateTier.mutateAsync({ tierId: editing.id, data: toInput(values) });
      await refreshTiers();
      setTierSuccess(`${values.name} updated.`);
      setEditing(null);
    } catch (err) { setTierError(err instanceof Error ? err.message : 'The tier could not be updated.'); }
  };
  const submitAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAssignmentError(''); setAssignmentSuccess('');
    if (!assigning || !tierId) return setAssignmentError('Choose an account tier.');
    if (!/^\d{6}$/.test(pin)) return setAssignmentError('Enter your six-digit transaction PIN.');
    if (!confirmed) return setAssignmentError('Confirm this customer assignment.');
    try {
      await assignTier.mutateAsync({ userId: assigning.id, data: { tierId, transactionPin: pin, confirmed: true } });
      await client.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
      setAssignmentSuccess(`Tier assigned to ${displayName(assigning)}.`);
      setAssigning(null); setPin(''); setConfirmed(false);
    } catch (err) { setAssignmentError(err instanceof Error ? err.message : 'The account tier could not be assigned.'); }
  };

  return <div className="space-y-5">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#4f8888]">Configuration · customer access</p><h1 className="mt-1 text-[28px] font-extrabold tracking-[-.055em] text-[#203b4c] sm:text-[34px]">Account tiers</h1><p className="mt-1 max-w-2xl text-[12px] leading-5 text-[#71858b]">Maintain the tier catalog and assign a base tier to any customer, including your own account.</p></div>
      <button type="button" onClick={() => { setShowCreate(value => !value); setTierError(''); setTierSuccess(''); }} className="inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-[#173b50] px-4 text-[11px] font-bold text-white hover:bg-[#24576a]" data-testid="button-create-tier"><Plus size={14} /> Add tier</button>
    </header>
    <aside className="flex items-start gap-3 rounded-xl border border-[#e8dfc5] bg-[#fbf8ef] p-4 text-[10px] leading-5 text-[#786e55]"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><p><strong className="text-[#6c6249]">Tier assignment is not Vault access.</strong> Private Vault remains separately controlled by a valid paid subscription or an authorized admin grant. Mapping a plan does not grant access by itself.</p></aside>
    {tierSuccess && <p role="status" className="rounded-lg border border-[#d6e9dc] bg-[#edf7f1] px-4 py-3 text-[10px] text-[#39745d]">{tierSuccess}</p>}
    {assignmentSuccess && <p role="status" className="rounded-lg border border-[#d6e9dc] bg-[#edf7f1] px-4 py-3 text-[10px] text-[#39745d]">{assignmentSuccess}</p>}
    {showCreate && <section className={`${panel} p-4 sm:p-5`}><div className="mb-4"><h2 className="text-[14px] font-bold text-[#263e4b]">Create account tier</h2><p className="mt-1 text-[10px] text-[#7c8e92]">Plan mappings are catalog metadata; entitlements are checked independently.</p></div><TierForm initial={emptyValues} busy={createTier.isPending} onSubmit={saveNewTier} error={tierError} success={tierSuccess} /></section>}
    <section className={panel}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e8eeeb] px-5 py-4 sm:px-6"><div><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#468383]">Catalog</p><h2 className="mt-1 text-[15px] font-bold text-[#263e4b]">Tier definitions</h2></div><span className="text-[10px] text-[#899799]">{tiers.data?.items.length ?? 0} tiers</span></div>
      {tiers.isLoading ? <div className="animate-pulse space-y-3 p-5">{[0,1].map(item => <div key={item} className="h-24 rounded-xl bg-[#edf2ef]" />)}</div> :
        tiers.isError ? <div className="p-5"><div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-[#f0d4cc] bg-[#fff7f3] p-4 text-[11px] text-[#9a5044]"><span>Account tiers could not be loaded.</span><button className={quiet} onClick={() => void tiers.refetch()}>Retry</button></div></div> :
          tiers.data?.items.length ? <div className="divide-y divide-[#edf1ee]">{tiers.data.items.map(tier => <article key={tier.id} className="p-4 sm:p-5" data-testid={`tier-${tier.id}`}>
             {editing?.id === tier.id ? <div><h3 className="mb-3 text-[12px] font-bold text-[#334d58]">Edit {tier.name}</h3><TierForm key={tier.id} initial={{ name: tier.name, description: tier.description ?? '', vaultPlanCode: tier.vaultPlanCode ?? '', active: tier.active, transactionPin: '', confirmed: false }} busy={updateTier.isPending} onSubmit={saveTier} onCancel={() => setEditing(null)} error={tierError} /></div> :
              <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#edf5f0] text-[#568583]"><Tag size={16} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[12px] font-bold text-[#334d58]">{tier.name}</h3><span className={`rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-[.06em] ${tier.active ? 'bg-[#e9f4ed] text-[#42735b]' : 'bg-[#edf2f2] text-[#61777c]'}`}>{tier.active ? 'Active' : 'Inactive'}</span></div><p className="mt-1 text-[10px] text-[#7c8e92]">{tier.description || 'No description'}</p><p className="mt-2 text-[9px] font-semibold text-[#527b7d]">Vault plan mapping: {planLabel(tier.vaultPlanCode)}</p></div></div><button type="button" className={quiet} onClick={() => { setEditing(tier); setTierError(''); }} data-testid={`button-edit-tier-${tier.id}`}><Edit3 size={13} /> Edit mapping</button></div>}
          </article>)}</div> : <div className="p-8 text-center"><Tag size={20} className="mx-auto text-[#7da09b]" /><p className="mt-3 text-[12px] font-bold text-[#3b545d]">No tiers defined</p><p className="mt-1 text-[10px] text-[#819195]">Create a catalog tier to start assigning base tiers to customers.</p></div>}
    </section>
    <section className={panel}>
      <div className="border-b border-[#e8eeeb] px-5 py-4 sm:px-6"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#468383]">Customer assignments</p><h2 className="mt-1 text-[15px] font-bold text-[#263e4b]">Find a customer</h2><p className="mt-1 text-[10px] text-[#7c8e92]">Search by name, email, or Customer ID. Assignment only changes the base account tier.</p></div>
      <div className="border-b border-[#e9efec] bg-[#f8f9f4] p-4"><label className="relative block max-w-2xl"><span className="sr-only">Search customers</span><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a9a9b]" /><input value={search} onChange={event => { setSearch(event.target.value); setSearchError(''); setAssigning(null); }} className={`${input} pl-9`} placeholder="Enter at least two characters" data-testid="input-tier-customer-search" /></label>{search.length > 0 && search.trim().length < 2 && <p className="mt-2 text-[10px] text-[#8a784c]">Enter at least two characters to search.</p>}{searchError && <p role="alert" className="mt-2 text-[10px] text-[#a24940]">{searchError}</p>}</div>
      {search.trim().length >= 2 && (users.isLoading ? <div className="animate-pulse space-y-3 p-5">{[0,1,2].map(item => <div key={item} className="h-14 rounded-lg bg-[#edf2ef]" />)}</div> :
        users.isError ? <div className="p-5"><div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-[#f0d4cc] bg-[#fff7f3] p-4 text-[11px] text-[#9a5044]"><span>Customer search is unavailable.</span><button className={quiet} onClick={() => void users.refetch()}>Retry</button></div></div> :
          users.data?.items.length ? <div className="divide-y divide-[#edf1ee]">{users.data.items.map(user => <article key={user.id} className="p-4 sm:px-5" data-testid={`tier-customer-${user.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-bold text-[#334d58]">{displayName(user)}</p><p className="mt-1 break-all text-[9px] text-[#829292]">{user.email} · {user.customerId || 'No Customer ID'}</p><p className="mt-1 text-[9px] text-[#527b7d]">Current base tier: {user.accountTierName || 'Unassigned'}</p></div><button type="button" className={quiet} disabled={!tiers.data?.items.some(tier => tier.active)} onClick={() => { setAssigning(user); setTierId(user.accountTierId || tiers.data?.items.find(tier => tier.active)?.id || ''); setAssignmentError(''); setAssignmentSuccess(''); }} data-testid={`button-assign-tier-${user.id}`}><Check size={13} /> Assign tier</button></div>
            {assigning?.id === user.id && <form onSubmit={submitAssignment} className="mt-4 grid gap-3 rounded-xl border border-[#e2e9e7] bg-[#f8faf7] p-4 sm:grid-cols-2">
              <Field label="Base account tier"><select required value={tierId} onChange={e => setTierId(e.target.value)} className={input}><option value="">Choose a tier</option>{(tiers.data?.items ?? []).filter(tier => tier.active).map(tier => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></Field>
              <Field label="Administrator transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className={input} autoComplete="current-password" /></Field>
              <label className="flex items-center gap-2 self-end text-[10px] leading-4 text-[#657a7e]"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="accent-[#43898a]" />I confirm this customer’s tier assignment.</label>
              {(assignmentError || assignmentSuccess) && <p role={assignmentError ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-[10px] sm:col-span-2 ${assignmentError ? 'bg-[#fff1ef] text-[#a24940]' : 'bg-[#edf7f1] text-[#39745d]'}`}>{assignmentError || assignmentSuccess}</p>}
              <div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={assignTier.isPending} className={primary}>{assignTier.isPending ? 'Assigning…' : 'Confirm assignment'}</button><button type="button" className={quiet} onClick={() => { setAssigning(null); setAssignmentError(''); }}>Cancel</button></div>
            </form>}
          </article>)}</div> : <div className="p-8 text-center"><p className="text-[12px] font-bold text-[#3b545d]">No customers found</p><p className="mt-1 text-[10px] text-[#819195]">Try a different name, email, or Customer ID.</p></div>)}
    </section>
  </div>;
}
