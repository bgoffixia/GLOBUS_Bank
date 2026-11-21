import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Pencil,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import {
  getGetBankPersonalFinanceOverviewQueryKey,
  getListBankPersonalFinanceRecordsQueryKey,
  useCreateBankPersonalFinanceRecord,
  useDeleteBankPersonalFinanceRecord,
  useGetBankPersonalFinanceOverview,
  useListBankPersonalFinanceRecords,
  useUpdateBankPersonalFinanceRecord,
} from '@workspace/api-client-react';
import { Link } from 'wouter';
import type {
  BankPersonalFinanceRecord,
  CurrencyCode,
  PersonalFinanceKind,
  PersonalFinanceRecordInput,
  PersonalFinanceRecordUpdate,
} from '@workspace/api-client-react';
import './personal-finance.css';

const currencyCodes: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'NGN', 'CAD', 'AUD'];
const kinds: PersonalFinanceKind[] = ['expense', 'savings', 'investment', 'loan', 'bill'];
const labels: Record<PersonalFinanceKind, string> = {
  expense: 'Expense',
  savings: 'Savings goal',
  investment: 'Investment snapshot',
  loan: 'Loan',
  bill: 'Bill',
};
const categoryOptions: Record<PersonalFinanceKind, string[]> = {
  expense: ['Housing', 'Food', 'Transport', 'Health', 'Shopping', 'Utilities', 'Travel', 'Other'],
  savings: ['Emergency fund', 'Home', 'Travel', 'Education', 'Other'],
  investment: ['Stocks', 'Funds', 'Property', 'Retirement', 'Other'],
  loan: ['Home loan', 'Education', 'Personal', 'Vehicle', 'Other'],
  bill: ['Utilities', 'Housing', 'Insurance', 'Subscriptions', 'Other'],
};
const kindIcon = {
  expense: ArrowDownRight,
  savings: Target,
  investment: TrendingUp,
  loan: CreditCard,
  bill: CalendarDays,
};
const defaultDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function formatMinor(amountMinor: string | null | undefined, currency: CurrencyCode) {
  const minor = (amountMinor ?? '0').replace(/\D/g, '').replace(/^0+(?=\d)/, '') || '0';
  const normalized = minor.padStart(3, '0');
  const whole = normalized.slice(0, -2);
  const fraction = normalized.slice(-2);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(BigInt(whole)).map(part => part.type === 'fraction' ? fraction : part.value).join('');
  } catch {
    return `${currency} ${whole}.${fraction}`;
  }
}

function minorToInput(value: string) {
  const safe = value.replace(/^0+(?=\d)/, '');
  return `${safe.slice(0, -2) || '0'}.${safe.slice(-2).padStart(2, '0')}`;
}

function inputToMinor(value: string) {
  return amountInputToMinor(value, false);
}

function amountInputToMinor(value: string, allowZero: boolean) {
  const cleaned = value.trim().replace(/,/g, '');
  if (!/^\d{1,17}(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if ((!allowZero && minor <= 0n) || minor > 9_223_372_036_854_775_807n) return null;
  return minor.toString();
}

function recordToForm(record?: BankPersonalFinanceRecord | null): RecordForm {
  return {
    kind: record?.kind ?? 'expense',
    title: record?.title ?? '',
    category: record?.category ?? '',
    currency: record?.currency ?? 'USD',
    amount: record ? minorToInput(record.amountMinor) : '',
    targetAmount: record?.targetAmountMinor ? minorToInput(record.targetAmountMinor) : '',
    recordDate: record?.recordDate ?? defaultDate(),
    dueDate: record?.dueDate ?? '',
    frequency: record?.frequency ?? '',
    status: record?.status ?? (record?.kind === 'expense' ? 'paid' : 'active'),
    notes: record?.notes ?? '',
  };
}

type RecordForm = {
  kind: PersonalFinanceKind;
  title: string;
  category: string;
  currency: CurrencyCode;
  amount: string;
  targetAmount: string;
  recordDate: string;
  dueDate: string;
  frequency: '' | 'once' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  status: 'active' | 'paid' | 'closed';
  notes: string;
};

function toInput(form: RecordForm): PersonalFinanceRecordInput | null {
  const amountMinor = amountInputToMinor(
    form.amount,
    form.kind === 'savings' || form.kind === 'investment' || form.kind === 'loan',
  );
  const targetAmountMinor = form.targetAmount ? inputToMinor(form.targetAmount) : null;
  if (!amountMinor || (form.targetAmount && !targetAmountMinor)) return null;
  return {
    kind: form.kind,
    title: form.title.trim(),
    category: form.category.trim() || null,
    currency: form.currency,
    amountMinor,
    targetAmountMinor: form.kind === 'savings' ? targetAmountMinor : null,
    recordDate: form.recordDate,
    dueDate: (form.kind === 'bill' || form.kind === 'loan') && form.dueDate ? form.dueDate : null,
    frequency: form.kind === 'bill' || form.kind === 'loan' ? form.frequency || null : null,
    status: form.kind === 'expense' ? 'paid' : form.status,
    notes: form.notes.trim() || null,
  };
}

function invalidateFinance(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: getListBankPersonalFinanceRecordsQueryKey() });
  void client.invalidateQueries({ queryKey: getGetBankPersonalFinanceOverviewQueryKey() });
}

type FinanceRecordDialogProps = {
  record?: BankPersonalFinanceRecord | null;
  pending: boolean;
  saveError?: string;
  expenseOnly?: boolean;
  onClose: () => void;
  onSubmit: (form: RecordForm) => void;
};

function FinanceRecordDialog({ record, pending, saveError, expenseOnly, onClose, onSubmit }: FinanceRecordDialogProps) {
  const [form, setForm] = useState(() => expenseOnly ? { ...recordToForm(record), kind: 'expense' as const } : recordToForm(record));
  const [error, setError] = useState('');
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) return setError('Add a short title for this record.');
    if (!form.recordDate) return setError('Choose the date for this record.');
    if (!amountInputToMinor(form.amount, form.kind === 'savings' || form.kind === 'investment' || form.kind === 'loan')) return setError('Enter a valid amount with up to two decimal places.');
    if (form.kind === 'savings' && !inputToMinor(form.targetAmount)) return setError('Add a target amount greater than zero.');
    if (form.kind === 'bill' && !form.dueDate) return setError('Choose a due date for this bill.');
    setError('');
    onSubmit(form);
  };
  const field = (key: keyof RecordForm, value: string) => setForm(previous => ({ ...previous, [key]: value } as RecordForm));

  return (
    <div className="pf-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !pending && onClose()}>
      <section className="pf-modal" role="dialog" aria-modal="true" aria-labelledby="pf-record-dialog-title">
        <div className="flex items-start justify-between gap-4 border-b border-[#e8edf2] px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#357b83]">{record ? 'Update a saved entry' : 'Add to your workspace'}</p>
            <h2 id="pf-record-dialog-title" className="bank-display mt-1 text-[21px] font-semibold tracking-[-.04em]">{record ? 'Edit record' : 'New personal record'}</h2>
            <p className="mt-1 text-[11px] text-[#718196]">Manually maintained. This does not change your Globus wallet.</p>
          </div>
          <button type="button" aria-label="Close record form" disabled={pending} onClick={onClose} className="rounded-lg p-2 text-[#718196] hover:bg-[#f2f7f8]"><X size={17} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2">
            {!expenseOnly && (record
              ? <div><span className="pf-label">Record type</span><div className="pf-control flex items-center bg-[#f4f7fa] text-[12px]">{labels[form.kind]}</div></div>
              : <label><span className="pf-label">Record type</span><select className="pf-control" value={form.kind} onChange={e => {
                const kind = e.target.value as PersonalFinanceKind;
                setForm(previous => ({
                  ...previous,
                  kind,
                  status: kind === 'expense' ? 'paid' : 'active',
                }));
              }} aria-label="Record type">{kinds.map(kind => <option key={kind} value={kind}>{labels[kind]}</option>)}</select></label>)}
            <label><span className="pf-label">Title</span><input className="pf-control" required maxLength={80} value={form.title} onChange={e => field('title', e.target.value)} placeholder="For example, monthly groceries" /></label>
            <label><span className="pf-label">{form.kind === 'savings' ? 'Saved so far' : form.kind === 'investment' ? 'Current value' : form.kind === 'loan' ? 'Outstanding balance' : form.kind === 'bill' ? 'Bill amount' : 'Amount'}</span><input className="pf-control" required inputMode="decimal" value={form.amount} onChange={e => field('amount', e.target.value)} placeholder="0.00" aria-describedby="pf-amount-hint" /><span id="pf-amount-hint" className="mt-1 block text-[10px] text-[#82909b]">Enter the amount in {form.currency}; up to two decimal places.</span></label>
            <label><span className="pf-label">Currency</span><select className="pf-control" value={form.currency} onChange={e => field('currency', e.target.value)} aria-label="Record currency">{currencyCodes.map(currency => <option key={currency} value={currency}>{currency}</option>)}</select></label>
            <label><span className="pf-label">Category <span className="font-normal">(optional)</span></span><select className="pf-control" value={form.category} onChange={e => field('category', e.target.value)}><option value="">Choose a category</option>{categoryOptions[form.kind].map(category => <option key={category}>{category}</option>)}</select></label>
            <label><span className="pf-label">Record date</span><input className="pf-control" type="date" required value={form.recordDate} onChange={e => field('recordDate', e.target.value)} /></label>
            {form.kind === 'savings' && <label><span className="pf-label">Goal target</span><input className="pf-control" required inputMode="decimal" value={form.targetAmount} onChange={e => field('targetAmount', e.target.value)} placeholder="0.00" /></label>}
            {(form.kind === 'bill' || form.kind === 'loan') && <label><span className="pf-label">{form.kind === 'bill' ? 'Due date' : 'Next payment date'}{form.kind === 'loan' ? ' (optional)' : ''}</span><input className="pf-control" type="date" required={form.kind === 'bill'} value={form.dueDate} onChange={e => field('dueDate', e.target.value)} /></label>}
            {(form.kind === 'bill' || form.kind === 'loan') && <label><span className="pf-label">Frequency</span><select className="pf-control" value={form.frequency} onChange={e => field('frequency', e.target.value)}><option value="">Not set</option>{(['once', 'weekly', 'monthly', 'quarterly', 'yearly'] as const).map(item => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>}
            {form.kind === 'expense' ? <div><span className="pf-label">Status</span><div className="pf-control flex items-center bg-[#f4f7fa] text-[12px]">Recorded</div></div> : <label><span className="pf-label">Status</span><select className="pf-control" value={form.status} onChange={e => field('status', e.target.value)}>{form.kind === 'bill' ? <><option value="active">Unpaid</option><option value="paid">Paid</option></> : <><option value="active">Active</option><option value="closed">Closed</option></>}</select></label>}
          </div>
          <label className="block"><span className="pf-label">Notes <span className="font-normal">(optional)</span></span><textarea className="pf-control min-h-[78px] resize-y" maxLength={500} value={form.notes} onChange={e => field('notes', e.target.value)} placeholder="A note for your own reference" /></label>
          {error && <p role="alert" className="rounded-xl border border-[#efd8d3] bg-[#fff7f5] px-3 py-2.5 text-[12px] text-[#a24940]">{error}</p>}
          {saveError && <p role="alert" className="rounded-xl border border-[#efd8d3] bg-[#fff7f5] px-3 py-2.5 text-[12px] text-[#a24940]">{saveError}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#edf0f3] pt-4 min-[440px]:flex-row min-[440px]:justify-end">
            <button type="button" className="pf-button" onClick={onClose} disabled={pending}>Cancel</button>
            <button type="submit" className="pf-button pf-button-primary" disabled={pending}>{pending ? 'Saving…' : record ? 'Save changes' : 'Save record'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function PersonalFinancePage() {
  const client = useQueryClient();
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [kind, setKind] = useState<PersonalFinanceKind | ''>('');
  const [currency, setCurrency] = useState<CurrencyCode | ''>('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<BankPersonalFinanceRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const params = useMemo(() => ({ ...(kind ? { kind } : {}), ...(currency ? { currency } : {}), page, pageSize: 8 }), [kind, currency, page]);
  const recordQuery = useListBankPersonalFinanceRecords(params, { query: { queryKey: getListBankPersonalFinanceRecordsQueryKey(params), staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } });
  const overviewParams = useMemo(() => ({ period }), [period]);
  const overviewQuery = useGetBankPersonalFinanceOverview(overviewParams, { query: { queryKey: getGetBankPersonalFinanceOverviewQueryKey(overviewParams), staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } });
  const createRecord = useCreateBankPersonalFinanceRecord();
  const updateRecord = useUpdateBankPersonalFinanceRecord();
  const deleteRecord = useDeleteBankPersonalFinanceRecord();
  const pending = createRecord.isPending || updateRecord.isPending;
  const records = recordQuery.data?.records ?? [];
  const totalPages = Math.max(1, Math.ceil((recordQuery.data?.total ?? 0) / (recordQuery.data?.pageSize ?? 8)));

  const submit = (form: RecordForm) => {
    const data = toInput(form);
    if (!data) {
      setMessage({ type: 'error', text: 'Check the amount fields and try again.' });
      return;
    }
    setMessage(null);
    if (editing) {
      const body: PersonalFinanceRecordUpdate = {
        title: data.title,
        category: data.category,
        currency: data.currency,
        amountMinor: data.amountMinor,
        targetAmountMinor: data.targetAmountMinor,
        recordDate: data.recordDate,
        dueDate: data.dueDate,
        frequency: data.frequency,
        status: data.status,
        notes: data.notes,
      };
      updateRecord.mutate({ recordId: editing.id, data: body }, {
        onSuccess: () => { invalidateFinance(client); setEditing(null); setMessage({ type: 'success', text: 'Record updated.' }); },
        onError: () => setMessage({ type: 'error', text: 'The record could not be updated. Try again.' }),
      });
    } else {
      createRecord.mutate({ data }, {
        onSuccess: () => { invalidateFinance(client); setAdding(false); setPage(1); setMessage({ type: 'success', text: 'Record saved.' }); },
        onError: () => setMessage({ type: 'error', text: 'The record could not be saved. Try again.' }),
      });
    }
  };

  const removeRecord = (record: BankPersonalFinanceRecord) => {
    if (!window.confirm(`Delete “${record.title}” from your personal finance records?`)) return;
    setMessage(null);
    deleteRecord.mutate({ recordId: record.id }, {
      onSuccess: () => { invalidateFinance(client); setMessage({ type: 'success', text: 'Record deleted.' }); },
      onError: () => setMessage({ type: 'error', text: 'The record could not be deleted. Try again.' }),
    });
  };

  return (
    <div className="pfw mx-auto w-full max-w-[1260px] space-y-4 pb-5">
      <header className="flex flex-col justify-between gap-3 pt-1 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#357b83]">Your private workspace</p>
          <h1 className="bank-display mt-1 text-[clamp(25px,5vw,34px)] font-semibold leading-tight tracking-[-.055em]">Financial overview</h1>
          <p className="mt-1 max-w-[640px] text-[12px] leading-5 text-[#718196]">A clear view of the financial details you choose to keep. Every figure here is customer-entered.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button type="button" className="pf-button flex-1 sm:flex-none" onClick={() => { void recordQuery.refetch(); void overviewQuery.refetch(); }} disabled={recordQuery.isFetching || overviewQuery.isFetching} aria-label="Refresh personal finance records"><RefreshCw size={14} className={recordQuery.isFetching || overviewQuery.isFetching ? 'animate-spin' : ''} /> Refresh</button>
          <button type="button" className="pf-button pf-button-primary flex-1 sm:flex-none" onClick={() => { setEditing(null); setAdding(true); }}><Plus size={15} /> Add record</button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dfe6ec] bg-[#eef6f6] px-3 py-2.5 text-[11px] leading-4 text-[#315d6c]" role="note">
        <span><strong className="font-bold">Personal entries only.</strong> Separate from Globus wallet balances, ledger activity and transactions.</span>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[.1em]">Not live account data</span>
      </div>

      <section aria-labelledby="pf-overview-heading">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div><h2 id="pf-overview-heading" className="text-[14px] font-bold">At a glance</h2><p className="mt-0.5 text-[10px] text-[#7b8a96]">Expense range changes below; current balances stay grouped by currency.</p></div>
          <div role="group" aria-label="Expense time period" className="flex rounded-lg border border-[#dfe6ec] bg-white p-1">
            {(['month', 'quarter', 'year'] as const).map(item => <button type="button" key={item} aria-pressed={period === item} onClick={() => setPeriod(item)} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold capitalize ${period === item ? 'bg-[#173b62] text-white' : 'text-[#627887] hover:bg-[#f2f7f8]'}`}>{item}</button>)}
          </div>
        </div>
        {overviewQuery.isError ? <QueryError text="Overview totals are unavailable." retry={() => overviewQuery.refetch()} /> : overviewQuery.isLoading || overviewQuery.isFetching ? <OverviewSkeleton /> : overviewQuery.data?.currencySummaries.length ? (
          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overviewQuery.data.currencySummaries.map(summary => (
              <article key={summary.currency} className="pf-panel overflow-hidden p-3.5">
                <div className="mb-3 flex items-center justify-between"><h3 className="text-[13px] font-extrabold tracking-[.04em]">{summary.currency}</h3><span className="rounded-full bg-[#eef6f6] px-2 py-1 text-[9px] font-bold text-[#357b83]">Entered totals</span></div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                  <SummaryValue label="Expenses" value={formatMinor(summary.expensesMinor, summary.currency)} icon={ArrowDownRight} />
                  <SummaryValue label="Savings balance" value={formatMinor(summary.savingsBalanceMinor, summary.currency)} icon={Target} note={`of ${formatMinor(summary.savingsTargetMinor, summary.currency)} target`} />
                  <SummaryValue label="Investment snapshot" value={formatMinor(summary.investmentValueMinor, summary.currency)} icon={TrendingUp} />
                  <SummaryValue label="Loan balance" value={formatMinor(summary.loanBalanceMinor, summary.currency)} icon={CreditCard} />
                  <SummaryValue label="Unpaid bills" value={formatMinor(summary.unpaidBillsMinor, summary.currency)} icon={CalendarDays} />
                </div>
              </article>
            ))}
          </div>
        ) : <div className="pf-panel flex items-start gap-3 p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef6f6] text-[#357b83]"><CircleDollarSign size={18} /></span><div><p className="text-[12px] font-bold">Your overview starts with an entry</p><p className="mt-1 text-[11px] leading-5 text-[#718196]">Add expenses, savings goals, investment snapshots, loans or bills to see your own totals here.</p></div></div>}
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[1.05fr_.95fr]">
        <article className="pf-panel min-w-0 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h2 className="text-[14px] font-bold">Expense pattern</h2><p className="mt-0.5 text-[10px] text-[#7b8a96]">Saved expense records, grouped by currency.</p></div>
            <span className="rounded-lg bg-[#eef6f6] px-2.5 py-1.5 text-[10px] font-bold capitalize text-[#357b83]">{period} view</span>
          </div>
          {overviewQuery.isLoading || overviewQuery.isFetching ? <div className="mt-5 space-y-4"><div className="pf-skeleton w-full" /><div className="pf-skeleton w-[85%]" /><div className="pf-skeleton w-[68%]" /></div> : overviewQuery.isError ? <p className="mt-5 text-[11px] text-[#87939d]">Expense pattern could not be loaded.</p> : (
            <ExpensePattern trend={overviewQuery.data?.expenseTrend ?? []} categories={overviewQuery.data?.expenseCategories ?? []} />
          )}
        </article>
        <article className="pf-panel min-w-0 p-4">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-[14px] font-bold">Recently saved expenses</h2><p className="mt-0.5 text-[10px] text-[#718196]">Your latest manually entered expenses.</p></div><span className="rounded-full bg-[#eef6f6] px-2 py-1 text-[9px] font-bold text-[#357b83]">Personal</span></div>
          {overviewQuery.isLoading || overviewQuery.isFetching ? <div className="mt-4 space-y-3">{[0, 1, 2].map(row => <div key={row} className="pf-skeleton w-full" />)}</div> : overviewQuery.data?.recentExpenses.length ? <div className="mt-3">{overviewQuery.data.recentExpenses.slice(0, 5).map(record => <RecentExpense key={record.id} record={record} />)}</div> : <p className="mt-4 rounded-xl bg-[#f4f7fa] px-3 py-4 text-[11px] leading-5 text-[#718196]">No expense entries yet. Add one to begin tracking your own spending.</p>}
        </article>
      </section>

      <section className="pf-panel min-w-0 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#e8edf2] px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-[14px] font-bold">Your records</h2><p className="mt-0.5 text-[10px] text-[#7b8a96]">{recordQuery.data?.total ?? 0} saved entries · editable any time</p></div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <label className="min-w-0"><span className="sr-only">Filter records by type</span><select className="pf-control min-h-[38px] py-2 text-[11px] sm:w-[160px]" value={kind} onChange={e => { setKind(e.target.value as PersonalFinanceKind | ''); setPage(1); }} aria-label="Filter records by type"><option value="">All record types</option>{kinds.map(item => <option key={item} value={item}>{labels[item]}</option>)}</select></label>
            <label className="min-w-0"><span className="sr-only">Filter records by currency</span><select className="pf-control min-h-[38px] py-2 text-[11px] sm:w-[128px]" value={currency} onChange={e => { setCurrency(e.target.value as CurrencyCode | ''); setPage(1); }} aria-label="Filter records by currency"><option value="">All currencies</option>{currencyCodes.map(item => <option key={item}>{item}</option>)}</select></label>
          </div>
        </div>
        {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`mx-4 mt-3 rounded-xl px-3 py-2.5 text-[11px] ${message.type === 'error' ? 'border border-[#efd8d3] bg-[#fff7f5] text-[#a24940]' : 'border border-[#cfe5db] bg-[#f1f8f4] text-[#397a62]'}`}>{message.text}</p>}
        {recordQuery.isError ? <QueryError text="Your records could not be loaded." retry={() => recordQuery.refetch()} /> : recordQuery.isLoading || recordQuery.isFetching ? <RecordsSkeleton /> : records.length ? (
          <div className="px-3 pb-2 pt-1 sm:px-4">
            {records.map(record => <RecordRow key={record.id} record={record} deleting={deleteRecord.isPending && deleteRecord.variables?.recordId === record.id} onEdit={() => { setMessage(null); setEditing(record); }} onDelete={() => removeRecord(record)} />)}
            <div className="flex flex-col gap-2 border-t border-[#edf0f3] py-3 min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between">
              <p className="text-[10px] text-[#768694]">Page {page} of {totalPages} · {recordQuery.data?.total ?? 0} records</p>
              <div className="flex gap-2">
                <button type="button" className="pf-button min-h-[34px]" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1}><ChevronLeft size={14} /> Previous</button>
                <button type="button" className="pf-button min-h-[34px]" onClick={() => setPage(value => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>Next <ChevronRight size={14} /></button>
              </div>
            </div>
          </div>
        ) : <div className="px-4 py-9 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-[15px] bg-[#eef6f6] text-[#357b83]"><Wallet size={20} /></span><h3 className="mt-3 text-[13px] font-bold">{kind || currency ? 'No records match these filters' : 'A record book, on your terms'}</h3><p className="mx-auto mt-1 max-w-[360px] text-[11px] leading-5 text-[#718196]">{kind || currency ? 'Try another type or currency, or clear your filters.' : 'Keep track of the details that matter to you, separate from your bank activity.'}</p><button type="button" className="pf-button pf-button-primary mt-3" onClick={() => { setKind(''); setCurrency(''); if (!kind && !currency) setAdding(true); else setPage(1); }}><Plus size={14} /> {kind || currency ? 'Clear filters' : 'Add your first record'}</button></div>}
      </section>

      {adding && <FinanceRecordDialog pending={pending} saveError={message?.type === 'error' ? message.text : undefined} onClose={() => setAdding(false)} onSubmit={submit} />}
      {editing && <FinanceRecordDialog key={editing.id} record={editing} pending={pending} saveError={message?.type === 'error' ? message.text : undefined} onClose={() => setEditing(null)} onSubmit={submit} />}
    </div>
  );
}

export function CompactExpenseTracker() {
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BankPersonalFinanceRecord | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const params = useMemo(() => ({ kind: 'expense' as const, page: 1, pageSize: 4 }), []);
  const query = useListBankPersonalFinanceRecords(params, { query: { queryKey: getListBankPersonalFinanceRecordsQueryKey(params), staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } });
  const overviewParams = useMemo(() => ({ period: 'month' as const }), []);
  const overviewQuery = useGetBankPersonalFinanceOverview(overviewParams, { query: { queryKey: getGetBankPersonalFinanceOverviewQueryKey(overviewParams), staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } });
  const create = useCreateBankPersonalFinanceRecord();
  const update = useUpdateBankPersonalFinanceRecord();
  const remove = useDeleteBankPersonalFinanceRecord();
  const submitExpense = (form: RecordForm) => {
    const data = toInput({ ...form, kind: 'expense', status: 'paid' });
    if (!data) {
      setMessage({ type: 'error', text: 'Enter an amount greater than zero.' });
      return;
    }
    setMessage(null);
    if (editing) {
      const body: PersonalFinanceRecordUpdate = {
        title: data.title, category: data.category, currency: data.currency, amountMinor: data.amountMinor,
        targetAmountMinor: null, recordDate: data.recordDate, dueDate: null, frequency: data.frequency,
        status: data.status, notes: data.notes,
      };
      update.mutate({ recordId: editing.id, data: body }, {
        onSuccess: () => { invalidateFinance(client); setEditing(null); setMessage({ type: 'success', text: 'Expense updated.' }); },
        onError: () => setMessage({ type: 'error', text: 'Could not update this expense. Try again.' }),
      });
    } else {
      create.mutate({ data }, {
        onSuccess: () => { invalidateFinance(client); setAdding(false); setMessage({ type: 'success', text: 'Expense saved.' }); },
        onError: () => setMessage({ type: 'error', text: 'Could not save this expense. Try again.' }),
      });
    }
  };
  const expenses = query.data?.records ?? [];

  return (
    <section className="pfw pf-panel mt-3 min-w-0 overflow-hidden" aria-labelledby="dashboard-expense-tracker-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8edf2] px-3.5 py-3 sm:px-4">
        <div className="min-w-0"><div className="flex items-center gap-2"><h2 id="dashboard-expense-tracker-title" className="text-[12px] font-bold">Expense tracker</h2><span className="rounded-full bg-[#eef6f6] px-2 py-1 text-[8px] font-bold text-[#357b83]">Your entries</span></div><p className="mt-0.5 text-[9px] text-[#718196]">Saved personal expenses, not wallet activity.</p></div>
        <div className="flex shrink-0 gap-1.5"><button type="button" aria-label="Refresh saved expenses" onClick={() => { void query.refetch(); void overviewQuery.refetch(); }} disabled={query.isFetching || overviewQuery.isFetching} className="pf-button min-h-[34px] px-2.5"><RefreshCw size={13} className={query.isFetching || overviewQuery.isFetching ? 'animate-spin' : ''} /><span className="hidden min-[380px]:inline">Refresh</span></button><button type="button" onClick={() => { setEditing(null); setMessage(null); setAdding(true); }} className="pf-button pf-button-primary min-h-[34px] px-2.5"><Plus size={13} /> Add expense</button></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf0f3] bg-[#f7f9fb] px-3.5 py-2.5 sm:px-4">
        <p className="text-[9px] font-semibold text-[#788993]">This month · saved expenses</p>
        {overviewQuery.isLoading || overviewQuery.isFetching
          ? <span className="pf-skeleton w-24" aria-label="Loading monthly expense totals" />
          : overviewQuery.data?.currencySummaries.some(summary => summary.expensesMinor !== '0')
            ? <div className="flex max-w-full flex-wrap gap-1.5">
              {overviewQuery.data.currencySummaries.filter(summary => summary.expensesMinor !== '0').map(summary => (
                <span key={summary.currency} className="rounded-lg border border-[#dfe6ec] bg-white px-2 py-1 text-[9px] font-bold text-[#315d6c]">
                  {formatMinor(summary.expensesMinor, summary.currency)} · {summary.currency}
                </span>
              ))}
            </div>
            : <span className="text-[9px] text-[#87949c]">{overviewQuery.isError ? 'Monthly totals unavailable' : 'No saved expenses this month'}</span>}
      </div>
      {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`mx-3.5 mt-2 rounded-lg px-2.5 py-2 text-[10px] ${message.type === 'error' ? 'bg-[#fff7f5] text-[#a24940]' : 'bg-[#f1f8f4] text-[#397a62]'}`}>{message.text}</p>}
      {query.isError ? <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 text-[10px] text-[#a24940]"><span>Saved expenses could not be loaded.</span><button type="button" className="pf-button min-h-[32px]" onClick={() => void query.refetch()}>Try again</button></div> : query.isLoading ? <div className="space-y-3 px-4 py-4" aria-label="Loading saved expenses">{[0, 1, 2].map(row => <div key={row} className="flex gap-3"><div className="pf-skeleton h-8 w-8 rounded-xl" /><div className="flex-1 space-y-2"><div className="pf-skeleton w-2/3" /><div className="pf-skeleton w-1/3" /></div></div>)}</div> : expenses.length ? (
        <div className="grid min-w-0 grid-cols-1 gap-x-5 px-3.5 sm:grid-cols-2 sm:px-4">
          {expenses.map(record => <div key={record.id} className="pf-row flex min-w-0 items-center gap-2 py-2.5 first:border-t-0">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eef6f6] text-[#357b83]"><ArrowDownRight size={14} /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold">{record.title}</p><p className="mt-0.5 truncate text-[9px] text-[#87939c]">{record.category || 'Uncategorised'} · {record.recordDate}</p></div>
            <div className="shrink-0 text-right"><p className="text-[10px] font-bold tabular-nums">{formatMinor(record.amountMinor, record.currency)}</p><p className="text-[8px] text-[#85919a]">{record.currency}</p></div>
            <button type="button" aria-label={`Edit expense ${record.title}`} onClick={() => { setMessage(null); setEditing(record); }} className="rounded-md p-1.5 text-[#718196] hover:bg-[#eef6f6] hover:text-[#357b83]"><Pencil size={13} /></button>
            <button type="button" aria-label={`Delete expense ${record.title}`} disabled={remove.isPending && remove.variables?.recordId === record.id} onClick={() => {
              if (!window.confirm(`Delete “${record.title}” from your personal finance records?`)) return;
              setMessage(null);
              remove.mutate({ recordId: record.id }, {
                onSuccess: () => { invalidateFinance(client); setMessage({ type: 'success', text: 'Expense deleted.' }); },
                onError: () => setMessage({ type: 'error', text: 'Could not delete this expense. Try again.' }),
              });
            }} className="rounded-md p-1.5 text-[#a24940] hover:bg-[#fff7f5] hover:text-[#b64d45] disabled:opacity-40"><Trash2 size={13} /></button>
          </div>)}
        </div>
      ) : <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"><p className="text-[10px] leading-4 text-[#788893]">Your saved expenses will show here. Add one to get a useful running view.</p><button type="button" className="pf-button pf-button-primary min-h-[34px]" onClick={() => setAdding(true)}><Plus size={13} /> Add first expense</button></div>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e8edf2] px-3.5 py-2.5 sm:px-4"><span className="text-[9px] text-[#718196]">Personal records never change your Globus wallet.</span><Link href="/financial-overview" className="text-[10px] font-bold text-[#357b83] hover:text-[#285e68]">Open financial overview <ChevronRight size={12} className="inline" /></Link></div>
      {(adding || editing) && <FinanceRecordDialog key={editing?.id ?? 'new-dashboard-expense'} expenseOnly pending={create.isPending || update.isPending} saveError={message?.type === 'error' ? message.text : undefined} record={editing} onClose={() => { setAdding(false); setEditing(null); }} onSubmit={submitExpense} />}
    </section>
  );
}

function SummaryValue({ label, value, icon: Icon, note }: { label: string; value: string; icon: typeof Target; note?: string }) {
  return <div className="min-w-0"><div className="flex items-center gap-1.5 text-[#82909a]"><Icon size={12} /><span className="truncate text-[9px] font-semibold">{label}</span></div><p className="pf-stat-value mt-1 text-[13px] font-bold leading-5">{value}</p>{note && <p className="mt-0.5 truncate text-[9px] text-[#89959e]">{note}</p>}</div>;
}

function ExpensePattern({ trend, categories }: { trend: { period: string; currency: CurrencyCode; amountMinor: string }[]; categories: { category: string; currency: CurrencyCode; amountMinor: string }[] }) {
  const currencies = [...new Set([...trend.map(point => point.currency), ...categories.map(item => item.currency)])];
  if (!currencies.length) return <p className="mt-5 rounded-xl bg-[#f4f7fa] px-3 py-4 text-[11px] leading-5 text-[#718196]">Expense trends and categories will appear after you save an expense.</p>;
  return <div className="mt-4 space-y-4">{currencies.map(code => {
    const points = trend.filter(point => point.currency === code).slice(-8);
    const maxAmount = Math.max(1, ...points.map(point => Number(point.amountMinor)));
    const cats = categories.filter(item => item.currency === code).sort((a, b) => Number(b.amountMinor) - Number(a.amountMinor)).slice(0, 4);
    return <div key={code} className="rounded-xl border border-[#e8edf2] px-3 py-3">
      <div className="mb-3 flex items-center justify-between"><span className="text-[11px] font-extrabold">{code}</span><span className="text-[9px] text-[#8b989f]">No currency conversion</span></div>
      {points.length ? <div className="space-y-2">{points.map((point, index) => <div key={`${point.period}-${index}`} className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2"><span className="text-[9px] text-[#7d8b96]">{point.period.slice(-5)}</span><div className="pf-trend-track"><div className="pf-trend-fill" style={{ width: `${Math.max(3, Number(point.amountMinor) / maxAmount * 100)}%` }} /></div><span className="text-right text-[9px] font-semibold tabular-nums">{formatMinor(point.amountMinor, code)}</span></div>)}</div> : <p className="text-[10px] text-[#85929b]">No trend points for this currency yet.</p>}
      {!!cats.length && <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-[#edf0f3] pt-2.5">{cats.map(item => <span key={`${code}-${item.category}`} className="inline-flex min-w-0 items-center gap-1.5 text-[9px] text-[#667b87]"><i className="pf-category-dot" />{item.category}<b className="font-bold text-[#35566a]">{formatMinor(item.amountMinor, code)}</b></span>)}</div>}
    </div>;
  })}</div>;
}

function RecentExpense({ record }: { record: BankPersonalFinanceRecord }) {
  return <div className="pf-row flex min-w-0 items-center gap-3 py-2.5 first:border-t-0"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#eef6f6] text-[#357b83]"><ArrowDownRight size={15} /></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold">{record.title}</p><p className="mt-0.5 truncate text-[9px] text-[#718196]">{record.category || 'Uncategorised'} · {record.recordDate}</p></div><p className="shrink-0 text-right text-[11px] font-bold tabular-nums">{formatMinor(record.amountMinor, record.currency)}<span className="mt-0.5 block text-[9px] font-medium text-[#718196]">{record.currency}</span></p></div>;
}

function RecordRow({ record, deleting, onEdit, onDelete }: { record: BankPersonalFinanceRecord; deleting: boolean; onEdit: () => void; onDelete: () => void }) {
  const Icon = kindIcon[record.kind];
  const statusTone = record.status === 'active' ? 'bg-[#eef6f0] text-[#397a62]' : record.status === 'paid' ? 'bg-[#edf3f7] text-[#557188]' : 'bg-[#fbf8ee] text-[#806b3d]';
  return <article className="pf-record-card pf-row flex min-w-0 items-center gap-2.5 py-3">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef6f6] text-[#357b83]"><Icon size={16} /></span>
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><h3 className="max-w-full truncate text-[12px] font-bold">{record.title}</h3><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold capitalize ${statusTone}`}>{record.status}</span></div>
      <p className="mt-1 truncate text-[10px] text-[#7e8c97]">{labels[record.kind]}{record.category ? ` · ${record.category}` : ''} · {record.recordDate}{record.dueDate ? ` · due ${record.dueDate}` : ''}</p>
    </div>
    <div className="shrink-0 text-right"><p className="text-[12px] font-bold tabular-nums">{formatMinor(record.amountMinor, record.currency)}</p><p className="mt-0.5 text-[9px] text-[#87949d]">{record.currency}</p></div>
    <div className="flex shrink-0 gap-0.5">
      <button type="button" aria-label={`Edit ${record.title}`} onClick={onEdit} className="rounded-lg p-2 text-[#718196] hover:bg-[#eef6f6] hover:text-[#357b83]"><Pencil size={14} /></button>
      <button type="button" aria-label={`Delete ${record.title}`} onClick={onDelete} disabled={deleting} className="rounded-lg p-2 text-[#a24940] hover:bg-[#fff7f5] hover:text-[#b64d45] disabled:opacity-40"><Trash2 size={14} /></button>
    </div>
  </article>;
}

function QueryError({ text, retry }: { text: string; retry: () => void }) {
  return <div role="alert" className="mx-4 my-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#efcfca] bg-[#fff7f4] px-3 py-3 text-[11px] text-[#99574e]"><span>{text}</span><button type="button" onClick={retry} className="pf-button min-h-[34px]">Try again</button></div>;
}

function OverviewSkeleton() {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(card => <div className="pf-panel space-y-4 p-4" key={card}><div className="pf-skeleton w-1/3" /><div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map(item => <div key={item} className="space-y-2"><div className="pf-skeleton w-2/3" /><div className="pf-skeleton w-full" /></div>)}</div></div>)}</div>;
}

function RecordsSkeleton() {
  return <div className="space-y-3 px-4 py-4" aria-label="Loading personal finance records">{[0, 1, 2, 3].map(item => <div key={item} className="flex items-center gap-3"><div className="pf-skeleton h-9 w-9 rounded-xl" /><div className="flex-1 space-y-2"><div className="pf-skeleton w-2/3" /><div className="pf-skeleton w-1/3" /></div><div className="pf-skeleton w-16" /></div>)}</div>;
}
