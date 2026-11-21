import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Landmark,
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
  getGetBankFinanceReportQueryKey,
  getListBankFinancialAccountsQueryKey,
  getListBankFinanceLoanApplicationsQueryKey,
  getListBankPersonalFinanceRecordsQueryKey,
  useCreateBankFinancialAccount,
  useCreateBankFinanceLoanApplication,
  useCreateBankPersonalFinanceRecord,
  useDeleteBankPersonalFinanceRecord,
  useGetBankFinanceReport,
  useGetBankPersonalFinanceOverview,
  useListBankFinancialAccounts,
  useListBankFinanceLoanApplications,
  useListBankPersonalFinanceRecords,
  useUpdateBankPersonalFinanceRecord,
  useUpdateBankFinancialAccount,
  useWithdrawBankFinanceLoanApplication,
} from '@workspace/api-client-react';
import { Link } from 'wouter';
import type {
  BankPersonalFinanceRecord,
  BankFinancialAccount,
  BankFinanceLoanApplication,
  CurrencyCode,
  FinancialAccountInput,
  FinancialAccountUpdate,
  FinanceLoanApplicationInput,
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

function formatSignedMinor(amountMinor: string, currency: CurrencyCode) {
  const negative = amountMinor.startsWith('-');
  const display = formatMinor(negative ? amountMinor.slice(1) : amountMinor, currency);
  return negative ? `−${display}` : display;
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
  void client.invalidateQueries({ queryKey: getGetBankFinanceReportQueryKey({ period: 'month' }) });
  void client.invalidateQueries({ queryKey: getGetBankFinanceReportQueryKey({ period: 'quarter' }) });
  void client.invalidateQueries({ queryKey: getGetBankFinanceReportQueryKey({ period: 'year' }) });
}

function invalidateWorkspace(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: getListBankFinancialAccountsQueryKey() });
  void client.invalidateQueries({ queryKey: getListBankFinanceLoanApplicationsQueryKey() });
  invalidateFinance(client);
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
           <button data-testid="button-close-record-dialog" type="button" aria-label="Close record form" disabled={pending} onClick={onClose} className="rounded-lg p-2 text-[#718196] hover:bg-[#f2f7f8]"><X size={17} /></button>
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
             <label><span className="pf-label">Title</span><input data-testid="input-record-title" className="pf-control" required maxLength={80} value={form.title} onChange={e => field('title', e.target.value)} placeholder="For example, monthly groceries" /></label>
             <label><span className="pf-label">{form.kind === 'savings' ? 'Saved so far' : form.kind === 'investment' ? 'Current value' : form.kind === 'loan' ? 'Outstanding balance' : form.kind === 'bill' ? 'Bill amount' : 'Amount'}</span><input data-testid="input-record-amount" className="pf-control" required inputMode="decimal" value={form.amount} onChange={e => field('amount', e.target.value)} placeholder="0.00" aria-describedby="pf-amount-hint" /><span id="pf-amount-hint" className="mt-1 block text-[10px] text-[#82909b]">Enter the amount in {form.currency}; up to two decimal places.</span></label>
             <label><span className="pf-label">Currency</span><select data-testid="select-record-currency" className="pf-control" value={form.currency} onChange={e => field('currency', e.target.value)} aria-label="Record currency">{currencyCodes.map(currency => <option key={currency} value={currency}>{currency}</option>)}</select></label>
            <label><span className="pf-label">Category <span className="font-normal">(optional)</span></span><select className="pf-control" value={form.category} onChange={e => field('category', e.target.value)}><option value="">Choose a category</option>{categoryOptions[form.kind].map(category => <option key={category}>{category}</option>)}</select></label>
             <label><span className="pf-label">Record date</span><input data-testid="input-record-date" className="pf-control" type="date" required value={form.recordDate} onChange={e => field('recordDate', e.target.value)} /></label>
            {form.kind === 'savings' && <label><span className="pf-label">Goal target</span><input className="pf-control" required inputMode="decimal" value={form.targetAmount} onChange={e => field('targetAmount', e.target.value)} placeholder="0.00" /></label>}
            {(form.kind === 'bill' || form.kind === 'loan') && <label><span className="pf-label">{form.kind === 'bill' ? 'Due date' : 'Next payment date'}{form.kind === 'loan' ? ' (optional)' : ''}</span><input className="pf-control" type="date" required={form.kind === 'bill'} value={form.dueDate} onChange={e => field('dueDate', e.target.value)} /></label>}
            {(form.kind === 'bill' || form.kind === 'loan') && <label><span className="pf-label">Frequency</span><select className="pf-control" value={form.frequency} onChange={e => field('frequency', e.target.value)}><option value="">Not set</option>{(['once', 'weekly', 'monthly', 'quarterly', 'yearly'] as const).map(item => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>}
             {form.kind === 'expense' ? <div><span className="pf-label">Status</span><div className="pf-control flex items-center bg-[#f4f7fa] text-[12px]">Recorded</div></div> : <label><span className="pf-label">Status</span><select className="pf-control" value={form.status} onChange={e => field('status', e.target.value)}>{form.kind === 'bill' ? <><option value="active">Unpaid</option><option value="paid">Recorded paid</option></> : <><option value="active">Active</option><option value="closed">Closed</option></>}</select></label>}
          </div>
           {form.kind === 'bill' && <p className="rounded-lg bg-[#f5f8f8] px-3 py-2 text-[10px] leading-4 text-[#718196]">Paid means you recorded it as paid. It does not confirm external settlement.</p>}
          <label className="block"><span className="pf-label">Notes <span className="font-normal">(optional)</span></span><textarea className="pf-control min-h-[78px] resize-y" maxLength={500} value={form.notes} onChange={e => field('notes', e.target.value)} placeholder="A note for your own reference" /></label>
          {error && <p role="alert" className="rounded-xl border border-[#efd8d3] bg-[#fff7f5] px-3 py-2.5 text-[12px] text-[#a24940]">{error}</p>}
          {saveError && <p role="alert" className="rounded-xl border border-[#efd8d3] bg-[#fff7f5] px-3 py-2.5 text-[12px] text-[#a24940]">{saveError}</p>}
           <div className="flex flex-col-reverse gap-2 border-t border-[#edf0f3] pt-4 min-[440px]:flex-row min-[440px]:justify-end">
             <button data-testid="button-cancel-record" type="button" className="pf-button" onClick={onClose} disabled={pending}>Cancel</button>
             <button data-testid="button-save-record" type="submit" className="pf-button pf-button-primary" disabled={pending}>{pending ? 'Saving…' : record ? 'Save changes' : 'Save record'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function FinancialAccountDialog({ account, pending, onClose, onSave }: {
  account?: BankFinancialAccount | null;
  pending: boolean;
  onClose: () => void;
  onSave: (data: FinancialAccountInput | FinancialAccountUpdate) => void;
}) {
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<'savings' | 'investment'>(account?.type ?? 'savings');
  const [currency, setCurrency] = useState<CurrencyCode>(account?.currency ?? 'USD');
  const [amount, setAmount] = useState(account ? minorToInput(account.currentValueMinor) : '0.00');
  const [target, setTarget] = useState(account?.targetAmountMinor ? minorToInput(account.targetAmountMinor) : '');
  const [openedOn, setOpenedOn] = useState(account?.openedOn ?? defaultDate());
  const [notes, setNotes] = useState(account?.notes ?? '');
  const [status, setStatus] = useState<'active' | 'closed'>(account?.status ?? 'active');
  const [error, setError] = useState('');
  return <div className="pf-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !pending && onClose()}>
    <section className="pf-modal" role="dialog" aria-modal="true" aria-labelledby="pf-account-title">
      <div className="flex items-start justify-between border-b border-[#e8edf2] px-5 py-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#357b83]">Personal tracker</p><h2 id="pf-account-title" className="bank-display mt-1 text-[20px] font-semibold">{account ? 'Edit tracker' : 'Add a tracker'}</h2><p className="mt-1 text-[11px] text-[#718196]">A record you maintain—not an external account or investment.</p></div>
        <button data-testid="button-close-account-dialog" type="button" onClick={onClose} disabled={pending} aria-label="Close tracker form" className="rounded-lg p-2 text-[#718196]"><X size={17} /></button>
      </div>
      <form className="space-y-3 px-5 py-4" onSubmit={event => {
        event.preventDefault();
        const currentValueMinor = amountInputToMinor(amount, true);
        const targetAmountMinor = type === 'savings' && target ? amountInputToMinor(target, false) : null;
        if (!name.trim() || !openedOn || !currentValueMinor || (type === 'savings' && target && !targetAmountMinor)) { setError('Check the name, date and amount fields.'); return; }
        setError('');
        if (account) onSave({ name: name.trim(), currentValueMinor, targetAmountMinor, notes: notes.trim() || null, status });
        else onSave({ type, name: name.trim(), currency, currentValueMinor, ...(type === 'savings' ? { targetAmountMinor } : {}), openedOn, notes: notes.trim() || null });
      }}>
        {!account && <div className="grid grid-cols-2 gap-3"><label><span className="pf-label">Tracker type</span><select data-testid="select-account-type" className="pf-control" value={type} onChange={event => { const nextType = event.target.value as 'savings' | 'investment'; setType(nextType); if (nextType === 'investment') setTarget(''); }}><option value="savings">Savings</option><option value="investment">Investment snapshot</option></select></label><label><span className="pf-label">Currency</span><select data-testid="select-account-currency" className="pf-control" value={currency} onChange={event => setCurrency(event.target.value as CurrencyCode)}>{currencyCodes.map(code => <option key={code}>{code}</option>)}</select></label></div>}
        <label className="block"><span className="pf-label">Name</span><input data-testid="input-account-name" className="pf-control" maxLength={80} required value={name} onChange={event => setName(event.target.value)} placeholder="Emergency fund" /></label>
        <div className="grid grid-cols-2 gap-3"><label><span className="pf-label">Current value</span><input data-testid="input-account-value" className="pf-control" inputMode="decimal" required value={amount} onChange={event => setAmount(event.target.value)} /></label>{type === 'savings' && <label><span className="pf-label">Target <span className="font-normal">(optional)</span></span><input data-testid="input-account-target" className="pf-control" inputMode="decimal" value={target} onChange={event => setTarget(event.target.value)} placeholder="0.00" /></label>}</div>
        {!account && <label className="block"><span className="pf-label">Started on</span><input data-testid="input-account-date" className="pf-control" type="date" required value={openedOn} onChange={event => setOpenedOn(event.target.value)} /></label>}
        {account && <label className="block"><span className="pf-label">Status</span><select data-testid="select-account-status" className="pf-control" value={status} onChange={event => setStatus(event.target.value as 'active' | 'closed')}><option value="active">Active</option><option value="closed">Closed</option></select></label>}
        <label className="block"><span className="pf-label">Notes <span className="font-normal">(optional)</span></span><textarea data-testid="input-account-notes" className="pf-control min-h-[68px]" maxLength={500} value={notes} onChange={event => setNotes(event.target.value)} /></label>
        {error && <p role="alert" className="text-[11px] text-[#a24940]">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-[#edf0f3] pt-3"><button type="button" data-testid="button-cancel-account" className="pf-button" onClick={onClose}>Cancel</button><button data-testid="button-save-account" type="submit" className="pf-button pf-button-primary" disabled={pending}>{pending ? 'Saving…' : account ? 'Save tracker' : 'Add tracker'}</button></div>
      </form>
    </section>
  </div>;
}

function LoanRequestDialog({ pending, onClose, onSave }: { pending: boolean; onClose: () => void; onSave: (data: FinanceLoanApplicationInput) => void }) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [purpose, setPurpose] = useState('');
  const [term, setTerm] = useState('12');
  const [error, setError] = useState('');
  return <div className="pf-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !pending && onClose()}>
    <section className="pf-modal" role="dialog" aria-modal="true" aria-labelledby="pf-loan-title">
      <div className="flex items-start justify-between border-b border-[#e8edf2] px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#357b83]">Request record</p><h2 id="pf-loan-title" className="bank-display mt-1 text-[20px] font-semibold">Submit a loan request</h2><p className="mt-1 text-[11px] text-[#718196]">A request only. It is not approval or a disbursement.</p></div><button data-testid="button-close-loan-dialog" type="button" onClick={onClose} aria-label="Close loan request" className="rounded-lg p-2 text-[#718196]"><X size={17} /></button></div>
      <form className="space-y-3 px-5 py-4" onSubmit={event => { event.preventDefault(); const requestedAmountMinor = inputToMinor(amount); const termMonths = Number(term); if (!requestedAmountMinor || !purpose.trim() || !Number.isInteger(termMonths) || termMonths < 1 || termMonths > 600) { setError('Enter a valid amount, purpose and term.'); return; } onSave({ requestedAmountMinor, currency, purpose: purpose.trim(), termMonths }); }}>
        <div className="grid grid-cols-2 gap-3"><label><span className="pf-label">Amount</span><input data-testid="input-loan-amount" className="pf-control" required inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" /></label><label><span className="pf-label">Currency</span><select data-testid="select-loan-currency" className="pf-control" value={currency} onChange={event => setCurrency(event.target.value as CurrencyCode)}>{currencyCodes.map(code => <option key={code}>{code}</option>)}</select></label></div>
        <label className="block"><span className="pf-label">Purpose</span><input data-testid="input-loan-purpose" className="pf-control" required maxLength={160} value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="Home improvement" /></label>
        <label className="block"><span className="pf-label">Requested term in months</span><input data-testid="input-loan-term" className="pf-control" type="number" min="1" max="600" required value={term} onChange={event => setTerm(event.target.value)} /></label>
        {error && <p role="alert" className="text-[11px] text-[#a24940]">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-[#edf0f3] pt-3"><button type="button" data-testid="button-cancel-loan" className="pf-button" onClick={onClose}>Cancel</button><button data-testid="button-submit-loan" type="submit" className="pf-button pf-button-primary" disabled={pending}>{pending ? 'Submitting…' : 'Submit request'}</button></div>
      </form>
    </section>
  </div>;
}

export function PersonalFinancePage() {
  const client = useQueryClient();
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [kind, setKind] = useState<PersonalFinanceKind | ''>('');
  const [currency, setCurrency] = useState<CurrencyCode | ''>('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<BankPersonalFinanceRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankFinancialAccount | null>(null);
  const [addingAccount, setAddingAccount] = useState(false);
  const [addingLoan, setAddingLoan] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const params = useMemo(() => ({ ...(kind ? { kind } : {}), ...(currency ? { currency } : {}), page, pageSize: 8 }), [kind, currency, page]);
  const recordQuery = useListBankPersonalFinanceRecords(params, { query: { queryKey: getListBankPersonalFinanceRecordsQueryKey(params), staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } });
  const overviewParams = useMemo(() => ({ period }), [period]);
  const overviewQuery = useGetBankPersonalFinanceOverview(overviewParams, { query: { queryKey: getGetBankPersonalFinanceOverviewQueryKey(overviewParams), staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } });
  const reportParams = useMemo(() => ({ period }), [period]);
  const reportQuery = useGetBankFinanceReport(reportParams, { query: { queryKey: getGetBankFinanceReportQueryKey(reportParams), staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } });
  const accountsQuery = useListBankFinancialAccounts({ query: { queryKey: getListBankFinancialAccountsQueryKey(), staleTime: 5 * 60 * 1000 } });
  const loansQuery = useListBankFinanceLoanApplications({ query: { queryKey: getListBankFinanceLoanApplicationsQueryKey(), staleTime: 5 * 60 * 1000 } });
  const createRecord = useCreateBankPersonalFinanceRecord();
  const updateRecord = useUpdateBankPersonalFinanceRecord();
  const deleteRecord = useDeleteBankPersonalFinanceRecord();
  const createAccount = useCreateBankFinancialAccount();
  const updateAccount = useUpdateBankFinancialAccount();
  const createLoan = useCreateBankFinanceLoanApplication();
  const withdrawLoan = useWithdrawBankFinanceLoanApplication();
  const pending = createRecord.isPending || updateRecord.isPending;
  const financeBusy = createAccount.isPending || updateAccount.isPending || createLoan.isPending || withdrawLoan.isPending;
  const accounts = accountsQuery.data ?? [];
  const loanApplications = loansQuery.data ?? [];
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

  const saveAccount = (data: FinancialAccountInput | FinancialAccountUpdate) => {
    setMessage(null);
    if (editingAccount) {
      updateAccount.mutate({ accountId: editingAccount.id, data: data as FinancialAccountUpdate }, {
        onSuccess: () => { invalidateWorkspace(client); setEditingAccount(null); setMessage({ type: 'success', text: 'Tracker updated.' }); },
        onError: () => setMessage({ type: 'error', text: 'The tracker could not be updated. Try again.' }),
      });
    } else {
      createAccount.mutate({ data: data as FinancialAccountInput }, {
        onSuccess: () => { invalidateWorkspace(client); setAddingAccount(false); setMessage({ type: 'success', text: 'Tracker saved.' }); },
        onError: () => setMessage({ type: 'error', text: 'The tracker could not be saved. Try again.' }),
      });
    }
  };
  const submitLoan = (data: FinanceLoanApplicationInput) => createLoan.mutate({ data }, {
    onSuccess: () => { invalidateWorkspace(client); setAddingLoan(false); setMessage({ type: 'success', text: 'Loan request submitted for review.' }); },
    onError: () => setMessage({ type: 'error', text: 'The request could not be submitted. Try again.' }),
  });

  return (
    <div className="pfw mx-auto w-full max-w-[1260px] space-y-4 pb-5">
      <header className="flex flex-col justify-between gap-3 pt-1 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#357b83]">Your private workspace</p>
          <h1 className="bank-display mt-1 text-[clamp(25px,5vw,34px)] font-semibold leading-tight tracking-[-.055em]">Financial overview</h1>
          <p className="mt-1 max-w-[640px] text-[12px] leading-5 text-[#718196]">Review Globus account activity alongside the personal records you maintain—kept clearly separate.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button data-testid="button-refresh-finance" type="button" className="pf-button flex-1 sm:flex-none" onClick={() => { void recordQuery.refetch(); void overviewQuery.refetch(); void reportQuery.refetch(); void accountsQuery.refetch(); void loansQuery.refetch(); }} disabled={recordQuery.isFetching || overviewQuery.isFetching || reportQuery.isFetching || accountsQuery.isFetching || loansQuery.isFetching} aria-label="Refresh finance workspace"><RefreshCw size={14} /> Refresh</button>
          <button data-testid="button-add-finance-record" type="button" className="pf-button pf-button-primary flex-1 sm:flex-none" onClick={() => { setEditing(null); setAdding(true); }}><Plus size={15} /> Add record</button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dfe6ec] bg-[#eef6f6] px-3 py-2.5 text-[11px] leading-4 text-[#315d6c]" role="note">
        <span><strong className="font-bold">Personal entries only.</strong> Separate from Globus wallet balances, ledger activity and transactions.</span>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[.1em]">Not live account data</span>
      </div>

      <section aria-labelledby="pf-overview-heading">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div><h2 id="pf-overview-heading" className="text-[14px] font-bold">At a glance</h2><p className="mt-0.5 text-[10px] text-[#7b8a96]">Expense range changes below; current balances stay grouped by currency.</p></div>
          <div role="group" aria-label="Finance report period" className="flex rounded-lg border border-[#dfe6ec] bg-white p-1">
            {(['month', 'quarter', 'year'] as const).map(item => <button data-testid={`button-finance-period-${item}`} type="button" key={item} aria-pressed={period === item} onClick={() => setPeriod(item)} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold capitalize ${period === item ? 'bg-[#173b62] text-white' : 'text-[#627887] hover:bg-[#f2f7f8]'}`}>{item}</button>)}
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

      <section className="pf-panel min-w-0 overflow-hidden" aria-labelledby="pf-ledger-title" data-testid="finance-ledger-report">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e8edf2] px-4 py-3">
          <div><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#eaf3f2] text-[#357b83]"><Landmark size={16} /></span><h2 id="pf-ledger-title" className="text-[14px] font-bold">Globus account activity</h2></div><p className="mt-1 text-[10px] leading-4 text-[#718196]">Internal Globus ledger activity. Not verified outside income or spending.</p></div>
          <span className="rounded-full bg-[#eef6f6] px-2.5 py-1 text-[9px] font-bold capitalize text-[#357b83]">{period} · in-app</span>
        </div>
        {reportQuery.isError ? <QueryError text="Globus activity is unavailable." retry={() => reportQuery.refetch()} /> : reportQuery.isLoading ? <div className="grid gap-3 p-4 sm:grid-cols-2">{[0,1].map(i => <div key={i} className="pf-skeleton h-20" />)}</div> : <>
          <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {(reportQuery.data?.ledgerSummaries ?? []).map(summary => <article data-testid={`ledger-summary-${summary.currency}-${summary.walletId.slice(-4)}`} key={summary.walletId} className="rounded-xl border border-[#e7edf0] bg-[#fbfcfc] p-3">
              <div className="flex items-center justify-between gap-2"><div><h3 className="text-[11px] font-extrabold">{summary.currency}</h3><p className="mt-0.5 text-[8px] text-[#82909a]">Wallet ····{summary.walletId.slice(-4)}</p></div><span className="text-[9px] text-[#82909a]">Posted ledger</span></div>
              <div className="mt-3 grid grid-cols-3 gap-2"><LedgerValue label="Inflow" value={summary.inflowMinor} currency={summary.currency} tone="in" /><LedgerValue label="Outflow" value={summary.outflowMinor} currency={summary.currency} tone="out" /><LedgerValue label="Net" value={summary.netMinor} currency={summary.currency} signed /></div>
            </article>)}
            {!reportQuery.data?.ledgerSummaries.length && <div className="rounded-xl bg-[#f5f8f8] px-3 py-4 text-[11px] text-[#718196]">No ledger totals for this period.</div>}
          </div>
          {!!reportQuery.data?.ledgerTrend.length && <div className="border-t border-[#edf0f3] px-4 py-3"><h3 className="text-[11px] font-bold">Period movement by wallet</h3><div className="mt-2 space-y-2">{reportQuery.data.ledgerTrend.slice(-8).map((point, i) => {
            const max = Math.max(1, ...reportQuery.data!.ledgerTrend.filter(value => value.currency === point.currency && value.walletId === point.walletId).map(value => Math.max(Number(value.inflowMinor), Number(value.outflowMinor))));
            return <div key={`${point.period}-${point.walletId}-${i}`} data-testid={`ledger-trend-${point.walletId.slice(-4)}-${i}`} className="grid grid-cols-[86px_minmax(40px,1fr)_auto] items-center gap-2 text-[9px]"><span className="text-[#748494]">{point.period} · {point.currency}<small className="block text-[8px] text-[#9aa5ab]">Wallet ····{point.walletId.slice(-4)}</small></span><span className="flex h-2 overflow-hidden rounded-full bg-[#edf1f2]"><i className="h-full bg-[#5c9993]" style={{ width: `${Math.max(1, Number(point.inflowMinor) / max * 100)}%` }} /><i className="h-full bg-[#d5ad65]" style={{ width: `${Math.max(1, Number(point.outflowMinor) / max * 100)}%` }} /></span><span className="text-[#718196]">In / out</span></div>;
          })}</div></div>}
          <div className="border-t border-[#edf0f3] px-4 py-3"><div className="mb-2 flex items-center justify-between"><h3 className="text-[11px] font-bold">Recent ledger activity</h3><span className="text-[9px] text-[#81909c]">Most recent</span></div>
            {reportQuery.data?.recentActivity.length ? <div className="divide-y divide-[#edf0f3]">{reportQuery.data.recentActivity.slice(0, 6).map(item => <div data-testid={`ledger-activity-${item.id}`} key={item.id} className="flex min-w-0 items-center gap-2 py-2"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${item.direction === 'inflow' ? 'bg-[#edf6f2] text-[#39806c]' : item.direction === 'outflow' ? 'bg-[#f9f3e8] text-[#9a7a3f]' : 'bg-[#eef3f4] text-[#657b83]'}`}>{item.direction === 'inflow' ? <ArrowDownLeft size={14} /> : item.direction === 'outflow' ? <ArrowUpRight size={14} /> : <CircleDollarSign size={14} />}</span><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold">{item.description || item.type.replaceAll('_', ' ')}</p><p className="truncate text-[9px] text-[#82909a]">{item.reference} · {item.type.replaceAll('_', ' ')} · {item.effectiveDate} · {item.status} · wallet ····{item.walletId.slice(-4)}</p></div><p className="shrink-0 text-right text-[10px] font-bold tabular-nums">{formatMinor(item.amountMinor, item.currency)}<span className="block text-[8px] font-medium text-[#82909a]">{item.direction} · {item.walletCurrency} wallet</span></p></div>)}</div> : <p className="rounded-lg bg-[#f5f8f8] px-3 py-3 text-[10px] text-[#718196]">No recent ledger activity in this period.</p>}
          </div>
        </>}
      </section>

      <section className="grid min-w-0 gap-3 xl:grid-cols-[1.08fr_.92fr]">
        <article className="pf-panel min-w-0 overflow-hidden" data-testid="finance-account-trackers">
          <div className="flex items-center justify-between gap-2 border-b border-[#e8edf2] px-4 py-3"><div><h2 className="text-[13px] font-bold">Savings & investment trackers</h2><p className="mt-0.5 text-[10px] text-[#718196]">Personal records, not external accounts or investments.</p></div><button data-testid="button-add-account-tracker" type="button" disabled={financeBusy} className="pf-button pf-button-primary min-h-[34px] px-2.5" onClick={() => { setEditingAccount(null); setAddingAccount(true); }}><Plus size={13} /> Add tracker</button></div>
          {accountsQuery.isError ? <QueryError text="Trackers could not be loaded." retry={() => accountsQuery.refetch()} /> : accountsQuery.isLoading ? <RecordsSkeleton /> : accounts.length ? <div className="divide-y divide-[#edf0f3] px-4">{accounts.map(account => <div data-testid={`account-tracker-${account.id}`} key={account.id} className="flex min-w-0 items-center gap-3 py-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef6f6] text-[#357b83]">{account.type === 'savings' ? <Target size={16} /> : <TrendingUp size={16} />}</span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold">{account.name}</p><p className="mt-0.5 truncate text-[9px] capitalize text-[#82909a]">{account.type} tracker · {account.openedOn} · {account.status}</p></div><div className="shrink-0 text-right"><p className="text-[11px] font-bold tabular-nums">{formatMinor(account.currentValueMinor, account.currency)}</p>{account.targetAmountMinor && <p className="text-[9px] text-[#82909a]">of {formatMinor(account.targetAmountMinor, account.currency)}</p>}</div><button data-testid={`button-edit-account-${account.id}`} type="button" aria-label={`Edit ${account.name}`} className="rounded-lg p-2 text-[#718196] hover:bg-[#eef6f6]" onClick={() => setEditingAccount(account)}><Pencil size={14} /></button></div>)}</div> : <div className="px-4 py-6 text-center"><p className="text-[11px] font-semibold">No trackers yet</p><p className="mt-1 text-[10px] text-[#718196]">Keep a savings goal or investment snapshot here.</p><button data-testid="button-first-account-tracker" type="button" className="pf-button mt-3" onClick={() => setAddingAccount(true)}><Plus size={13} /> Add tracker</button></div>}
          {!!reportQuery.data?.accountSummaries.length && <div className="grid grid-cols-2 gap-2 border-t border-[#edf0f3] bg-[#fbfcfc] px-4 py-3">{reportQuery.data.accountSummaries.map(summary => <div data-testid={`account-summary-${summary.type}-${summary.currency}`} key={`${summary.type}-${summary.currency}`} className="rounded-lg bg-white px-2.5 py-2"><p className="text-[9px] capitalize text-[#82909a]">{summary.type} · {summary.accountCount} {summary.accountCount === 1 ? 'tracker' : 'trackers'}</p><p className="mt-1 text-[11px] font-bold">{formatMinor(summary.currentValueMinor, summary.currency)} <span className="text-[9px] text-[#82909a]">{summary.currency}</span></p>{summary.type === 'savings' && <p className="mt-0.5 text-[9px] text-[#82909a]">of {formatMinor(summary.targetAmountMinor, summary.currency)} target</p>}</div>)}</div>}
        </article>
        <article className="pf-panel min-w-0 overflow-hidden" data-testid="finance-requests">
          <div className="flex items-center justify-between gap-2 border-b border-[#e8edf2] px-4 py-3"><div><h2 className="text-[13px] font-bold">Loan requests</h2><p className="mt-0.5 text-[10px] text-[#718196]">Requests are not approvals or disbursements.</p></div><button data-testid="button-new-loan-request" type="button" disabled={financeBusy} className="pf-button min-h-[34px] px-2.5" onClick={() => setAddingLoan(true)}><Plus size={13} /> New request</button></div>
          {loansQuery.isError ? <QueryError text="Loan requests could not be loaded." retry={() => loansQuery.refetch()} /> : loansQuery.isLoading ? <RecordsSkeleton /> : loanApplications.length ? <div className="divide-y divide-[#edf0f3] px-4">{loanApplications.map(application => <LoanApplicationRow key={application.id} application={application} pending={withdrawLoan.isPending && withdrawLoan.variables?.applicationId === application.id} onWithdraw={() => { if (!window.confirm('Withdraw this loan request?')) return; withdrawLoan.mutate({ applicationId: application.id, data: { status: 'withdrawn' } }, { onSuccess: () => { invalidateWorkspace(client); setMessage({ type: 'success', text: 'Loan request withdrawn.' }); }, onError: () => setMessage({ type: 'error', text: 'The request could not be withdrawn. Try again.' }) }); }} />)}</div> : <div className="px-4 py-6 text-center"><p className="text-[11px] font-semibold">No requests saved</p><p className="mt-1 text-[10px] text-[#718196]">Submit a request to keep its status here.</p></div>}
          {!!reportQuery.data?.loanSummaries.length && <div className="grid grid-cols-2 gap-2 border-t border-[#edf0f3] bg-[#fbfcfc] px-4 py-3">{reportQuery.data.loanSummaries.map(summary => <div data-testid={`loan-summary-${summary.currency}`} key={summary.currency} className="rounded-lg bg-white px-2.5 py-2"><p className="text-[9px] text-[#82909a]">{summary.currency} · {summary.submittedCount} submitted · {summary.withdrawnCount} withdrawn</p><p className="mt-1 text-[11px] font-bold">Requested {formatMinor(summary.requestedAmountMinor, summary.currency)}</p></div>)}</div>}
          {!!reportQuery.data?.billSummaries.length && <div className="border-t border-[#edf0f3] px-4 py-3"><h3 className="text-[10px] font-bold">Bill records</h3><p className="mt-1 text-[9px] leading-4 text-[#718196]">Paid means you recorded it as paid; it does not confirm external settlement.</p><div className="mt-2 flex flex-wrap gap-2">{reportQuery.data.billSummaries.map(summary => <span data-testid={`bill-summary-${summary.currency}`} key={summary.currency} className="rounded-lg bg-[#f5f8f8] px-2.5 py-2 text-[9px] leading-4 text-[#526c7a]">{summary.currency} · unpaid {summary.unpaidCount} ({formatMinor(summary.unpaidAmountMinor, summary.currency)}) · recorded paid {summary.recordedPaidCount} ({formatMinor(summary.recordedPaidAmountMinor, summary.currency)})</span>)}</div></div>}
        </article>
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
            <label className="min-w-0"><span className="sr-only">Filter records by type</span><select data-testid="select-filter-record-kind" className="pf-control min-h-[38px] py-2 text-[11px] sm:w-[160px]" value={kind} onChange={e => { setKind(e.target.value as PersonalFinanceKind | ''); setPage(1); }} aria-label="Filter records by type"><option value="">All record types</option>{kinds.map(item => <option key={item} value={item}>{labels[item]}</option>)}</select></label>
            <label className="min-w-0"><span className="sr-only">Filter records by currency</span><select data-testid="select-filter-record-currency" className="pf-control min-h-[38px] py-2 text-[11px] sm:w-[128px]" value={currency} onChange={e => { setCurrency(e.target.value as CurrencyCode | ''); setPage(1); }} aria-label="Filter records by currency"><option value="">All currencies</option>{currencyCodes.map(item => <option key={item}>{item}</option>)}</select></label>
          </div>
        </div>
        {message && <p data-testid="finance-operation-status" role={message.type === 'error' ? 'alert' : 'status'} className={`mx-4 mt-3 rounded-xl px-3 py-2.5 text-[11px] ${message.type === 'error' ? 'border border-[#efd8d3] bg-[#fff7f5] text-[#a24940]' : 'border border-[#cfe5db] bg-[#f1f8f4] text-[#397a62]'}`}>{message.text}</p>}
        {recordQuery.isError ? <QueryError text="Your records could not be loaded." retry={() => recordQuery.refetch()} /> : recordQuery.isLoading || recordQuery.isFetching ? <RecordsSkeleton /> : records.length ? (
          <div className="px-3 pb-2 pt-1 sm:px-4">
            {records.map(record => <RecordRow key={record.id} record={record} deleting={deleteRecord.isPending && deleteRecord.variables?.recordId === record.id} onEdit={() => { setMessage(null); setEditing(record); }} onDelete={() => removeRecord(record)} />)}
            <div className="flex flex-col gap-2 border-t border-[#edf0f3] py-3 min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between">
              <p className="text-[10px] text-[#768694]">Page {page} of {totalPages} · {recordQuery.data?.total ?? 0} records</p>
              <div className="flex gap-2">
                <button data-testid="button-records-previous" type="button" className="pf-button min-h-[34px]" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1}><ChevronLeft size={14} /> Previous</button>
                <button data-testid="button-records-next" type="button" className="pf-button min-h-[34px]" onClick={() => setPage(value => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>Next <ChevronRight size={14} /></button>
              </div>
            </div>
          </div>
        ) : <div className="px-4 py-9 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-[15px] bg-[#eef6f6] text-[#357b83]"><Wallet size={20} /></span><h3 className="mt-3 text-[13px] font-bold">{kind || currency ? 'No records match these filters' : 'A record book, on your terms'}</h3><p className="mx-auto mt-1 max-w-[360px] text-[11px] leading-5 text-[#718196]">{kind || currency ? 'Try another type or currency, or clear your filters.' : 'Keep track of the details that matter to you, separate from your bank activity.'}</p><button type="button" className="pf-button pf-button-primary mt-3" onClick={() => { setKind(''); setCurrency(''); if (!kind && !currency) setAdding(true); else setPage(1); }}><Plus size={14} /> {kind || currency ? 'Clear filters' : 'Add your first record'}</button></div>}
      </section>

      {adding && <FinanceRecordDialog pending={pending} saveError={message?.type === 'error' ? message.text : undefined} onClose={() => setAdding(false)} onSubmit={submit} />}
      {editing && <FinanceRecordDialog key={editing.id} record={editing} pending={pending} saveError={message?.type === 'error' ? message.text : undefined} onClose={() => setEditing(null)} onSubmit={submit} />}
      {(addingAccount || editingAccount) && <FinancialAccountDialog key={editingAccount?.id ?? 'new-account'} account={editingAccount} pending={createAccount.isPending || updateAccount.isPending} onClose={() => { setAddingAccount(false); setEditingAccount(null); }} onSave={saveAccount} />}
      {addingLoan && <LoanRequestDialog pending={createLoan.isPending} onClose={() => setAddingLoan(false)} onSave={submitLoan} />}
    </div>
  );
}

export function CompactExpenseTracker() {
  const reportParams = useMemo(() => ({ period: 'month' as const }), []);
  const reportQuery = useGetBankFinanceReport(reportParams, { query: { queryKey: getGetBankFinanceReportQueryKey(reportParams), staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } });
  return (
    <section className="pfw pf-panel mt-3 min-w-0 overflow-hidden" aria-labelledby="dashboard-account-activity-title" data-testid="dashboard-ledger-summary">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e8edf2] px-3.5 py-3 sm:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#eaf3f2] text-[#357b83]"><Landmark size={15} /></span><div><h2 id="dashboard-account-activity-title" className="text-[12px] font-bold">Account activity · income & expenses</h2><p className="mt-0.5 text-[9px] text-[#718196]">Posted Globus ledger activity · this month</p></div></div>
          <p className="mt-2 text-[9px] leading-4 text-[#718196]">Internal account activity only. Not verified outside income or spending.</p>
        </div>
        <Link data-testid="link-financial-overview" href="/financial-overview" className="inline-flex shrink-0 items-center gap-1 text-[9px] font-bold text-[#357b83]">Full report <ChevronRight size={12} /></Link>
      </div>
      {reportQuery.isError ? <div className="flex items-center justify-between gap-3 px-4 py-4 text-[10px] text-[#a24940]"><span>Account activity is unavailable.</span><button type="button" data-testid="button-retry-dashboard-ledger" onClick={() => void reportQuery.refetch()} className="pf-button min-h-[32px]">Try again</button></div> : reportQuery.isLoading ? <div className="grid gap-2 p-3 sm:grid-cols-2"><div className="pf-skeleton h-14" /><div className="pf-skeleton h-14" /></div> : (
        <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
           {reportQuery.data?.ledgerSummaries.length ? reportQuery.data.ledgerSummaries.map(summary => <div data-testid={`dashboard-ledger-${summary.currency}-${summary.walletId.slice(-4)}`} key={summary.walletId} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#e5ebed] bg-[#fbfcfc] px-3 py-2.5">
             <div><span className="text-[10px] font-extrabold">{summary.currency}</span><p className="mt-0.5 text-[8px] text-[#85929b]">Wallet ····{summary.walletId.slice(-4)}</p></div>
            <div className="grid grid-cols-2 gap-x-3 text-right"><span className="text-[8px] text-[#82909a]">Income</span><span className="text-[8px] text-[#82909a]">Expenses</span><strong className="text-[10px] font-bold tabular-nums text-[#3f766b]">{formatMinor(summary.inflowMinor, summary.currency)}</strong><strong className="text-[10px] font-bold tabular-nums text-[#8d7043]">{formatMinor(summary.outflowMinor, summary.currency)}</strong></div>
          </div>) : <p className="rounded-xl bg-[#f7f9f9] px-3 py-3 text-[10px] text-[#718196] sm:col-span-2 xl:col-span-3">No posted account activity this month.</p>}
        </div>
      )}
    </section>
  );
}

function SummaryValue({ label, value, icon: Icon, note }: { label: string; value: string; icon: typeof Target; note?: string }) {
  return <div className="min-w-0"><div className="flex items-center gap-1.5 text-[#82909a]"><Icon size={12} /><span className="truncate text-[9px] font-semibold">{label}</span></div><p className="pf-stat-value mt-1 text-[13px] font-bold leading-5">{value}</p>{note && <p className="mt-0.5 truncate text-[9px] text-[#89959e]">{note}</p>}</div>;
}

function LedgerValue({ label, value, currency, tone, signed }: { label: string; value: string; currency: CurrencyCode; tone?: 'in' | 'out'; signed?: boolean }) {
  return <div className="min-w-0"><p className={`text-[8px] font-semibold ${tone === 'in' ? 'text-[#4a8578]' : tone === 'out' ? 'text-[#9a7a3f]' : 'text-[#7a8790]'}`}>{label}</p><p className="mt-1 break-words text-[10px] font-bold tabular-nums">{signed ? formatSignedMinor(value, currency) : formatMinor(value, currency)}</p></div>;
}

function LoanApplicationRow({ application, pending, onWithdraw }: { application: BankFinanceLoanApplication; pending: boolean; onWithdraw: () => void }) {
  return <div data-testid={`loan-application-${application.id}`} className="flex min-w-0 items-center gap-2.5 py-3">
    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${application.status === 'submitted' ? 'bg-[#eef5f2] text-[#4c8574]' : 'bg-[#f3f4f4] text-[#808d93]'}`}><CreditCard size={15} /></span>
    <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold">{application.purpose}</p><p className="mt-0.5 truncate text-[9px] text-[#82909a]">{application.termMonths} months · {new Date(application.submittedAt).toLocaleDateString()}</p></div>
    <div className="shrink-0 text-right"><p className="text-[10px] font-bold">{formatMinor(application.requestedAmountMinor, application.currency)}</p><span className={`text-[8px] font-bold capitalize ${application.status === 'submitted' ? 'text-[#4a8578]' : 'text-[#87939a]'}`}>{application.status}</span></div>
    {application.status === 'submitted' && <button data-testid={`button-withdraw-loan-${application.id}`} type="button" disabled={pending} onClick={onWithdraw} className="rounded-lg px-2 py-1 text-[9px] font-bold text-[#8b6257] hover:bg-[#fbf3ef] disabled:opacity-50">Withdraw</button>}
  </div>;
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
  return <article data-testid={`finance-record-${record.id}`} className="pf-record-card pf-row flex min-w-0 items-center gap-2.5 py-3">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef6f6] text-[#357b83]"><Icon size={16} /></span>
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><h3 className="max-w-full truncate text-[12px] font-bold">{record.title}</h3><span data-testid={`status-record-${record.id}`} className={`rounded-full px-2 py-0.5 text-[9px] font-bold capitalize ${statusTone}`}>{record.kind === 'bill' && record.status === 'paid' ? 'Recorded paid' : record.status}</span></div>
      <p className="mt-1 truncate text-[10px] text-[#7e8c97]">{labels[record.kind]}{record.category ? ` · ${record.category}` : ''} · {record.recordDate}{record.dueDate ? ` · due ${record.dueDate}` : ''}</p>
    </div>
    <div className="shrink-0 text-right"><p className="text-[12px] font-bold tabular-nums">{formatMinor(record.amountMinor, record.currency)}</p><p className="mt-0.5 text-[9px] text-[#87949d]">{record.currency}</p></div>
    <div className="flex shrink-0 gap-0.5">
       <button data-testid={`button-edit-record-${record.id}`} type="button" aria-label={`Edit ${record.title}`} onClick={onEdit} className="rounded-lg p-2 text-[#718196] hover:bg-[#eef6f6] hover:text-[#357b83]"><Pencil size={14} /></button>
       <button data-testid={`button-delete-record-${record.id}`} type="button" aria-label={`Delete ${record.title}`} onClick={onDelete} disabled={deleting} className="rounded-lg p-2 text-[#a24940] hover:bg-[#fff7f5] hover:text-[#b64d45] disabled:opacity-40"><Trash2 size={14} /></button>
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
