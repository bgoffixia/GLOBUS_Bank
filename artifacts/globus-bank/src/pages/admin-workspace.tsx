import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useClerk, useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, Banknote, Bell, Monitor,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, ClipboardList, Download,
  FileClock, KeyRound, Landmark, LayoutDashboard, LockKeyhole, LogOut, Menu, Search,
  Mail, MessageSquareText, Settings2, Shield, ShieldCheck, SlidersHorizontal, Users, WalletCards, X,
} from 'lucide-react';
import {
  getGetAdminAccessQueryKey, getGetAdminSummaryQueryKey, getGetAdminSettingsQueryKey,
  getGetAdminWalletCurrencyMigrationPreviewQueryKey,
  getGetAdminTransactionDetailQueryKey, getGetAdminUserDetailQueryKey,
  getListAdminAccountsQueryKey, getListAdminAuditLogsQueryKey,
  getListAdminLedgerRequestsQueryKey,
  getListAdminRestrictionsQueryKey,
  getListAdminTransactionsQueryKey, getListAdminTransactionStatusHistoryQueryKey,
  getListAdminUsersQueryKey,
  useCreateAdminFunding, useCreateAdminRestriction, useCreateAdminTransactionCorrection,
  useConvertAdminWalletCurrenciesToUsd, useGetAdminWalletCurrencyMigrationPreview,
  useGetAdminAccess,
  useGetAdminSettings, useGetAdminSummary, useGetAdminTransactionDetail,
  useGetAdminUserDetail, useListAdminAccounts, useListAdminAuditLogs,
  useListAdminLedgerRequests, useListAdminRestrictions,
  useListAdminTransactions,
  useListAdminTransactionStatusHistory, useListAdminUsers,
  useResetAdminUserPassword, useResetAdminUserTransactionPin, useReviewAdminFunding, useReviewAdminLedgerRequest,
  useProcessAdminInternalTransfer, useRemoveAdminRestriction,
  useAssignAdminUserAccountTier,
  useUpdateAdminSettings, useUpdateAdminTransactionStatus, useUpdateAdminUserProfile,
  useUpdateAdminTransactionDate,
  useUpdateAdminUserAccessControls,
  useUpdateAdminUserStatus, useUpdateAdminWalletStatus,
  useUpdateAdminUserVaultSubscription,
} from '@workspace/api-client-react';
import { AdminVaultAccessPage } from '../components/admin-vault-access-page';
import { AdminSupportInbox } from '@/components/support-messaging';
import type {
  ActiveCurrencyCode, AdminAccount, AdminAuditLog, AdminLedgerRequest, AdminUser, BankTransaction, CurrencyCode,
  AdminRestriction, BankRestrictionType, ListAdminTransactionsParams, ListAdminUsersParams, TransactionType, Wallet,
} from '@workspace/api-client-react';
import { customerTransactionDate, transactionDateInputValue } from '../lib/transaction-date';
import { AppLanguageSelector } from '@/components/app-language-selector';
import { useLanguage } from '@/lib/i18n';

const currencies: ActiveCurrencyCode[] = ['USD', 'EUR', 'GBP', 'CAD'];
const historicalCurrencies: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'NGN', 'CAD', 'AUD'];
const currencyLabel: Record<CurrencyCode, string> = { USD: 'US dollar', EUR: 'Euro', GBP: 'Pound sterling', NGN: 'Nigerian naira', CAD: 'Canadian dollar', AUD: 'Australian dollar' };
const nav = [
  { path: '/admin', label: 'Overview', icon: LayoutDashboard },
  { path: '/admin/users', label: 'Members', icon: Users },
  { path: '/admin/vault-access', label: 'Vault Access', icon: ShieldCheck },
  { path: '/admin/support', label: 'Support inbox', icon: MessageSquareText },
  { path: '/admin/support-settings', label: 'Support config', icon: Settings2 },
  { path: '/admin/accounts', label: 'Accounts', icon: WalletCards },
  { path: '/admin/transactions', label: 'Transactions', icon: Activity },
  { path: '/admin/funding', label: 'Funding', icon: Banknote },
  { path: '/admin/wallets', label: 'Wallet controls', icon: LockKeyhole },
  { path: '/admin/restrictions', label: 'Restrictions', icon: Shield },
  { path: '/admin/audit', label: 'Audit log', icon: FileClock },
  { path: '/admin/settings', label: 'Settings', icon: Settings2 },
  { path: '/admin/logout', label: 'Sign out', icon: LogOut },
];
const box = 'rounded-[18px] border border-[#dce5e8] bg-[#fffefa] shadow-[0_4px_16px_rgba(28,53,69,.035)]';
const input = 'h-10 w-full rounded-[9px] border border-[#d8e1e3] bg-[#fffefa] px-3 text-[12px] text-[#253c4c] outline-none transition focus:border-[#43898a] focus:ring-2 focus:ring-[#43898a]/10';
const button = 'inline-flex items-center justify-center gap-2 rounded-[9px] bg-[#173b50] px-4 py-2.5 text-[11px] font-bold text-white transition hover:bg-[#24576a] disabled:cursor-not-allowed disabled:opacity-50';
const quietButton = 'inline-flex items-center justify-center gap-2 rounded-[9px] border border-[#dbe4e5] bg-[#fffefa] px-3 py-2.5 text-[11px] font-semibold text-[#425d69] transition hover:bg-[#f3f7f5] disabled:opacity-50';
const accountTierChoices = [
  { id: 'default', label: 'Use Standard 🏦 default' },
  { id: 'standard', label: 'Standard 🏦' },
  { id: 'silver', label: 'Silver🥈' },
  { id: 'gold', label: 'Gold 🪙' },
  { id: 'bronze', label: 'Bronze 🥉' },
] as const;
type AccountTierSelection = (typeof accountTierChoices)[number]['id'];

function date(value?: string | null) { return value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }
function dateTime(value?: string | null) { return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
function money(value: string | number, currency: string) { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value)); } catch { return `${currency} ${value}`; } }
function moneyMinor(value?: string | null, currency = 'NGN') { return value && /^\d+$/.test(value) ? money(Number(value) / 100, currency) : '—'; }
function human(value?: string | null) { return (value || 'unknown').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function ledgerPostingState(entries: Array<{ currency: string; side: 'debit' | 'credit'; amount: string }>) {
  if (!entries.length) return 'not_posted' as const;
  const totals = new Map<string, { debit: bigint; credit: bigint }>();
  for (const entry of entries) {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(entry.amount);
    if (!match) return 'inconsistent' as const;
    const amount = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
    const total = totals.get(entry.currency) || { debit: 0n, credit: 0n };
    total[entry.side] += amount;
    totals.set(entry.currency, total);
  }
  return [...totals.values()].every(total => total.debit > 0n && total.debit === total.credit)
    ? 'posted' as const
    : 'inconsistent' as const;
}
function nameOf(user: Pick<AdminUser, 'firstName' | 'lastName'> | { firstName?: string | null; lastName?: string | null }) { return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Globus member'; }
function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) { return <label className={`block ${className}`}><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.11em] text-[#71848b]">{label}</span>{children}</label>; }
function Panel({ title, eyebrow, note, children, action }: { title: string; eyebrow?: string; note?: string; children: ReactNode; action?: ReactNode }) {
  return <section className={`${box} overflow-hidden`}><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e8eeeb] px-5 py-4 sm:px-6"><div>{eyebrow && <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#468383]">{eyebrow}</p>}<h2 className="mt-1 text-[15px] font-bold tracking-[-.02em] text-[#263e4b]">{title}</h2>{note && <p className="mt-1 text-[10px] leading-4 text-[#7c8e92]">{note}</p>}</div>{action}</div>{children}</section>;
}
function Heading({ kicker, title, subtitle, action }: { kicker: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#4f8888]">{kicker}</p><h1 className="mt-1 font-[family-name:var(--app-font-sans)] text-[28px] font-extrabold tracking-[-.055em] text-[#203b4c] sm:text-[34px]">{title}</h1><p className="mt-1 max-w-2xl text-[12px] leading-5 text-[#71858b]">{subtitle}</p></div>{action}</div>;
}
function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'good' | 'warn' | 'bad' | 'neutral' }) {
  const tones = { good: 'bg-[#e9f4ed] text-[#42735b]', warn: 'bg-[#f7f0df] text-[#8a7038]', bad: 'bg-[#f8e9e5] text-[#a45247]', neutral: 'bg-[#edf2f2] text-[#61777c]' };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.06em] ${tones[tone]}`}>{children}</span>;
}
function InlineError({ text, retry }: { text: string; retry: () => void }) { return <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-[#f0d4cc] bg-[#fff7f3] p-4 text-[11px] text-[#9a5044]"><span className="flex items-center gap-2"><CircleAlert size={15} />{text}</span><button className={quietButton} onClick={retry}>Retry</button></div>; }
function Skeleton({ rows = 4 }: { rows?: number }) { return <div className="animate-pulse space-y-3 p-5">{Array.from({ length: rows }, (_, i) => <div key={i} className="h-10 rounded-lg bg-[#edf2ef]" />)}</div>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="px-6 py-12 text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#edf5f0] text-[#568583]"><ClipboardList size={19} /></div><p className="mt-3 text-[13px] font-bold text-[#3b545d]">{title}</p><p className="mx-auto mt-1 max-w-sm text-[11px] leading-5 text-[#819195]">{text}</p></div>; }
function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) { return <div className="flex items-center justify-between border-t border-[#e8eeeb] px-5 py-3 text-[10px] text-[#75878b]"><span>Page {page} of {Math.max(1, pages)}</span><div className="flex gap-2"><button className={quietButton} disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={14} />Previous</button><button className={quietButton} disabled={page >= pages} onClick={() => onChange(page + 1)}>Next<ChevronRight size={14} /></button></div></div>; }
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[#142a35]/55 p-3 backdrop-blur-[2px]" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><section role="dialog" aria-modal="true" className="my-auto max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-[20px] border border-[#dce5e5] bg-[#fffefa] shadow-2xl"><header className="flex items-center justify-between border-b border-[#e7eeeb] px-5 py-4"><h2 className="text-[15px] font-bold text-[#263f4b]">{title}</h2><button onClick={close} aria-label="Close dialog" className="rounded-lg p-2 text-[#687d82] hover:bg-[#edf3ef]"><X size={16} /></button></header><div className="p-5">{children}</div></section></div>; }
function StatusPill({ status }: { status: string }) { const tone = ['active', 'approved', 'completed'].includes(status) ? 'good' : ['suspended', 'restricted', 'rejected', 'failed', 'expired'].includes(status) ? 'bad' : ['pending', 'pending_review', 'additional_information_required'].includes(status) ? 'warn' : 'neutral'; return <Pill tone={tone}>{human(status)}</Pill>; }

export function AdminWorkspace() {
  const [path] = useLocation();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const access = useGetAdminAccess({
    query: {
      queryKey: getGetAdminAccessQueryKey(),
      retry: false,
      refetchInterval: 3_000,
      refetchIntervalInBackground: false,
    },
  });
  useEffect(() => {
    if (access.data?.allowed !== false && !access.isError) return;
    void queryClient.cancelQueries({
      predicate: query =>
        typeof query.queryKey[0] === 'string' &&
        query.queryKey[0].startsWith('/api/bank/admin/'),
    });
    queryClient.removeQueries({
      predicate: query =>
        typeof query.queryKey[0] === 'string' &&
        query.queryKey[0].startsWith('/api/bank/admin/'),
    });
  }, [access.data?.allowed, access.isError, queryClient]);
  const isDetail = /^\/admin\/users\/[^/]+$/.test(path);
  const page = path === '/admin' ? 'overview' : isDetail ? 'member-detail' : path.split('/')[2] || 'overview';
  const pageTitles: Record<string, string> = { overview: t('Operations overview'), users: t('Member directory'), 'vault-access': t('Private Vault access'), support: t('Support inbox'), 'support-settings': t('Support configuration'), accounts: t('Currency accounts'), transactions: t('Transaction activity'), funding: t('User funding'), wallets: t('Wallet controls'), restrictions: t('Restrictions'), audit: t('Audit trail'), settings: t('Operations settings'), 'member-detail': t('Member record') };
  if (path === '/admin/logout') return <WorkspaceFrame active="logout" title={t('Sign out')} authorized={access.data?.allowed === true}><LogoutPage /></WorkspaceFrame>;
  if (access.isLoading) return <WorkspaceFrame active={page} title={t('Operations workspace')} authorized={false}><div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map(x => <div key={x} className={`${box} h-36 animate-pulse bg-[#edf2ef]`} />)}</div></WorkspaceFrame>;
  if (access.isError || !access.data?.allowed) return <WorkspaceFrame active={page} title={t('Operations workspace')} authorized={false}><div className={`${box} mx-auto max-w-xl p-8 text-center`}><Shield size={28} className="mx-auto text-[#9b6157]" /><h1 className="mt-4 text-xl font-bold text-[#263e4b]">{t('Operations access restricted')}</h1><p className="mt-2 text-[12px] leading-5 text-[#7a8c91]">{t('This workspace is available to authorized Globus operations administrators.')}</p><button onClick={() => access.refetch()} className={`${button} mt-5`}>{t('Check access again')}</button></div></WorkspaceFrame>;
  return <WorkspaceFrame active={page} title={pageTitles[page] || t('Operations workspace')} authorized>
    {page === 'overview' && <Overview />}
    {page === 'users' && <UsersPage />}
    {page === 'vault-access' && <AdminVaultAccessPage />}
    {page === 'support' && <AdminSupportInbox />}
    {page === 'support-settings' && <SupportConfigurationPage />}
    {page === 'member-detail' && <MemberDetail userId={path.split('/')[3] || ''} />}
    {page === 'accounts' && <AccountsPage />}
    {page === 'wallets' && <AccountsPage controlsOnly />}
    {page === 'restrictions' && <RestrictionsPage />}
    {page === 'transactions' && <TransactionsPage />}
    {page === 'funding' && <FundingPage />}
    {page === 'audit' && <AuditPage />}
    {page === 'settings' && <SettingsPage />}
    {page === 'logout' && <LogoutPage />}
  </WorkspaceFrame>;
}

function WorkspaceFrame({ children, active, title, authorized }: { children: ReactNode; active: string; title: string; authorized: boolean }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user } = useUser();
  const { t } = useLanguage();
  const email = user?.primaryEmailAddress?.emailAddress || '';
  const initials = (user?.firstName?.[0] || email[0] || 'G').toUpperCase();
  const isActive = (href: string) =>
    href === '/admin'
      ? active === 'overview'
      : href === '/admin/users'
        ? active === 'users' || active === 'member-detail'
        : active === href.split('/')[2];
  const navigationLink = (item: (typeof nav)[number], onNavigate?: () => void, compact = false) => {
    const Icon = item.icon;
    return (
      <Link
        key={item.path}
        href={item.path}
        onClick={onNavigate}
        aria-label={compact ? t(item.label) : undefined}
        title={compact ? t(item.label) : undefined}
        aria-current={isActive(item.path) ? 'page' : undefined}
        data-testid={`admin-nav-${item.path === '/admin' ? 'overview' : item.path.slice('/admin/'.length).replaceAll('/', '-')}`}
        className={`flex w-full items-center gap-3 rounded-[9px] px-3 py-[10px] text-[11px] font-semibold transition-colors ${
          compact ? 'justify-center px-2' : ''
        } ${isActive(item.path) ? 'bg-[#d9c27f] text-[#1d3c48]' : 'text-[#c1d2d1] hover:bg-white/[.07] hover:text-white'}`}
      >
        <Icon size={16} strokeWidth={1.8} />
        {!compact && <span className="min-w-0 flex-1 truncate">{t(item.label)}</span>}
      </Link>
    );
  };
  const navContent = (onNavigate?: () => void, compact = false) => <nav aria-label={t('Administration navigation')} className={`min-h-0 flex-1 space-y-1 overflow-y-auto ${compact ? 'px-2' : 'px-2.5'}`}>{nav.map(item => navigationLink(item, onNavigate, compact))}</nav>;
  const identityCard = <div className="flex items-center gap-2.5 rounded-[9px] bg-white/[.045] p-2.5">
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#d7e8e3] text-[10px] font-bold text-[#244a54]">{initials}</div>
    <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold text-white">{user?.fullName || t('Administrator')}</p><p className="truncate text-[9px] text-[#9eb5b6]">{email || t('Authorized operator')}</p></div>
  </div>;
  return <div className="admin-viewport bg-[#edf3f6] text-[#243d4b]">
    <aside className={`admin-sidebar hidden h-full shrink-0 flex-col bg-[#102f4d] text-[#dbe8e5] transition-[width] duration-200 lg:flex ${sidebarCollapsed ? 'w-[72px]' : 'w-[218px]'}`}>
      <div className={`flex h-[66px] shrink-0 items-center gap-3 border-b border-white/[.09] ${sidebarCollapsed ? 'justify-center px-2' : 'px-5'}`}>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#d9c27f] text-[#173b49]"><span className="font-[family-name:var(--app-font-sans)] text-[19px] font-extrabold">G</span></div>
        {!sidebarCollapsed && <div className="min-w-0 leading-none"><p className="text-[15px] font-extrabold tracking-[-.06em] text-white">GLOBUS</p><p className="mt-1.5 text-[8px] font-bold tracking-[.22em] text-[#dfc87f]">BANK · OPERATIONS</p></div>}
      </div>
      {!sidebarCollapsed && <div className="mx-3.5 my-4 rounded-[10px] border border-white/[.09] bg-white/[.045] px-3 py-2.5">
        <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#9fcec1]"><span className={`h-1.5 w-1.5 rounded-full ${authorized ? 'bg-[#7cc6aa]' : 'bg-[#c19c50]'}`} />{authorized ? 'Operations live' : 'Access protected'}</p>
        <p className="mt-1 text-[10px] text-[#a9c0c1]">Administrative workspace</p>
      </div>}
      {!sidebarCollapsed && <p className="px-5 pb-2 text-[8px] font-bold uppercase tracking-[.17em] text-[#839fa4]">Workspace</p>}
      {navContent(undefined, sidebarCollapsed)}
      {!sidebarCollapsed && <div className="mx-3.5 mb-3 rounded-[9px] border border-white/[.08] bg-white/[.035] p-3">
        <div className="flex items-center gap-2 text-[#c7d6d4]"><ShieldCheck size={14} /><span className="text-[10px] font-semibold">Protected workspace</span></div>
        <p className="mt-1.5 pl-[22px] text-[9px] text-[#8fa9aa]">Financial changes are audited</p>
      </div>}
      <div className="border-t border-white/[.09] p-2">
        {sidebarCollapsed ? <button type="button" aria-label="Expand sidebar" title="Expand sidebar" onClick={() => setSidebarCollapsed(false)} className="grid h-10 w-full place-items-center rounded-lg text-[#c1d2d1] hover:bg-white/[.07]"><ChevronRight size={17} /></button> : <><div className="mb-2">{identityCard}</div><button type="button" aria-label="Collapse sidebar" onClick={() => setSidebarCollapsed(true)} className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-[9px] font-semibold text-[#9eb5b6] hover:bg-white/[.07]"><ChevronLeft size={14} />Collapse sidebar</button></>}
      </div>
    </aside>
    <div className="admin-main-column">
      <header className="sticky top-0 z-30 border-b border-[#dce5eb] bg-[#f7f9fb]/95 shadow-[0_2px_10px_rgba(16,47,77,.06)] backdrop-blur">
        <div className="flex min-h-[64px] items-center justify-between gap-3 px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button type="button" aria-label="Open admin navigation" aria-expanded={mobileMenuOpen} aria-controls="admin-mobile-navigation" onClick={() => setMobileMenuOpen(true)} data-testid="button-open-admin-navigation" className="rounded-md p-1.5 text-[#173b50] hover:bg-[#e8eff4] lg:hidden"><Menu size={18} /></button>
            <button type="button" aria-label={sidebarCollapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'} aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed(value => !value)} data-testid="button-toggle-admin-sidebar" className="hidden rounded-md p-2 text-[#173b50] hover:bg-[#e8eff4] lg:inline-flex"><Menu size={18} /></button>
            <div className="min-w-0"><p className="truncate text-[10px] text-[#859492]"><span className="hidden sm:inline">Globus Bank&nbsp; / &nbsp;</span><span className="font-semibold text-[#173b50]">{title}</span></p></div>
          </div>
          <div className="flex min-w-0 items-center gap-2.5">
            <AppLanguageSelector className="min-h-8" />
            {authorized && <div className="hidden items-center gap-1.5 rounded-full border border-[#dce7df] bg-[#f0f6f0] px-2.5 py-1.5 sm:flex"><ShieldCheck size={12} className="text-[#57816d]" /><span className="text-[9px] font-semibold text-[#557364]">Authorized</span></div>}
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#d7e3eb] bg-white text-[10px] font-bold text-[#173b50]">{initials}</div>
          </div>
        </div>
      </header>
      <main className="page-enter mx-auto w-full max-w-[1450px] min-w-0 px-3 py-4 sm:px-6 sm:py-6 xl:px-8">{children}</main>
    </div>
    {mobileMenuOpen && <div className="fixed inset-0 z-[60] lg:hidden">
      <button type="button" aria-label="Close admin navigation" className="absolute inset-0 bg-[#183640]/35 backdrop-blur-[1px]" onClick={() => setMobileMenuOpen(false)} />
      <aside id="admin-mobile-navigation" className="admin-sidebar absolute inset-y-0 left-0 flex w-[min(84vw,300px)] flex-col bg-[#102f4d] text-[#dbe8e5] shadow-2xl">
        <div className="flex h-[66px] items-center gap-3 border-b border-white/[.09] px-5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#d9c27f] text-[#173b49]"><span className="font-[family-name:var(--app-font-sans)] text-[19px] font-extrabold">G</span></div>
          <div className="leading-none"><p className="text-[15px] font-extrabold tracking-[-.06em] text-white">GLOBUS</p><p className="mt-1.5 text-[8px] font-bold tracking-[.22em] text-[#dfc87f]">BANK · OPERATIONS</p></div>
          <button type="button" aria-label="Close admin navigation" onClick={() => setMobileMenuOpen(false)} data-testid="button-close-admin-navigation" className="ml-auto rounded-md p-1.5 text-[#afc3c3] hover:bg-white/10"><X size={17} /></button>
        </div>
        <div className="mx-3.5 my-4 rounded-[10px] border border-white/[.09] bg-white/[.045] px-3 py-2.5"><p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#9fcec1]"><span className={`h-1.5 w-1.5 rounded-full ${authorized ? 'bg-[#7cc6aa]' : 'bg-[#c19c50]'}`} />{authorized ? 'Operations live' : 'Access protected'}</p><p className="mt-1 text-[10px] text-[#a9c0c1]">Administrative workspace</p></div>
        <p className="px-5 pb-2 text-[8px] font-bold uppercase tracking-[.17em] text-[#839fa4]">Workspace</p>
        {navContent(() => setMobileMenuOpen(false))}
        <div className="mx-3.5 mb-3 rounded-[9px] border border-white/[.08] bg-white/[.035] p-3"><div className="flex items-center gap-2 text-[#c7d6d4]"><ShieldCheck size={14} /><span className="text-[10px] font-semibold">Protected workspace</span></div><p className="mt-1.5 pl-[22px] text-[9px] text-[#8fa9aa]">Financial changes are audited</p></div>
        <div className="border-t border-white/[.09] p-3">{identityCard}</div>
      </aside>
    </div>}
  </div>;
}

function Overview() {
  const summary = useGetAdminSummary({ query: { queryKey: getGetAdminSummaryQueryKey(), retry: false } });
  const requests = useListAdminLedgerRequests(undefined, { query: { queryKey: getListAdminLedgerRequestsQueryKey() } });
  const recent = summary.data?.recentActions || [];
  const [testEmailPending, setTestEmailPending] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const sendTestTransactionAlert = async () => {
    if (testEmailPending || !window.confirm('Send a clearly labeled TEST ONLY transaction-alert email to offixiatoolz@gmail.com? This will not create or post a real transaction.')) return;
    setTestEmailPending(true);
    setTestEmailFeedback(null);
    try {
      const response = await fetch('/api/bank/admin/test-transaction-alert-email', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json().catch(() => ({})) as { sent?: boolean; recipient?: string; reference?: string; message?: string; error?: string };
      if (!response.ok || result.sent !== true) throw new Error(result.error || 'The test email request was not accepted.');
      setTestEmailFeedback({
        tone: 'success',
        text: `SMTP accepted the test email for ${result.recipient || 'the configured recipient'} (reference ${result.reference || 'not supplied'}). Check the inbox and spam folder; SMTP acceptance does not guarantee inbox delivery.`,
      });
    } catch (error) {
      setTestEmailFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'The test email could not be sent.' });
    } finally {
      setTestEmailPending(false);
    }
  };
  return <div data-testid="admin-operations-overview" className="min-w-0 w-full space-y-3"><div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><div className="min-w-0"><p className="text-[8px] font-bold uppercase tracking-[.17em] text-[#578b85]">Administrator workspace</p><h1 className="mt-0.5 text-[21px] font-extrabold tracking-[-.045em] text-[#1c3a47] sm:text-[25px]">Operations overview</h1><p className="mt-0.5 max-w-2xl text-[10px] leading-4 text-[#788b89]">Account activity, member accounts and decisions awaiting review.</p></div><div className="flex max-w-full flex-wrap gap-1.5"><button type="button" onClick={sendTestTransactionAlert} disabled={testEmailPending} data-testid="button-send-test-transaction-alert" className={`${quietButton} px-2.5 py-2 text-[9px]`}><Mail size={12} />{testEmailPending ? 'Sending test…' : 'Send test email'}</button><Link href="/admin/users" className={`${button} px-2.5 py-2 text-[9px]`}><Users size={12} />Manage members</Link></div></div>
    {testEmailFeedback && <p role={testEmailFeedback.tone === 'success' ? 'status' : 'alert'} className={`rounded-xl border p-3 text-[10px] leading-5 ${testEmailFeedback.tone === 'success' ? 'border-[#cfe3d7] bg-[#f0f8f2] text-[#356b55]' : 'border-[#f0d4cc] bg-[#fff7f3] text-[#9a5044]'}`}>{testEmailFeedback.text}</p>}
    {summary.isError && <InlineError text="Summary totals could not be loaded." retry={() => summary.refetch()} />}
    <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">{[
      ['Registered members', summary.data?.registeredUsers, Users, 'All member profiles'],
      ['Active accounts', summary.data?.activeAccounts, WalletCards, 'Currency wallets ready'],
      ['Restricted accounts', summary.data?.restrictedAccounts, LockKeyhole, 'Controls currently applied'],
      ['Suspended accounts', summary.data?.suspendedAccounts, Shield, 'Accounts not currently available'],
      ['Pending operations', summary.data?.pendingOperations, FileClock, 'Requests awaiting review'],
      ['Transactions', summary.data?.ledgerTransactions, Activity, 'Posted and pending records'],
    ].map(([label, value, Icon, hint]) => { const Mark = Icon as typeof Users; return <article key={String(label)} className={`${box} relative min-w-0 overflow-hidden rounded-xl p-2.5 sm:p-3.5`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#788b8d] sm:text-[10px] sm:tracking-[.1em]">{label as string}</p><p className="mt-1.5 font-mono text-[20px] font-semibold tracking-[-.06em] text-[#1f4050] sm:mt-1.5 sm:text-[24px]">{typeof value === 'number' ? value : '—'}</p><p className="mt-0.5 hidden text-[8px] text-[#89999a] sm:block">{hint as string}</p></div><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#eaf3ee] text-[#4e8281] sm:h-8 sm:w-8"><Mark size={13} /></span></div></article>; })}</div>
     <div className="grid min-w-0 gap-2 sm:grid-cols-2">
       <Panel title="Total credits" eyebrow="Totals by currency"><div className="divide-y divide-[#edf0ed]">{summary.data?.creditsByCurrency.length ? summary.data.creditsByCurrency.map(row => <div key={row.currency} className="flex items-center justify-between px-5 py-3"><span className="text-[10px] font-semibold text-[#687f82]">{row.currency}</span><strong className="font-mono text-[12px] text-[#365960]">{money(row.amount, row.currency)}</strong></div>) : <p className="px-5 py-6 text-[10px] text-[#829291]">No credits have been posted.</p>}</div></Panel>
       <Panel title="Total debits" eyebrow="Totals by currency"><div className="divide-y divide-[#edf0ed]">{summary.data?.debitsByCurrency.length ? summary.data.debitsByCurrency.map(row => <div key={row.currency} className="flex items-center justify-between px-5 py-3"><span className="text-[10px] font-semibold text-[#687f82]">{row.currency}</span><strong className="font-mono text-[12px] text-[#365960]">{money(row.amount, row.currency)}</strong></div>) : <p className="px-5 py-6 text-[10px] text-[#829291]">No debits have been posted.</p>}</div></Panel>
     </div>
    <div className="grid min-w-0 items-start gap-2.5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
        <Panel title="Withdrawal queue" eyebrow="Pending decisions" note="Select a member to review requests alongside their accounts, activity and restrictions." action={<Link href="/admin/users" className="text-[10px] font-bold text-[#478181]">Member directory <ArrowRight className="ml-1 inline" size={13} /></Link>}>
          {requests.isLoading ? <Skeleton /> : requests.isError ? <InlineError text="Pending withdrawals are unavailable." retry={() => requests.refetch()} /> : requests.data?.length ? <div className="divide-y divide-[#edf0ed]">{requests.data.slice(0, 6).map(r => <div key={r.id} className="flex flex-col items-start justify-between gap-2 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-5 sm:py-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Pill tone="warn">{r.type}</Pill><span className="font-mono text-[9px] text-[#89999a]">{r.reference}</span></div><p className="mt-2 truncate text-[11px] font-semibold">{r.memberName} · {r.email}</p><p className="mt-1 text-[9px] text-[#809194]">{dateTime(r.createdAt)} · {human(r.status)}</p></div><div className="flex w-full items-center justify-between gap-2 sm:w-auto"><strong className="text-[11px] sm:text-[12px]">{money(r.amount, r.currency)}</strong><Link data-testid={`link-open-member-funding-${r.id}`} href={`/admin/users/${r.userId}?tab=funding`} className={quietButton}>Review <ArrowRight size={12} /></Link></div></div>)}</div> : <Empty title="Queue is clear" text="New withdrawal requests will appear here." />}
      </Panel>
      <Panel title="Recent administrative activity" eyebrow="Traceability"><div className="divide-y divide-[#edf0ed]">{recent.length ? recent.slice(0, 7).map((row: AdminAuditLog) => <div key={row.id} className="px-5 py-3.5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] font-bold text-[#334d58]">{human(row.action)}</p><time className="text-[9px] text-[#829294]">{dateTime(row.createdAt)}</time></div><p className="mt-1 text-[10px] text-[#76898c]">{row.actorName} · {row.targetName}</p><p className="mt-1 line-clamp-2 text-[9px] leading-4 text-[#8a999a]">{row.reason}</p></div>) : <Empty title="No recent actions" text="Administrative changes will be recorded here." />}</div></Panel>
    </div>
    <div className={`${box} flex flex-wrap items-center justify-between gap-2 p-2.5 text-[9px] text-[#617b7d]`}><span className="flex items-center gap-3"><ShieldCheck size={16} className="text-[#4c8980]" /> Every change is attributable and recorded. Wallet activity is saved in Globus.</span></div>
  </div>;
}

function UsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [vaultStatus, setVaultStatus] = useState(() => new URLSearchParams(window.location.search).get('vault') || '');
  const params: ListAdminUsersParams = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status ? { accountStatus: status as ListAdminUsersParams['accountStatus'] } : {}),
    ...(vaultStatus ? { vaultSubscriptionStatus: vaultStatus as ListAdminUsersParams['vaultSubscriptionStatus'] } : {}),
    page, limit: 25,
  }), [search, page, status, vaultStatus]);
  const users = useListAdminUsers(params, { query: { queryKey: getListAdminUsersQueryKey(params) } });
  const summary = useGetAdminSummary({ query: { queryKey: getGetAdminSummaryQueryKey(), retry: false } });
  const recentParams: ListAdminTransactionsParams = { page: 1, pageSize: 4 };
  const recentTransactions = useListAdminTransactions(recentParams, { query: { queryKey: getListAdminTransactionsQueryKey(recentParams) } });
  const metrics = [
    { label: 'Total members', value: summary.data?.registeredUsers ?? users.data?.total, icon: Users },
    { label: 'Pending operations', value: summary.data?.pendingOperations, icon: FileClock },
    { label: 'Active accounts', value: summary.data?.activeAccounts, icon: WalletCards },
    { label: 'Ledger transactions', value: summary.data?.ledgerTransactions, icon: Activity },
  ];

  return <div data-testid="admin-member-directory" className="min-w-0 w-full space-y-3">
    <header className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <div className="min-w-0"><p className="text-[8px] font-bold uppercase tracking-[.17em] text-[#578b85]">Customer operations</p><h1 className="mt-0.5 text-[21px] font-extrabold tracking-[-.045em] text-[#1c3a47] sm:text-[25px]">Member directory</h1><p className="mt-0.5 text-[10px] text-[#788b89]">Member profiles, account standing and access controls.</p></div>
      <Link data-testid="link-open-admin-funding" href="/admin/funding" className={`${button} px-2.5 py-2 text-[9px]`}><Banknote size={12} />Funding</Link>
    </header>
    {summary.isError && <InlineError text="Workspace totals could not be loaded." retry={() => summary.refetch()} />}
    <section aria-label="Member and account totals" className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-4">
      {metrics.map(({ label, value, icon: Icon }) => <article key={label} data-testid={`admin-metric-${label.toLowerCase().replaceAll(' ', '-')}`} className="min-w-0 rounded-[10px] border border-[#e0e8e2] bg-[#fffefa] px-2.5 py-2 shadow-[0_2px_8px_rgba(35,65,62,.025)] sm:px-3 sm:py-2.5"><div className="flex min-w-0 items-center justify-between gap-1"><span className="truncate text-[8px] font-semibold text-[#82918d]">{label}</span><Icon size={12} className="shrink-0 text-[#82a19a]" /></div><strong className="mt-1 block truncate font-mono text-[18px] font-semibold tracking-[-.04em] text-[#24424b] sm:text-[20px]">{typeof value === 'number' ? value.toLocaleString() : '—'}</strong></article>)}
    </section>
    <div className="grid min-w-0 items-start gap-2.5 xl:grid-cols-[minmax(0,1fr)_230px]">
      <section data-testid="admin-members-panel" className="min-w-0 overflow-hidden rounded-[12px] border border-[#dfe8e2] bg-[#fffefa] shadow-[0_3px_12px_rgba(35,65,62,.035)]">
        <div className="flex min-w-0 items-center justify-between gap-2 border-b border-[#e9eeea] px-3 py-2.5"><div className="min-w-0"><div className="flex items-center gap-1.5"><h2 className="text-[12px] font-bold text-[#29434a]">Customer records</h2><span data-testid="admin-member-total" className="rounded-full bg-[#eef3ef] px-1.5 py-0.5 text-[8px] font-semibold text-[#70827e]">{users.data?.total ?? '—'}</span></div><p className="mt-0.5 truncate text-[8px] text-[#879592]">Identity, account standing and access · phone details masked</p></div><span className="shrink-0 text-[8px] text-[#879592]">Newest first</span></div>
        <div className="grid min-w-0 grid-cols-2 gap-1.5 border-b border-[#e9eeea] bg-[#f8faf6] p-2 sm:grid-cols-[minmax(0,1fr)_minmax(130px,170px)_minmax(140px,180px)]">
          <label className="relative col-span-2 min-w-0 sm:col-span-1"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a9a9b]" /><input data-testid="input-admin-member-search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className={`${input} h-8 min-w-0 pl-8 text-[10px]`} placeholder="Name, email or Customer ID" /></label>
          <select data-testid="select-admin-account-status" aria-label="Filter by account state" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className={`${input} h-8 min-w-0 px-2 text-[9px]`}><option value="">All account states</option><option value="active">Active</option><option value="restricted">Restricted</option><option value="suspended">Suspended</option></select>
          <select data-testid="select-admin-vault-status" aria-label="Filter by Private Vault access" value={vaultStatus} onChange={e => { setVaultStatus(e.target.value); setPage(1); }} className={`${input} h-8 min-w-0 px-2 text-[9px]`}><option value="">All Vault access</option><option value="pending">Legacy pending</option><option value="active">Active Vault</option><option value="expired">Expired Vault</option><option value="rejected">Declined legacy</option><option value="inactive">No subscription</option></select>
        </div>
        {users.isLoading ? <Skeleton rows={5} /> : users.isError ? <InlineError text="Member records could not be loaded." retry={() => users.refetch()} /> : users.data?.items.length ? <>
          <div data-testid="admin-member-card-grid" className="grid min-w-0 grid-cols-1 gap-2 p-2 sm:grid-cols-2 xl:grid-cols-3">
            {users.data.items.map(member => {
              return <article key={member.id} data-testid={`row-admin-member-${member.id}`} data-member-card-rows="2" className="min-w-0 overflow-hidden rounded-[10px] border border-[#e4ebe5] bg-white p-2.5 shadow-[0_1px_5px_rgba(35,65,62,.025)]">
                <div className="flex min-w-0 items-center gap-2"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e6f0e9] text-[9px] font-bold text-[#47755e]">{[member.firstName?.[0], member.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'G'}</div><div className="min-w-0 flex-1"><Link href={`/admin/users/${encodeURIComponent(member.id)}`} className="block truncate text-[10px] font-bold text-[#344c51] hover:text-[#2f675f] hover:underline">{nameOf(member)}</Link><p className="break-all text-[8px] leading-3 text-[#899793]">{member.email}</p><p className="truncate font-mono text-[7px] text-[#96a29e]">{member.customerId || 'No Customer ID'}</p></div><Link href={`/admin/users/${encodeURIComponent(member.id)}`} aria-label="Open record" className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#dbe4e5] px-2 py-1.5 text-[8px] font-semibold text-[#425d69]">Open<ArrowRight size={10} /></Link></div>
                <div className="mt-2 grid min-w-0 grid-cols-2 gap-x-2 gap-y-1.5 border-t border-[#edf1ed] pt-2"><div className="min-w-0"><p className="text-[7px] font-bold uppercase tracking-[.08em] text-[#8a9995]">Account</p><div className="mt-0.5"><StatusPill status={member.accountStatus} /></div></div><div className="min-w-0"><p className="text-[7px] font-bold uppercase tracking-[.08em] text-[#8a9995]">Tier</p><p data-testid={`member-account-tier-${member.id}`} className="mt-0.5 truncate text-[8px] font-semibold text-[#4a6565]">{member.accountTierName}</p></div></div>

              </article>;
            })}
          </div>
          <Pager page={page} pages={Math.ceil(users.data.total / Math.max(1, users.data.pageSize))} onChange={setPage} />
        </> : <Empty title="No members match" text="Try another name, email, Customer ID, or access filter." />}
      </section>
      <aside className="min-w-0 space-y-2">
        <section data-testid="admin-recent-ledger" className="min-w-0 overflow-hidden rounded-[12px] border border-[#dfe8e2] bg-[#fffefa] shadow-[0_3px_12px_rgba(35,65,62,.035)]">
          <div className="flex min-w-0 items-start justify-between gap-2 border-b border-[#e9eeea] px-3 py-2.5"><div className="min-w-0"><h2 className="text-[11px] font-bold text-[#29434a]">Recent ledger activity</h2><p className="mt-0.5 text-[8px] text-[#879592]">Latest recorded transactions</p></div><Link data-testid="link-view-admin-transactions" href="/admin/transactions" className="shrink-0 text-[8px] font-bold text-[#52857c]">View all</Link></div>
          {recentTransactions.isLoading ? <Skeleton rows={3} /> : recentTransactions.isError ? <div className="p-3"><InlineError text="Recent transactions could not be loaded." retry={() => recentTransactions.refetch()} /></div> : recentTransactions.data?.items.length ? <div className="divide-y divide-[#edf1ed]">{recentTransactions.data.items.map(transaction => <article key={transaction.id} data-testid={`recent-ledger-${transaction.id}`} className="flex min-w-0 items-center gap-2 px-3 py-2"><div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#e8f2eb] text-[#57816a]"><Activity size={12} /></div><div className="min-w-0 flex-1"><p className="truncate text-[8px] font-bold text-[#425958]">{transaction.description || human(transaction.type)}</p><p className="truncate text-[7px] text-[#899793]">{transaction.counterparty || transaction.reference}</p><div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1"><StatusPill status={transaction.status} /><time className="text-[7px] text-[#a0aaa6]">Customer date {customerTransactionDate(transaction.transactionDate, transaction.createdAt)}</time></div></div><span className="shrink-0 text-[8px] font-bold text-[#4b8067]">{money(transaction.amount, transaction.currency)}</span></article>)}</div> : <Empty title="No ledger activity" text="New transaction records will appear here." />}
          <Link href="/admin/transactions" className="block w-full border-t border-[#e9eeea] py-2 text-center text-[8px] font-semibold text-[#63827b]">Open transaction management</Link>
        </section>
        <section className="rounded-[10px] border border-[#e4e9df] bg-[#f7f8f0] px-3 py-2.5"><div className="flex items-center gap-2"><ShieldCheck size={13} /><p className="text-[9px] font-bold text-[#4b6158]">Protected operations</p></div><p className="mt-1.5 text-[8px] leading-[1.5] text-[#75857c]">Review member context and active restrictions before changing access. Administrative changes are recorded in the audit log.</p><Link data-testid="link-review-admin-audit" href="/admin/audit" className="mt-1.5 inline-flex text-[8px] font-bold text-[#63806e] hover:underline">Review audit log</Link></section>
      </aside>
    </div>
  </div>;
}
function MemberDetail({ userId }: { userId: string }) {
  const client = useQueryClient();
  const detail = useGetAdminUserDetail(userId, { query: { queryKey: getGetAdminUserDetailQueryKey(userId), enabled: !!userId } });
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'transactions' | 'funding' | 'wallets' | 'restrictions'>(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    return ['accounts', 'transactions', 'funding', 'wallets', 'restrictions'].includes(requestedTab || '')
      ? requestedTab as 'accounts' | 'transactions' | 'funding' | 'wallets' | 'restrictions'
      : 'overview';
  });
  const u = detail.data?.user;
  const [memberNavOpen, setMemberNavOpen] = useState(false);
  const statusMutation = useUpdateAdminUserStatus(); const profileMutation = useUpdateAdminUserProfile(); const accessControlsMutation = useUpdateAdminUserAccessControls(); const accountTierMutation = useAssignAdminUserAccountTier(); const pinMutation = useResetAdminUserTransactionPin(); const passwordMutation = useResetAdminUserPassword(); const vaultSubscriptionMutation = useUpdateAdminUserVaultSubscription();
  const [modal, setModal] = useState<'status' | 'profile' | 'pin' | 'password-reset' | 'vault-subscription' | null>(null);
  const [form, setForm] = useState({ reason: '', notes: '', transactionPin: '', firstName: '', lastName: '', address: '', phone: '', country: '', cityOfOrigin: '', dateOfBirth: '', occupation: '', decision: 'approved', userMessage: '', confirmed: false, expiresAt: '' });
  const [testingModeDisabled, setTestingModeDisabled] = useState(false);
  const [transferAccessGranted, setTransferAccessGranted] = useState(false);
  const [supportAccessGranted, setSupportAccessGranted] = useState(false);
  const [accessControlsPin, setAccessControlsPin] = useState('');
  const [accessControlsConfirmed, setAccessControlsConfirmed] = useState(false);
  const [accessControlsError, setAccessControlsError] = useState('');
  const [accountTierSelection, setAccountTierSelection] = useState<AccountTierSelection>('default');
  const [accountTierPin, setAccountTierPin] = useState('');
  const [accountTierConfirmed, setAccountTierConfirmed] = useState(false);
  const [accountTierError, setAccountTierError] = useState('');
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const [vaultResetBusy, setVaultResetBusy] = useState(false);
  const [vaultResetError, setVaultResetError] = useState('');
  const [eraseConfirmation, setEraseConfirmation] = useState('');
  const [eraseReason, setEraseReason] = useState('');
  const [eraseBusy, setEraseBusy] = useState(false);
  const [eraseError, setEraseError] = useState('');
  useEffect(() => {
    if (!detail.data) return;
    setTestingModeDisabled(detail.data.user.testingModeDisabled);
    setTransferAccessGranted(detail.data.user.transferAccessGranted);
    setSupportAccessGranted(detail.data.user.supportAccessGranted ?? false);
    setAccountTierSelection(detail.data.user.adminAccountTier ?? 'default');
  }, [detail.data?.user.testingModeDisabled, detail.data?.user.transferAccessGranted, detail.data?.user.supportAccessGranted, detail.data?.user.adminAccountTier]);
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: getGetAdminUserDetailQueryKey(userId) }), client.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }), client.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() })]); };
  const open = (kind: typeof modal) => { if (kind === 'profile' && detail.data) setForm({ ...form, firstName: u?.firstName || '', lastName: u?.lastName || '', address: detail.data.address || '', phone: detail.data.phone || '', country: u?.country || '', cityOfOrigin: detail.data.cityOfOrigin || '', dateOfBirth: detail.data.dateOfBirth || '', occupation: detail.data.occupation || '', transactionPin: '', confirmed: false }); else if (kind === 'status') setForm({ ...form, transactionPin: '', decision: u?.accountStatus === 'active' ? 'suspended' : 'active', confirmed: false }); else if (kind === 'vault-subscription') setForm({ ...form, decision: 'inactive', confirmed: false }); else setForm({ ...form, transactionPin: '', confirmed: false }); setError(''); setModal(kind); };
  const submit = async (e: FormEvent) => { e.preventDefault(); if (!u || !modal) return; setError(''); try {
    let successMessage = 'Change saved and added to administrative history.';
    if (modal === 'status') await statusMutation.mutateAsync({ userId, data: { accountStatus: form.decision as 'active' | 'restricted' | 'suspended' } });
    if (modal === 'profile') await profileMutation.mutateAsync({ userId, data: { firstName: form.firstName.trim(), lastName: form.lastName.trim(), address: form.address.trim() || null, phone: form.phone.trim(), country: form.country.trim(), cityOfOrigin: form.cityOfOrigin.trim(), dateOfBirth: form.dateOfBirth || null, occupation: form.occupation.trim(), transactionPin: form.transactionPin } });
    if (modal === 'pin') await pinMutation.mutateAsync({ userId, data: {} });
    if (modal === 'password-reset') {
      const result = await passwordMutation.mutateAsync({ userId, data: { confirmed: true } });
      successMessage = result.emailSent
        ? `Password reset required. ${result.sessionsRevoked} active session(s) ended. A secure recovery link was sent to the member’s registered email.`
        : `Password reset required and ${result.sessionsRevoked} active session(s) ended, but the recovery email could not be sent. The reset requirement remains active.`;
    }
    if (modal === 'vault-subscription') {
      await vaultSubscriptionMutation.mutateAsync({
        userId,
        data: { status: 'inactive' },
      });
      successMessage = 'Private Vault access removed and recorded.';
    }
    await refresh(); setMessage(successMessage); setModal(null);
  } catch (err) { setError(err instanceof Error ? err.message : 'The requested change could not be saved.'); } };
  const saveAccessControls = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccessControlsError('');
    if (accessControlsPin.length !== 6 || !accessControlsConfirmed) {
      setAccessControlsError('Enter your six-digit transaction PIN and confirm the customer-specific change.');
      return;
    }
    try {
      await accessControlsMutation.mutateAsync({
        userId,
        data: {
          testingModeDisabled,
          transferAccessGranted,
          supportAccessGranted,
          transactionPin: accessControlsPin,
          confirmed: true,
        },
      });
      setAccessControlsPin('');
      setAccessControlsConfirmed(false);
      await refresh();
      setMessage('Customer access controls saved and recorded.');
    } catch (err) {
      setAccessControlsError(err instanceof Error ? err.message : 'Access controls could not be saved.');
    }
  };
  const saveAccountTier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountTierError('');
    if (accountTierPin.length !== 6 || !accountTierConfirmed) {
      setAccountTierError('Enter your six-digit transaction PIN and confirm the tier change.');
      return;
    }
    try {
      const result = await accountTierMutation.mutateAsync({
        userId,
        data: {
          adminAccountTier: accountTierSelection === 'default' ? null : accountTierSelection,
          transactionPin: accountTierPin,
          confirmed: true,
        },
      });
      setAccountTierPin('');
      setAccountTierConfirmed(false);
      setAccountTierSelection(result.adminAccountTier ?? 'default');
      await refresh();
      setMessage(`Account tier updated to ${result.accountTierName}.`);
    } catch (err) {
      setAccountTierError(err instanceof Error ? err.message : 'The account tier could not be updated.');
    }
  };

  const sendVaultResetLink = async () => {
    if (!u || vaultResetBusy) return;
    if (!window.confirm(`Send a 30-minute Private Vault passcode reset link to ${u.email}?`)) return;
    setVaultResetBusy(true);
    setVaultResetError('');
    try {
      const response = await fetch(`/api/bank/admin/users/${encodeURIComponent(userId)}/vault-passcode-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirmed: true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'The reset link could not be sent.');
      setMessage('A one-time Private Vault passcode reset link was sent to the customer’s verified primary email. It expires in 30 minutes. Vault access status was not changed.');
    } catch (err) {
      setVaultResetError(err instanceof Error ? err.message : 'The reset link could not be sent.');
    } finally {
      setVaultResetBusy(false);
    }
  };

  const eraseCustomerData = async () => {
    if (!u || eraseBusy || eraseConfirmation !== 'DELETE' || eraseReason.trim().length < 10) return;
    setEraseBusy(true);
    setEraseError('');
    try {
      const response = await fetch(`/api/bank/admin/users/${encodeURIComponent(userId)}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirmation: 'DELETE', reason: eraseReason.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Customer data erasure could not be completed.');
      if (result.pending) {
        await refresh();
        throw new Error(typeof result.error === 'string' ? result.error : 'Customer data erasure is pending. Resolve the reported cleanup step and retry.');
      }
      setMessage('Customer application data was erased. Required financial and audit records may remain in pseudonymous form.');
      setEraseConfirmation('');
      setEraseReason('');
      await refresh();
      window.location.assign('/admin/users');
    } catch (err) {
      setEraseError(err instanceof Error ? err.message : 'Customer data erasure could not be completed.');
    } finally {
      setEraseBusy(false);
    }
  };

  if (detail.isLoading) return <><Heading kicker="Member management" title="Loading member record" subtitle="Fetching the authorized account record." /><div className={box}><Skeleton /></div></>;
  if (detail.isError || !detail.data || !u) return <><Heading kicker="Member management" title="Member record unavailable" subtitle="The member record could not be loaded." /><InlineError text="Try loading this member record again." retry={() => detail.refetch()} /></>;
  const fullName = nameOf(u);
  const memberTabs = [
    { id: 'overview', label: 'Profile & security', icon: Users },
    { id: 'accounts', label: 'Accounts', icon: WalletCards },
    { id: 'transactions', label: 'Transactions', icon: Activity },
    { id: 'funding', label: 'Funding & requests', icon: Banknote },
    { id: 'wallets', label: 'Wallet controls', icon: LockKeyhole },
    { id: 'restrictions', label: 'Restrictions', icon: Shield },
  ] as const;
  return <div className="flex h-full min-h-0 flex-col overflow-hidden">
     <header className="mb-3 shrink-0 rounded-xl border border-[#dce6e0] bg-[#fbfcf8] shadow-sm">
       <div className="flex min-w-0 items-center gap-3 px-3 py-2.5 sm:px-4">
         <Link href="/admin/users" data-testid="link-back-member-directory" className="inline-flex shrink-0 items-center gap-1.5 text-[9px] font-bold text-[#54777b]"><ArrowLeft size={13} />Members</Link>
         <div className="h-5 w-px shrink-0 bg-[#dce6e0]" />
         <div className="min-w-0 flex-1"><p className="truncate text-[8px] font-bold uppercase tracking-[.15em] text-[#4f8888]">Customer management · {u.customerId || 'Customer ID unavailable'}</p><h1 className="truncate text-[15px] font-extrabold tracking-[-.025em] text-[#203b4c] sm:text-[18px]">{fullName}</h1><p className="truncate text-[9px] text-[#71858b]">{u.email}</p></div>
         <div className="hidden shrink-0 gap-1.5 sm:flex"><StatusPill status={u.accountStatus} /><StatusPill status={u.vaultSubscriptionStatus || 'inactive'} /></div>
         <button type="button" aria-expanded={memberNavOpen} aria-controls="member-management-navigation" onClick={() => setMemberNavOpen(value => !value)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#dce6e0] bg-white text-[#315a68] hover:bg-[#edf4ef] lg:hidden" aria-label={memberNavOpen ? 'Close customer navigation' : 'Open customer navigation'}>{memberNavOpen ? <X size={17} /> : <Menu size={17} />}</button>
       </div>
       <div className="flex items-center justify-between gap-2 border-t border-[#e9eeea] px-3 py-1.5 sm:hidden"><StatusPill status={u.accountStatus} /><StatusPill status={u.vaultSubscriptionStatus || 'inactive'} /><span className="text-[8px] font-semibold text-[#849493]">Audited customer record</span></div>
     </header>
     {message && <p role="status" data-testid="status-member-management" className="mb-2 shrink-0 rounded-lg border border-[#cfe4d7] bg-[#eef7f0] px-3 py-2 text-[10px] text-[#47755e]">{message}</p>}
     <section aria-label="Quick member controls" className="mb-3 shrink-0 rounded-xl border border-[#dce6e0] bg-[#fbfcf8] p-2.5">
       <div className="mb-2 flex items-center justify-between gap-2"><p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#4f8888]">Quick controls</p><span className="text-[8px] font-semibold text-[#849493]">PIN-protected · audited</span></div>
       <div className="grid grid-cols-5 gap-1">
         <button type="button" onClick={() => open('profile')} className="flex min-h-[42px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-[#e0e9e3] bg-white px-0.5 py-1 text-center text-[7px] font-semibold leading-tight text-[#49666c] hover:bg-[#eef5ef]"><Users size={12} />Edit profile</button>
         <button type="button" onClick={() => open('status')} className="flex min-h-[42px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-[#e0e9e3] bg-white px-0.5 py-1 text-center text-[7px] font-semibold leading-tight text-[#49666c] hover:bg-[#eef5ef]"><Shield size={12} />{u.accountStatus === 'active' ? 'Restrict' : 'Restore'}</button>
         <button type="button" onClick={() => open('pin')} className="flex min-h-[42px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-[#e0e9e3] bg-white px-0.5 py-1 text-center text-[7px] font-semibold leading-tight text-[#49666c] hover:bg-[#eef5ef]"><LockKeyhole size={12} />Reset PIN</button>
         <button type="button" onClick={() => open('password-reset')} className="flex min-h-[42px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-[#e0e9e3] bg-white px-0.5 py-1 text-center text-[7px] font-semibold leading-tight text-[#49666c] hover:bg-[#eef5ef]"><KeyRound size={12} />Password reset</button>
         <button type="button" onClick={() => void sendVaultResetLink()} disabled={vaultResetBusy} className="flex min-h-[42px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-[#e0e9e3] bg-white px-0.5 py-1 text-center text-[7px] font-semibold leading-tight text-[#49666c] hover:bg-[#eef5ef] disabled:opacity-50"><ShieldCheck size={12} />{vaultResetBusy ? 'Sending…' : 'Vault reset'}</button>
         <button type="button" onClick={() => open('vault-subscription')} className="flex min-h-[42px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-[#e0e9e3] bg-white px-0.5 py-1 text-center text-[7px] font-semibold leading-tight text-[#49666c] hover:bg-[#eef5ef]"><LockKeyhole size={12} />Remove Vault</button>
         <button type="button" onClick={() => document.getElementById('member-account-tier')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex min-h-[42px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-[#e0e9e3] bg-white px-0.5 py-1 text-center text-[7px] font-semibold leading-tight text-[#49666c] hover:bg-[#eef5ef]"><WalletCards size={12} />Account tier</button>
         <button type="button" onClick={() => document.getElementById('member-access-controls')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex min-h-[42px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-[#e0e9e3] bg-white px-0.5 py-1 text-center text-[7px] font-semibold leading-tight text-[#49666c] hover:bg-[#eef5ef]"><Settings2 size={12} />Access rules</button>
         <button type="button" onClick={() => setActiveTab('transactions')} className="flex min-h-[42px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-[#e0e9e3] bg-white px-0.5 py-1 text-center text-[7px] font-semibold leading-tight text-[#49666c] hover:bg-[#eef5ef]"><Activity size={12} />Activity</button>
         <button type="button" onClick={() => setActiveTab('restrictions')} className="flex min-h-[42px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-[#e0e9e3] bg-white px-0.5 py-1 text-center text-[7px] font-semibold leading-tight text-[#49666c] hover:bg-[#eef5ef]"><ShieldCheck size={12} />Restrictions</button>
       </div>
       {vaultResetError && <p role="alert" className="mt-2 text-[9px] text-[#a45247]">{vaultResetError}</p>}
     </section>
     <div role="tabpanel" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pr-1">
       {activeTab === 'overview' && <div className="space-y-3 pb-3">
         <div className="grid items-start gap-3 xl:grid-cols-[1.25fr_.75fr]">
             <Panel title="Member profile" eyebrow="Account record" action={<StatusPill status={u.accountStatus} />}><dl className="grid gap-x-5 gap-y-3 p-4 sm:grid-cols-3">{[['Email', u.email], ['Address', detail.data.address || 'Missing'], ['Phone', detail.data.phone || 'Not provided'], ['Country / region', u.country || 'Not provided'], ['City of origin', detail.data.cityOfOrigin || 'Missing'], ['Date of birth', detail.data.dateOfBirth || 'Missing'], ['Occupation / employment', detail.data.occupation || 'Missing'], ['Customer ID', u.customerId || '—'], ['Profile setup', detail.data.profileSetupCompletedAt ? `Complete · ${dateTime(detail.data.profileSetupCompletedAt)}` : 'Missing'], ['Testing mode', detail.data.testingModeDisabled ? 'Off' : 'On'], ['Transfer access', detail.data.transferAccessGranted ? 'Granted' : 'Not granted'], ['Support access', detail.data.supportAccessGranted ? 'Granted' : 'Not granted'], ['Wallet count', String(u.walletCount)], ['Total transactions', String(detail.data.transactionCount)], ['Restriction reason', u.accountRestrictionReason || '—']].map(([k, v]) => <div key={k}><dt className="text-[8px] font-bold uppercase tracking-[.12em] text-[#849493]">{k}</dt><dd data-testid={k === 'Address' ? 'admin-member-address' : undefined} className="mt-1 break-words text-[10px] font-semibold text-[#405b63]">{v}</dd></div>)}</dl></Panel>
         </div>
          <div id="member-account-tier" className="scroll-mt-3"><Panel title="Account tier" eyebrow="Customer classification">
            <form data-testid="admin-account-tier-form" onSubmit={saveAccountTier} className="grid gap-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e3eae5] bg-[#f9fbf7] p-3">
                <div>
                  <p className="text-[9px] font-semibold text-[#425d69]">Current effective tier</p>
                  <p className="mt-1 text-[10px] font-bold text-[#2c4b56]">{u.accountTierName}</p>
                  <p className="mt-1 text-[8px] text-[#849493]">Source: {human(u.accountTierSource)}</p>
                </div>
                <Pill tone={u.accountTierSource === 'default' ? 'neutral' : 'good'}>{u.accountTierName}</Pill>
              </div>
              <Field label="Administrator-assigned base tier">
                <select data-testid="select-admin-member-account-tier" value={accountTierSelection} onChange={event => setAccountTierSelection(event.target.value as AccountTierSelection)} className={input}>
                  {accountTierChoices.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
                </select>
              </Field>
              <p className="text-[9px] leading-4 text-[#718588]">An active paid Vault plan takes priority. The assigned tier applies after paid access ends; it does not grant Vault access or administrator privileges. Authorized administrators can assign their own customer-profile tier too.</p>
              <Field label="Your six-digit transaction PIN">
                <input data-testid="input-admin-tier-pin" required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={accountTierPin} onChange={event => setAccountTierPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={input} autoComplete="current-password" />
              </Field>
              <label className="flex items-start gap-2 text-[9px] leading-4 text-[#657a7e]">
                <input data-testid="checkbox-admin-tier-confirmed" type="checkbox" checked={accountTierConfirmed} onChange={event => setAccountTierConfirmed(event.target.checked)} className="mt-0.5 accent-[#43898a]" />
                <span>I confirm this changes only the customer’s account tier, not Vault access or admin permissions.</span>
              </label>
              {accountTierError && <p role="alert" data-testid="error-admin-account-tier" className="rounded-lg bg-[#fff1ef] px-3 py-2 text-[10px] text-[#a24940]">{accountTierError}</p>}
              <button data-testid="button-save-admin-account-tier" type="submit" disabled={accountTierMutation.isPending || accountTierPin.length !== 6 || !accountTierConfirmed} className={button}>{accountTierMutation.isPending ? 'Saving tier…' : 'Save account tier'}</button>
            </form>
          </Panel></div>

          <Panel title="Private Vault passcode recovery" eyebrow="Credential reset only">
            <div className="space-y-3 p-4 sm:p-5">
              <p className="text-[10px] leading-5 text-[#718588]">Send a single-use reset link to the customer’s verified primary email. The link expires after 30 minutes. Completing the reset changes only the passcode credential and lockout counters; it does not grant, revoke, activate, suspend, or otherwise change Private Vault access or subscription status.</p>
              {vaultResetError && <p role="alert" className="rounded-lg bg-[#fff1ef] px-3 py-2 text-[10px] text-[#a24940]">{vaultResetError}</p>}
              <p className="text-[9px] font-semibold text-[#718588]">Use the single Vault reset action in the quick controls above.</p>
            </div>
          </Panel>
          <Panel title="Permanent customer data erasure" eyebrow="Destructive · administrator only">
            <div className="space-y-3 p-4 sm:p-5">
              <p className="text-[10px] leading-5 text-[#945246]">This removes the customer's profile details, saved payment methods, personal finance records, notifications, push subscriptions, Vault credentials, reset tokens, sessions, and support conversations. Uploaded identity and Vault proof objects are removed through the configured private object-storage adapter before the Clerk identity is removed; if storage cleanup is unavailable, the request remains pending. Financial ledger and transfer evidence may be retained where law, accounting, dispute, or fraud rules require it.</p>
              <Field label="Reason for erasure (10–500 characters)">
                <textarea className={input + ' min-h-[76px] py-2'} value={eraseReason} onChange={event => setEraseReason(event.target.value)} maxLength={500} placeholder="Record the authorized deletion request and reason." />
              </Field>
              <Field label="Type DELETE to confirm">
                <input className={input} value={eraseConfirmation} onChange={event => setEraseConfirmation(event.target.value)} autoComplete="off" placeholder="DELETE" />
              </Field>
              {eraseError && <p role="alert" className="rounded-lg bg-[#fff1ef] px-3 py-2 text-[10px] text-[#a24940]">{eraseError}</p>}
              <button type="button" onClick={eraseCustomerData} disabled={eraseBusy || eraseConfirmation !== 'DELETE' || eraseReason.trim().length < 10} className="inline-flex items-center justify-center rounded-[9px] bg-[#a33e35] px-4 py-2.5 text-[11px] font-bold text-white disabled:opacity-50">{eraseBusy ? 'Erasing customer data…' : 'Permanently erase customer data'}</button>
            </div>
          </Panel>
          <div id="member-access-controls" className="scroll-mt-3"><Panel title="Customer access controls" eyebrow="Independent from Private Vault">
            <form data-testid="admin-access-control-form" onSubmit={saveAccessControls} className="grid gap-3 p-4 sm:p-5">
              <label className="flex items-start gap-2 rounded-xl border border-[#e3eae5] bg-[#f9fbf7] p-3 text-[10px] leading-4 text-[#526b70]">
                <input data-testid="checkbox-testing-mode-disabled" type="checkbox" checked={testingModeDisabled} onChange={event => setTestingModeDisabled(event.target.checked)} className="mt-0.5 accent-[#43898a]" />
                <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2"><span><strong className="block text-[#3c5960]">Turn off Testing Mode</strong>Does not grant Private Vault access.</span><Pill tone={testingModeDisabled ? 'good' : 'warn'}>{testingModeDisabled ? 'Off' : 'On'}</Pill></span>
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-[#e3eae5] bg-[#f9fbf7] p-3 text-[10px] leading-4 text-[#526b70]">
                <input data-testid="checkbox-transfer-access-granted" type="checkbox" checked={transferAccessGranted} onChange={event => setTransferAccessGranted(event.target.checked)} className="mt-0.5 accent-[#43898a]" />
                <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2"><span><strong className="block text-[#3c5960]">Grant separate transfer access</strong>Bypasses Vault subscription, the transfer toggle, and outgoing-transfer restriction. Account suspension, wallet freezes, transaction PIN, balance checks, and explicit pending/failed posting modes still apply.</span><Pill tone={transferAccessGranted ? 'good' : 'neutral'}>{transferAccessGranted ? 'Granted' : 'Not granted'}</Pill></span>
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-[#e3eae5] bg-[#f9fbf7] p-3 text-[10px] leading-4 text-[#526b70]">
                <input data-testid="checkbox-support-access-granted" type="checkbox" checked={supportAccessGranted} onChange={event => setSupportAccessGranted(event.target.checked)} className="mt-0.5 accent-[#43898a]" />
                <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2"><span><strong className="block text-[#3c5960]">Grant dedicated support access</strong>Allows this customer to open and reply to Private Vault and transfer-recipient support threads without an active Vault subscription.</span><Pill tone={supportAccessGranted ? 'good' : 'neutral'}>{supportAccessGranted ? 'Granted' : 'Not granted'}</Pill></span>
              </label>
              <Field label="Your six-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={accessControlsPin} onChange={event => setAccessControlsPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={input} autoComplete="current-password" /></Field>
              <label className="flex items-start gap-2 text-[10px] text-[#657a7e]"><input data-testid="checkbox-access-controls-confirmed" type="checkbox" checked={accessControlsConfirmed} onChange={event => setAccessControlsConfirmed(event.target.checked)} className="mt-0.5 accent-[#43898a]" />I confirm these settings apply only to this customer.</label>
              {accessControlsError && <p role="alert" className="rounded-lg bg-[#fff1ef] px-3 py-2 text-[10px] text-[#a24940]">{accessControlsError}</p>}
              <button type="submit" disabled={accessControlsMutation.isPending || accessControlsPin.length !== 6 || !accessControlsConfirmed} className={button}>{accessControlsMutation.isPending ? 'Saving controls…' : 'Save access controls'}</button>
            </form>
          </Panel></div>
         <div className="grid items-start gap-3 xl:grid-cols-2">
           <Panel title="Transaction PIN" eyebrow="Account security"><div className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-[9px] leading-4 text-[#718588]">PIN values are never visible to administrators.</p><p className="mt-1 text-[9px] font-semibold">Status: {detail.data.transactionPinConfigured ? 'Configured' : 'Not configured'}</p></div><span className="text-[9px] font-semibold text-[#82918f]">Use Quick controls above</span></div></Panel>
           <Panel title="Password access" eyebrow="Account security"><div className="flex flex-wrap items-center justify-between gap-3 p-4"><p className="max-w-lg text-[9px] leading-4 text-[#718588]">A reset ends active sessions and emails a secure recovery link. Administrators never view or assign passwords.</p><span className="text-[9px] font-semibold text-[#82918f]">Use Quick controls above</span></div></Panel>
         </div>
            <Panel title="Private Vault access" eyebrow="Paystack-confirmed access" action={<StatusPill status={u.vaultSubscriptionStatus || 'inactive'} />}><div className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0 text-[9px] leading-4 text-[#718588]"><p>{u.vaultSubscriptionStatus === 'pending' ? 'Legacy manual request: the member must start Paystack checkout; administrators cannot approve it.' : u.vaultSubscriptionExpiresAt ? `Access expires ${dateTime(u.vaultSubscriptionExpiresAt)}.` : 'Access activates automatically only after Paystack confirms the payment.'}</p>{u.vaultSubscriptionPlan && u.vaultSubscriptionStatus !== 'inactive' && <p className="mt-1">Plan: {human(u.vaultSubscriptionPlan)} · {moneyMinor(u.vaultSubscriptionAmountMinor)}</p>}{u.vaultSubscriptionReason && <p className="mt-1">Last access change: {u.vaultSubscriptionReason}</p>}</div>{u.vaultSubscriptionStatus === 'active' && <span className="text-[9px] font-semibold text-[#82918f]">{u.vaultSubscriptionAutoRenew ? 'Cancel renewal first' : 'Removal available in Quick controls'}</span>}</div></Panel>
         <Panel title="Administrative history" eyebrow={`${detail.data.administrativeHistory.length} recent events · immutable audit trail`}>{detail.data.administrativeHistory.length ? <div className="divide-y divide-[#edf0ed]">{detail.data.administrativeHistory.map(a => <div key={a.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5"><div><b className="text-[9px]">{human(a.action)}</b><p className="mt-0.5 text-[9px] text-[#75898b]">{a.actorName} · {a.reason}</p></div><span className="text-[8px] text-[#839394]">{dateTime(a.createdAt)}</span></div>)}</div> : <Empty title="No administrative actions" text="Account decisions and profile changes will appear here." />}</Panel>
       </div>}
       {activeTab === 'accounts' && <MemberAccountsOverview user={u} wallets={detail.data.wallets} />}
       {activeTab === 'transactions' && <TransactionsPage memberId={userId} compact />}
       {activeTab === 'funding' && <FundingPage memberId={userId} compact />}
       {activeTab === 'wallets' && <AccountsPage memberId={userId} controlsOnly compact />}
       {activeTab === 'restrictions' && <RestrictionsPage memberId={userId} compact />}
       </div>
     </div>
        {modal && <Modal title={modal === 'status' ? 'Change account status' : modal === 'profile' ? 'Edit member profile' : modal === 'pin' ? 'Reset transaction PIN' : modal === 'password-reset' ? 'Require password reset' : 'Remove Private Vault access'} close={() => setModal(null)}><form onSubmit={submit} className="space-y-3">
       {modal === 'profile' && <><div className="grid gap-3 sm:grid-cols-2"><Field label="First name"><input className={input} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} maxLength={80} /></Field><Field label="Last name"><input className={input} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} maxLength={80} /></Field><Field label="Address"><textarea data-testid="input-admin-member-address" className={`${input} h-20 resize-y py-2`} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} maxLength={1024} autoComplete="street-address" /></Field><Field label="Phone"><input className={input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} maxLength={40} /></Field><Field label="Country"><input className={input} value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} maxLength={80} /></Field><Field label="City of origin"><input className={input} value={form.cityOfOrigin} onChange={e => setForm({ ...form, cityOfOrigin: e.target.value })} maxLength={80} /></Field><Field label="Date of birth"><input className={input} type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} /></Field><Field label="Occupation / employment"><input className={input} value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} maxLength={120} /></Field></div><Field label="Your six-digit transaction PIN"><input className={input} type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.transactionPin} onChange={e => setForm({ ...form, transactionPin: e.target.value.replace(/\D/g, '').slice(0, 6) })} /></Field></>}
      {modal === 'status' && <><p className="rounded-lg bg-[#f5f7f1] p-3 text-[10px] text-[#728487]">This consequential action changes member access and is recorded automatically in the audit trail.</p><Field label="New account state"><select className={input} value={form.decision === 'approved' ? (u.accountStatus === 'active' ? 'suspended' : 'active') : form.decision} onChange={e => setForm({ ...form, decision: e.target.value })}><option value="active">Active — restore access</option><option value="restricted">Restricted</option><option value="suspended">Suspended</option></select></Field></>}
      {modal === 'pin' && <p className="rounded-lg bg-[#f5f7f1] p-3 text-[10px] leading-5 text-[#728487]">The member will need to create a new PIN before transacting. This action is logged.</p>}
       {modal === 'password-reset' && <><p className="rounded-lg bg-[#f5f7f1] p-3 text-[10px] leading-5 text-[#728487]">This ends the member’s active sessions, emails a one-time recovery link to their verified primary email, and requires a new password before protected account pages open. The reset requirement remains active if email delivery fails.</p><label className="flex items-start gap-2 text-[10px] leading-5 text-[#546b70]"><input type="checkbox" checked={form.confirmed} onChange={e => setForm({ ...form, confirmed: e.target.checked })} className="mt-1" required /><span>I confirm this password-reset requirement and session revocation.</span></label></>}
          {modal === 'vault-subscription' && <>
            <p className="rounded-lg border border-[#f0d4cc] bg-[#fff7f3] p-3 text-[10px] leading-5 text-[#945246]">This removes current access but does not approve, reject, or alter a Paystack payment. Administrators cannot activate subscriptions manually.</p>
            <label className="flex items-start gap-2 text-[10px] leading-5 text-[#546b70]"><input type="checkbox" checked={form.confirmed} onChange={e => setForm({ ...form, confirmed: e.target.checked })} className="mt-1" required /><span>I confirm removal of this member’s Private Vault access.</span></label>
         </>}
        {error && <p role="alert" className="text-[10px] text-[#a45247]">{error}</p>}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setModal(null)} className={quietButton}>Cancel</button><button disabled={statusMutation.isPending || profileMutation.isPending || pinMutation.isPending || passwordMutation.isPending || vaultSubscriptionMutation.isPending || (modal === 'profile' && form.transactionPin.length !== 6) || ((modal === 'password-reset' || modal === 'vault-subscription') && !form.confirmed)} className={button}>{statusMutation.isPending || profileMutation.isPending || pinMutation.isPending || passwordMutation.isPending || vaultSubscriptionMutation.isPending ? 'Saving…' : 'Confirm & save'}</button></div>
     </form></Modal>}
   </div>;
}

function MemberAccountsOverview({ user, wallets }: { user: AdminUser; wallets: Wallet[] }) {
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dce7e1] bg-[#f9fbf7] px-4 py-2.5 text-[9px]">
      <span className="font-semibold text-[#4b656b]">{nameOf(user)} · {user.customerId || user.email}</span>
      <span className="text-[#758a8b]">{wallets.length} currency account{wallets.length === 1 ? '' : 's'}</span>
    </div>
    <Panel title="Member accounts" eyebrow="Currency accounts" note="Account balances are derived from recorded wallet activity. Account status and restriction controls are in their dedicated sections.">
      {wallets.length ? <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">{wallets.map(wallet => <article key={wallet.id} data-testid={`card-member-account-${wallet.id}`} className="rounded-xl border border-[#e2eae5] bg-[#f9fbf7] p-4">
        <div className="flex items-center justify-between gap-2"><span className="font-mono text-[11px] font-extrabold text-[#315562]">{wallet.currency}</span><StatusPill status={wallet.status} /></div>
        <p className="mt-3 font-mono text-[20px] font-semibold tracking-[-.04em] text-[#213f4d]">{money(wallet.available, wallet.currency)}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[9px]"><div><p className="text-[#879594]">Pending</p><p className="mt-0.5 font-mono font-semibold text-[#536c72]">{money(wallet.pending, wallet.currency)}</p></div><div><p className="text-[#879594]">Reserved</p><p className="mt-0.5 font-mono font-semibold text-[#536c72]">{money(wallet.reserved, wallet.currency)}</p></div></div>
        <p className="mt-3 border-t border-[#e4ebe6] pt-2 font-mono text-[8px] text-[#899795]">Wallet reference · ••••{wallet.id.slice(-4).toUpperCase()}</p>
      </article>)}</div> : <Empty title="No currency accounts" text="This member has no wallet records yet." />}
    </Panel>
  </div>;
}

function MemberPendingRequests({ userId, user, onUpdated }: { userId: string; user: AdminUser; onUpdated: (message: string) => Promise<void> }) {
  const client = useQueryClient();
  const params = { userId };
  const requests = useListAdminLedgerRequests(params, {
    query: { queryKey: getListAdminLedgerRequestsQueryKey(params), enabled: !!userId },
  });
  const review = useReviewAdminLedgerRequest();
  const [target, setTarget] = useState<AdminLedgerRequest | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [pin, setPin] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const vaultExpiry = user.vaultSubscriptionExpiresAt ? new Date(user.vaultSubscriptionExpiresAt).getTime() : null;
  const canApprove = user.accountStatus === 'active' &&
    user.vaultSubscriptionStatus === 'active' &&
    (vaultExpiry === null || vaultExpiry > Date.now());

  const open = (request: AdminLedgerRequest) => {
    setTarget(request);
    setDecision(canApprove ? 'approve' : 'reject');
    setPin('');
    setConfirmed(false);
    setError('');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!target || !confirmed || (decision === 'approve' && !canApprove)) return;
    setError('');
    try {
      const result = await review.mutateAsync({
        requestId: target.id,
        data: { decision, transactionPin: pin },
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: getListAdminLedgerRequestsQueryKey() }),
        client.invalidateQueries({ queryKey: getGetAdminUserDetailQueryKey(userId) }),
        client.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }),
        client.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }),
        client.invalidateQueries({ queryKey: getListAdminAccountsQueryKey() }),
        client.invalidateQueries({ queryKey: getListAdminTransactionsQueryKey() }),
      ]);
      await onUpdated(
        result.type === 'deposit'
          ? decision === 'approve' ? 'Deposit approved and the member wallet balance has been updated.' : 'Deposit request rejected.'
          : decision === 'approve' ? 'Withdrawal approved and the member wallet balance has been updated.' : 'Withdrawal request rejected.',
      );
      setTarget(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request could not be reviewed.');
    }
  };

  return <>
    <Panel title="Pending withdrawals" eyebrow={`${requests.data?.length ?? 0} waiting`} note="Review each withdrawal request from this customer record.">
      {requests.isLoading ? <Skeleton rows={2} /> : requests.isError ? <InlineError text="Member requests could not be loaded." retry={() => requests.refetch()} /> : requests.data?.length ? (
        <div className="divide-y divide-[#edf0ed]">
          {requests.data.map(request => <article key={request.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><Pill tone={request.type === 'deposit' ? 'good' : 'warn'}>{human(request.type)}</Pill><span className="font-mono text-[9px] text-[#89999a]">{request.reference}</span></div>
              <p className="mt-1.5 text-[10px] text-[#6f8387]">{request.description || 'Member request'} · {dateTime(request.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2"><strong className="text-[11px]">{money(request.amount, request.currency)}</strong><button type="button" onClick={() => open(request)} className={quietButton}>Review</button></div>
          </article>)}
        </div>
      ) : <Empty title="No pending withdrawals" text="New withdrawal requests will appear here." />}
      {!canApprove && requests.data?.length ? <p className="border-t border-[#edf0ed] bg-[#fbf7eb] px-5 py-3 text-[9px] leading-4 text-[#806b3d]">Approval is available only when this account is active and its Private Vault subscription is current. Requests can still be rejected.</p> : null}
    </Panel>
    {target && <Modal title={`Review ${target.type} request`} close={() => setTarget(null)}>
      <div className="rounded-xl border border-[#e2e9e5] bg-[#f8faf6] p-3.5">
        <p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#7b8d8c]">Member request</p>
        <p className="mt-1.5 text-[12px] font-bold text-[#334e58]">{money(target.amount, target.currency)}</p>
        <p className="mt-1 font-mono text-[9px] text-[#809194]">{target.reference}</p>
      </div>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Field label="Decision"><select className={input} value={decision} onChange={event => setDecision(event.target.value as 'approve' | 'reject')}><option value="approve" disabled={!canApprove}>Approve and update wallet</option><option value="reject">Reject request</option></select></Field>
        {decision === 'approve' && <p className="rounded-lg bg-[#eef7f0] p-3 text-[10px] leading-4 text-[#47755e]">Approval posts the balanced wallet entries and updates the member’s available balance as part of this review.</p>}
        <Field label="Administrator six-digit PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className={input} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>
        <label className="flex items-start gap-2 rounded-lg bg-[#f6f7f1] p-3 text-[10px] leading-5 text-[#718386]"><input required type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1 accent-[#438481]" /><span>I confirm this decision applies to the request shown above.</span></label>
        {error && <p role="alert" className="text-[10px] text-[#a45247]">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className={quietButton} onClick={() => setTarget(null)}>Cancel</button><button disabled={review.isPending || pin.length !== 6 || !confirmed || (decision === 'approve' && !canApprove)} className={button}>{review.isPending ? 'Saving…' : 'Confirm decision'}</button></div>
      </form>
    </Modal>}
  </>;
}

function AccountsPage({ controlsOnly = false, restrictedOnly = false, memberId, compact = false }: { controlsOnly?: boolean; restrictedOnly?: boolean; memberId?: string; compact?: boolean }) {
  const client = useQueryClient();
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const [currency, setCurrency] = useState(''); const [status, setStatus] = useState(restrictedOnly ? 'restricted' : '');
  const memberDetail = useGetAdminUserDetail(memberId || '', { query: { queryKey: getGetAdminUserDetailQueryKey(memberId || ''), enabled: !!memberId } });
  const memberSearch = memberId ? (memberDetail.data?.user.customerId || memberDetail.data?.user.email) : search.trim();
  const params = useMemo(() => ({ ...(memberSearch ? { search: memberSearch } : {}), ...(currency ? { currency: currency as CurrencyCode } : {}), ...(status ? { status: status as 'active' | 'restricted' } : {}), page, pageSize: memberId ? 100 : 25 }), [memberSearch, currency, status, page, memberId]);
  const accounts = useListAdminAccounts(params, { query: { queryKey: getListAdminAccountsQueryKey(params), enabled: !memberId || !!memberDetail.data } });
  const visibleAccounts = (accounts.data?.items || []).filter(account => !memberId || account.userId === memberId);
  const update = useUpdateAdminWalletStatus();
  const [target, setTarget] = useState<AdminAccount | null>(null); const [next, setNext] = useState<'active' | 'restricted'>('restricted'); const [pin, setPin] = useState(''); const [error, setError] = useState('');
  const title = restrictedOnly ? 'Restricted accounts' : controlsOnly ? 'Wallet controls' : 'Currency accounts';
  const save = async (e: FormEvent) => { e.preventDefault(); if (!target) return; setError(''); try { await update.mutateAsync({ walletId: target.id, data: { status: next, transactionPin: pin, confirmed: true } }); await Promise.all([client.invalidateQueries({ queryKey: getListAdminAccountsQueryKey() }), client.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }), client.invalidateQueries({ queryKey: getListAdminRestrictionsQueryKey() }), ...(memberId ? [client.invalidateQueries({ queryKey: getGetAdminUserDetailQueryKey(memberId) })] : [])]); setTarget(null); } catch (err) { setError(err instanceof Error ? err.message : 'Wallet status could not be updated.'); } };
  return <div className="space-y-3">{!compact && <Heading kicker="Wallets are account records" title={title} subtitle="Each member has one wallet per currency. Wallets remain readable when restricted; incoming credits are permitted while sends and withdrawals are blocked." />}
    {memberId && memberDetail.data && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dce7e1] bg-[#f9fbf7] px-4 py-2.5 text-[9px]"><span className="font-semibold text-[#4b656b]">{nameOf(memberDetail.data.user)} · {memberDetail.data.user.customerId || memberDetail.data.user.email}</span><StatusPill status={memberDetail.data.user.accountStatus} /></div>}
    <Panel title={controlsOnly ? 'Wallet restrictions' : 'Member currency wallets'} eyebrow={`${memberId ? visibleAccounts.length : accounts.data?.total ?? 0} wallet records`}>
      {!memberId && <div className="flex flex-wrap gap-2 border-b border-[#e9efec] bg-[#f8f9f4] p-4"><label className="relative min-w-[210px] flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a9a9b]" /><input className={`${input} pl-9`} placeholder="Member, email or Customer ID" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label><select className={`${input} w-auto min-w-[130px]`} value={currency} onChange={e => { setCurrency(e.target.value); setPage(1); }}><option value="">All currencies</option>{historicalCurrencies.map(c => <option key={c} value={c}>{c}</option>)}</select><select className={`${input} w-auto min-w-[135px]`} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All wallet states</option><option value="active">Active</option><option value="restricted">Restricted</option></select></div>}
       {accounts.isLoading || (memberId && memberDetail.isLoading) ? <Skeleton /> : accounts.isError ? <InlineError text="Wallet records could not be loaded." retry={() => accounts.refetch()} /> : visibleAccounts.length ? <><div className="overflow-x-auto"><table className={`w-full ${memberId ? 'min-w-[580px]' : 'min-w-[740px]'} text-left`}><thead className="bg-[#f7f8f4] text-[9px] uppercase tracking-[.12em] text-[#829191]"><tr>{(memberId ? ['Currency', 'Wallet balance', 'Status', 'Restriction reason', ...(controlsOnly ? [''] : [])] : ['Member', 'Customer ID', 'Currency', 'Wallet balance', 'Status', 'Restriction reason', '']).map((t, index) => <th key={`${t}-${index}`} className="px-4 py-3">{t}</th>)}</tr></thead><tbody>{visibleAccounts.map(a => <tr key={a.id} className="border-t border-[#edf1ee] text-[10px]">{!memberId && <><td className="px-4 py-3"><Link className="font-bold text-[#315b65] hover:underline" href={`/admin/users/${a.userId}`}>{a.memberName}</Link><p className="mt-1 text-[9px] text-[#829292]">{a.email}</p></td><td className="px-4 py-3 font-mono">{a.customerId || '—'}</td></>}<td className="px-4 py-3"><span className="font-mono font-bold">{a.currency}</span><span className="ml-2 text-[9px] text-[#899799]">{currencyLabel[a.currency]}</span></td><td className="px-4 py-3 font-mono font-semibold">{money(a.balance, a.currency)}</td><td className="px-4 py-3"><StatusPill status={a.status} /></td><td className="max-w-[180px] truncate px-4 py-3 text-[#7e8e91]">{a.restrictionReason || '—'}</td>{(!memberId || controlsOnly) && <td className="px-4 py-3"><button data-testid={`button-wallet-control-${a.id}`} className={quietButton} onClick={() => { setTarget(a); setNext(a.status === 'active' ? 'restricted' : 'active'); setPin(''); setError(''); }}>{a.status === 'active' ? 'Freeze' : 'Unfreeze'}</button></td>}</tr>)}</tbody></table></div>{!memberId && <Pager page={page} pages={Math.ceil((accounts.data?.total ?? 0) / Math.max(1, accounts.data?.pageSize ?? 25))} onChange={setPage} />}</> : <Empty title="No wallets found" text="Adjust the filters to search the selected currency-wallet records." />}
    </Panel>
     {target && <Modal title={next === 'restricted' ? 'Freeze wallet' : 'Unfreeze wallet'} close={() => setTarget(null)}><p className="mb-4 rounded-lg bg-[#f4f7f2] p-3 text-[10px] leading-5 text-[#708487]">{target.memberName} · {target.currency} · {money(target.balance, target.currency)}. Frozen wallets remain readable and can receive credits, but cannot send or withdraw.</p><form onSubmit={save} className="space-y-3"><Field label="Six-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className={input} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>{error && <p role="alert" className="text-[10px] text-[#a45247]">{error}</p>}<label className="flex items-start gap-2 rounded-lg bg-[#f6f7f1] p-3 text-[10px] text-[#718386]"><input type="checkbox" required className="mt-0.5 accent-[#438481]" />I confirm this wallet status change and understand it is recorded to the audit trail.</label><div className="flex justify-end gap-2"><button type="button" className={quietButton} onClick={() => setTarget(null)}>Cancel</button><button disabled={update.isPending || pin.length !== 6} className={button}>{update.isPending ? 'Saving…' : 'Confirm wallet change'}</button></div></form></Modal>}
  </div>;
}

const restrictionLabels: Record<BankRestrictionType, string> = {
  suspend_user: 'Suspend customer',
  restrict_outgoing_transfers: 'Restrict outgoing transfers',
  restrict_withdrawals: 'Restrict withdrawals',
  restrict_deposits: 'Restrict deposits',
  freeze_wallet: 'Freeze wallet',
  under_review: 'Account under review',
  read_only: 'Read-only account',
};

function localDateTimeValue(dateValue: Date) {
  return new Date(dateValue.getTime() - dateValue.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function RestrictionsPage({ memberId, compact = false }: { memberId?: string; compact?: boolean } = {}) {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [memberSearch, setMemberSearch] = useState('');
  const [userId, setUserId] = useState('');
  const activeUserId = memberId || userId;
  const detail = useGetAdminUserDetail(activeUserId, {
    query: { queryKey: getGetAdminUserDetailQueryKey(activeUserId), enabled: !!activeUserId },
  });
  const member = memberId ? detail.data?.user : undefined;
  const params = useMemo(() => ({
    ...(memberId && detail.data ? { search: detail.data.user.email || detail.data.user.customerId || '' } : !memberId && search.trim() ? { search: search.trim() } : {}),
    ...(status ? { status: status as 'active' | 'scheduled' | 'expired' | 'removed' } : {}),
    ...(filterType ? { type: filterType as BankRestrictionType } : {}),
    page,
    pageSize: memberId ? 100 : 25,
  }), [memberId, detail.data, search, status, filterType, page]);
  const restrictions = useListAdminRestrictions(params, {
    query: { queryKey: getListAdminRestrictionsQueryKey(params), enabled: !memberId || !!detail.data },
  });

  const memberParams: ListAdminUsersParams = useMemo(() => ({
    ...(memberSearch.trim() ? { search: memberSearch.trim() } : {}),
    page: 1,
    limit: 20,
  }), [memberSearch]);
  const members = useListAdminUsers(memberParams, {
    query: { queryKey: getListAdminUsersQueryKey(memberParams), enabled: !memberId },
  });
  const selectedMember = memberId ? member : members.data?.items.find(user => user.id === userId);
  const matchingRestrictions = (restrictions.data?.items || []).filter(record => !memberId || record.userId === memberId);

  const [type, setType] = useState<BankRestrictionType>('suspend_user');
  const [walletId, setWalletId] = useState('');
  const [effectiveAt, setEffectiveAt] = useState(() => localDateTimeValue(new Date()));
  const [expiresAt, setExpiresAt] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const create = useCreateAdminRestriction();
  const remove = useRemoveAdminRestriction();
  const [removeTarget, setRemoveTarget] = useState<AdminRestriction | null>(null);
  const [removePin, setRemovePin] = useState('');
  const [removeError, setRemoveError] = useState('');

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: getListAdminRestrictionsQueryKey() }),
      client.invalidateQueries({ queryKey: getListAdminAccountsQueryKey() }),
      client.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }),
      client.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }),
      ...(activeUserId ? [client.invalidateQueries({ queryKey: getGetAdminUserDetailQueryKey(activeUserId) })] : []),
    ]);
  };
  const createRestriction = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedMember) return;
    setError('');
    setNotice('');
    try {
      await create.mutateAsync({
        data: {
          userId: selectedMember.id,
          walletId: walletId || null,
          type,
          effectiveAt: new Date(effectiveAt).toISOString(),
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          transactionPin: pin,
          confirmed: true,
        },
      });
      setNotice(`Restriction recorded for ${nameOf(selectedMember)}.`);
      setPin('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The restriction could not be recorded.');
    }
  };
  const removeRestriction = async (event: FormEvent) => {
    event.preventDefault();
    if (!removeTarget) return;
    setRemoveError('');
    try {
      await remove.mutateAsync({
        restrictionId: removeTarget.id,
        data: { transactionPin: removePin, confirmed: true },
      });
      setRemoveTarget(null);
      setRemovePin('');
      await refresh();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'The restriction could not be removed.');
    }
  };

  return <div className="space-y-3">
    {!compact && <Heading kicker="Access and controls" title="Restrictions and suspension" subtitle="Apply time-bound or ongoing controls to a customer or one wallet. Each decision is audited; removing one record leaves every other restriction in place." />}
    {memberId && detail.data && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dce7e1] bg-[#f9fbf7] px-4 py-2.5 text-[9px]"><span className="font-semibold text-[#4b656b]">{nameOf(detail.data.user)} · {detail.data.user.customerId || detail.data.user.email}</span><StatusPill status={detail.data.user.accountStatus} /></div>}
    {notice && <p role="status" className="mb-4 rounded-lg bg-[#eef7f0] p-3 text-[10px] text-[#47755e]">{notice}</p>}
    {error && <p role="alert" className="mb-4 rounded-lg bg-[#fff2ed] p-3 text-[10px] text-[#a45247]">{error}</p>}
    <Panel title="Create a restriction" eyebrow="Administrator confirmation" note="Restrictions are enforced by the server on financial requests and again before wallet balances are updated. Frozen wallets may still receive credits.">
      <form onSubmit={createRestriction} className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {!memberId && <><Field label="Find customer"><input className={input} value={memberSearch} onChange={event => { setMemberSearch(event.target.value); setUserId(''); setWalletId(''); }} placeholder="Name, email or Customer ID" /></Field>
        <Field label="Customer"><select required className={input} value={userId} onChange={event => { setUserId(event.target.value); setWalletId(''); }}><option value="">Select a customer</option>{members.data?.items.map(user => <option key={user.id} value={user.id}>{nameOf(user)} · {user.customerId || user.email}</option>)}</select></Field></>}
        {memberId && <div className="rounded-lg border border-[#e3ebe6] bg-[#f8faf6] p-3 text-[10px] sm:col-span-2"><b>{selectedMember ? nameOf(selectedMember) : detail.isLoading ? 'Loading member…' : 'Member unavailable'}</b><span className="ml-2 text-[#7a8c8e]">{selectedMember?.customerId || selectedMember?.email}</span></div>}
        <Field label="Restriction"><select className={input} value={type} onChange={event => setType(event.target.value as BankRestrictionType)}>{Object.entries(restrictionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Account or wallet"><select className={input} value={walletId} onChange={event => setWalletId(event.target.value)} disabled={!selectedMember || detail.isLoading}><option value="">{type === 'freeze_wallet' ? 'Select a wallet' : 'All wallets / account-wide'}</option>{detail.data?.wallets.map(wallet => <option key={wallet.id} value={wallet.id}>{wallet.currency} · {money(wallet.available, wallet.currency)} · {human(wallet.status)}</option>)}</select></Field>
        <Field label="Effective date and time"><input required type="datetime-local" className={input} value={effectiveAt} onChange={event => setEffectiveAt(event.target.value)} /></Field>
        <Field label="Expiry date and time (optional)"><input type="datetime-local" className={input} value={expiresAt} onChange={event => setExpiresAt(event.target.value)} /></Field>
        <Field label="Administrator six-digit PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className={input} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>
        <label className="flex items-start gap-2 rounded-lg bg-[#f6f7f1] p-3 text-[10px] leading-5 text-[#718386] sm:col-span-2 xl:col-span-3"><input type="checkbox" required className="mt-1 accent-[#438481]" />I confirm this restriction and understand it will be enforced and permanently recorded in the administrative history.</label>
         <button disabled={create.isPending || !selectedMember || pin.length !== 6 || (type === 'freeze_wallet' && !walletId)} className={`${button} sm:col-span-2 xl:col-span-3`}>{create.isPending ? 'Recording…' : 'Confirm restriction'}</button>
      </form>
    </Panel>
    <Panel title="Restriction history" eyebrow={`${restrictions.data?.total ?? 0} records`}>
      <div className={`grid gap-2 border-b border-[#e9efec] bg-[#f8f9f4] p-4 ${memberId ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        {!memberId && <Field label="Search customer, reason or wallet"><input className={input} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Name, email, ID or wallet" /></Field>}
        <Field label="Restriction type"><select className={input} value={filterType} onChange={event => { setFilterType(event.target.value); setPage(1); }}><option value="">All types</option>{Object.entries(restrictionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Record state"><select className={input} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All states</option>{['active', 'scheduled', 'expired', 'removed'].map(value => <option key={value} value={value}>{human(value)}</option>)}</select></Field>
      </div>
       {restrictions.isLoading || (memberId && detail.isLoading) ? <Skeleton /> : restrictions.isError ? <InlineError text="Restriction records could not be loaded." retry={() => restrictions.refetch()} /> : matchingRestrictions.length ? <>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-[#f7f8f4] text-[9px] uppercase tracking-[.12em] text-[#829191]"><tr>{(memberId ? ['Restriction / scope', 'Effective window', 'State', 'Reason / history', ''] : ['Customer', 'Restriction / scope', 'Effective window', 'State', 'Reason / history', '']).map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{matchingRestrictions.map(record => <tr key={record.id} className="border-t border-[#edf1ee] text-[10px] align-top">{!memberId && <td className="px-4 py-3"><Link className="font-bold text-[#315c66] hover:underline" href={`/admin/users/${record.userId}`}>{record.userName}</Link><p className="mt-1 text-[9px] text-[#829292]">{record.email} · {record.customerId || 'No Customer ID'}</p></td>}<td className="px-4 py-3"><b>{restrictionLabels[record.type]}</b><p className="mt-1 font-mono text-[9px] text-[#829292]">{record.walletCurrency ? `${record.walletCurrency} wallet` : 'Account-wide'}</p></td><td className="px-4 py-3 whitespace-nowrap">{dateTime(record.effectiveAt)}<p className="mt-1 text-[#829292]">{record.expiresAt ? `Until ${dateTime(record.expiresAt)}` : 'No expiry'}</p></td><td className="px-4 py-3"><StatusPill status={record.status} /><p className="mt-1 text-[9px] text-[#829292]">By {record.createdByName}</p></td><td className="max-w-[300px] whitespace-pre-wrap px-4 py-3 text-[#61777c]">{record.reason}{record.internalNotes && <p className="mt-1 text-[9px] text-[#849394]">Notes: {record.internalNotes}</p>}{record.removalReason && <p className="mt-1 text-[9px] text-[#849394]">Removal: {record.removalReason}</p>}</td><td className="px-4 py-3">{record.status !== 'removed' && <button className={quietButton} onClick={() => { setRemoveTarget(record); setRemoveError(''); setRemovePin(''); }}>Remove</button>}</td></tr>)}</tbody></table></div>
        <Pager page={page} pages={Math.ceil(restrictions.data!.total / restrictions.data!.pageSize)} onChange={setPage} />
      </> : <Empty title="No restrictions found" text="No restriction records match the selected filters." />}
    </Panel>
    {removeTarget && <Modal title="Remove one restriction" close={() => setRemoveTarget(null)}><form onSubmit={removeRestriction} className="space-y-3">
      <p className="rounded-lg bg-[#f5f7f1] p-3 text-[10px] leading-5 text-[#718386]">This removes only “{restrictionLabels[removeTarget.type]}” for {removeTarget.userName}. Other active restrictions remain enforced.</p>
      <Field label="Administrator six-digit PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className={input} value={removePin} onChange={event => setRemovePin(event.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>
      {removeError && <p role="alert" className="text-[10px] text-[#a45247]">{removeError}</p>}
      <label className="flex items-start gap-2 rounded-lg bg-[#f6f7f1] p-3 text-[10px] leading-5 text-[#718386]"><input type="checkbox" required className="mt-1 accent-[#438481]" />I confirm removal of this restriction only.</label>
       <div className="flex justify-end gap-2"><button type="button" className={quietButton} onClick={() => setRemoveTarget(null)}>Cancel</button><button disabled={remove.isPending || removePin.length !== 6} className={button}>{remove.isPending ? 'Saving…' : 'Confirm removal'}</button></div>
    </form></Modal>}
  </div>;
}

function FundingPage({ memberId, compact = false }: { memberId?: string; compact?: boolean } = {}) {
  const client = useQueryClient(); const { user } = useUser();
  const [search, setSearch] = useState(''); const [selected, setSelected] = useState(''); const [direction, setDirection] = useState<'credit' | 'debit'>('credit'); const [currency, setCurrency] = useState<CurrencyCode | ''>('');
  const [amount, setAmount] = useState(''); const [transactionDate, setTransactionDate] = useState(''); const [sender, setSender] = useState('Globus operations'); const [description, setDescription] = useState(''); const [reference, setReference] = useState(''); const [pin, setPin] = useState(''); const [confirm, setConfirm] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const fixedMember = useGetAdminUserDetail(memberId || '', { query: { queryKey: getGetAdminUserDetailQueryKey(memberId || ''), enabled: !!memberId } });
  const usersParams = useMemo(() => ({ ...(search.trim() ? { search: search.trim() } : {}), accountStatus: 'active' as const, limit: 30 }), [search]);
  const users = useListAdminUsers(usersParams, { query: { queryKey: getListAdminUsersQueryKey(usersParams), enabled: !memberId } });
  const settings = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  const requestParams = memberId ? { userId: memberId } : undefined;
  const requests = useListAdminLedgerRequests(requestParams, { query: { queryKey: getListAdminLedgerRequestsQueryKey(requestParams) } });
  const transactionCustomer = memberId || undefined;
  const transactionsParams = { type: 'admin_funding' as TransactionType, status: 'pending' as const, ...(transactionCustomer ? { customer: transactionCustomer } : {}), page: 1, pageSize: 100 };
  const transactions = useListAdminTransactions(transactionsParams, { query: { queryKey: getListAdminTransactionsQueryKey(transactionsParams), enabled: !memberId || !!fixedMember.data } });
  const adjustmentsParams = { type: 'admin_adjustment' as TransactionType, status: 'pending' as const, ...(transactionCustomer ? { customer: transactionCustomer } : {}), page: 1, pageSize: 100 };
  const adjustments = useListAdminTransactions(adjustmentsParams, { query: { queryKey: getListAdminTransactionsQueryKey(adjustmentsParams), enabled: !memberId || !!fixedMember.data } });
  const selectedMember = users.data?.items.find(x => x.id === selected);
  const member = memberId ? fixedMember.data?.user : selectedMember;
  const walletSearch = memberId ? (fixedMember.data?.user.customerId || fixedMember.data?.user.email) : (selectedMember?.customerId || selectedMember?.email);
  const walletParams = { ...(walletSearch ? { search: walletSearch } : {}), page: 1, pageSize: 100 };
  const memberWallets = useListAdminAccounts(walletParams, { query: { queryKey: getListAdminAccountsQueryKey(walletParams), enabled: !!member } });
  const create = useCreateAdminFunding(); const review = useReviewAdminFunding();
  const requestReview = useReviewAdminLedgerRequest();
  const [reviewId, setReviewId] = useState(''); const [reviewKind, setReviewKind] = useState<'funding' | 'ledger'>('funding'); const [reviewDecision, setReviewDecision] = useState<'approve' | 'reject'>('approve'); const [reviewPin, setReviewPin] = useState('');
  const matchedWallets = (memberWallets.data?.items || []).filter(wallet => !memberId || wallet.userId === memberId);
  const selectedWallet = matchedWallets.find(w => w.currency === currency);
  const fundingCap = Math.min(100000000, Number(settings.data?.fundingLimit || 100000000));
  const ready = !!member && member.accountStatus !== 'suspended' && (member.accountStatus === 'active' || direction === 'credit') && !!selectedWallet && !(direction === 'debit' && selectedWallet.status === 'restricted') && Number(amount) > 0 && Number(amount) <= fundingCap && sender.trim() && description.trim() && pin.length === 6;
  const submit = async () => { if (!member || !currency) return; setError(''); try { await create.mutateAsync({ userId: member.id, data: { direction, currency: currency as ActiveCurrencyCode, amount, senderName: sender.trim(), description: description.trim(), internalReference: reference.trim() || null, ...(transactionDate ? { transactionDate } : {}), transactionPin: pin, idempotencyKey: crypto.randomUUID() } }); setSuccess(`Funding instruction recorded for ${nameOf(member)}.`); setConfirm(false); setAmount(''); setTransactionDate(''); setDescription(''); setReference(''); setPin(''); await Promise.all([client.invalidateQueries({ queryKey: getListAdminTransactionsQueryKey() }), client.invalidateQueries({ queryKey: getListAdminLedgerRequestsQueryKey() }), client.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }), client.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }), client.invalidateQueries({ queryKey: getListAdminAccountsQueryKey() }), ...(memberId ? [client.invalidateQueries({ queryKey: getGetAdminUserDetailQueryKey(memberId) })] : [])]); } catch (err) { setError(err instanceof Error ? err.message : 'Funding could not be recorded.'); } };
  const doReview = async (e: FormEvent) => { e.preventDefault(); setError(''); try { let affectedUserId: string | undefined; if (reviewKind === 'ledger') { const result = await requestReview.mutateAsync({ requestId: reviewId, data: { decision: reviewDecision, transactionPin: reviewPin } }); affectedUserId = result.userId; } else { await review.mutateAsync({ transactionId: reviewId, data: { decision: reviewDecision, transactionPin: reviewPin } }); } setReviewId(''); setReviewPin(''); await Promise.all([client.invalidateQueries({ queryKey: getListAdminTransactionsQueryKey() }), client.invalidateQueries({ queryKey: getListAdminLedgerRequestsQueryKey() }), client.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }), client.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }), client.invalidateQueries({ queryKey: getListAdminAccountsQueryKey() }), ...(memberId ? [client.invalidateQueries({ queryKey: getGetAdminUserDetailQueryKey(memberId) })] : []), ...(affectedUserId && affectedUserId !== memberId ? [client.invalidateQueries({ queryKey: getGetAdminUserDetailQueryKey(affectedUserId) })] : [])]); } catch (err) { setError(err instanceof Error ? err.message : 'The review could not be recorded.'); } };
  const pending = [...(transactions.data?.items || []), ...(adjustments.data?.items || [])];
  return <div className="space-y-3">{!compact && <Heading kicker="Account funding controls" title="User funding" subtitle="Prepare an audited wallet credit or debit. Above the second-approval threshold, the entry waits for a different administrator's decision." />}
     {memberId && member && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dce7e1] bg-[#f9fbf7] px-4 py-2.5 text-[9px]"><span className="font-semibold text-[#4b656b]">{nameOf(member)} · {member.customerId || member.email}</span><StatusPill status={member.accountStatus} /></div>}
    <div className={`${box} mb-5 flex flex-wrap items-center gap-3 bg-[#eef5f0] p-4 text-[10px] leading-5 text-[#537477]`}><ShieldCheck size={17} />Funding cap: <b>{money(fundingCap, currency || 'USD')} per currency</b><span className="mx-1 h-4 border-l border-[#d3e2db]" />Second approval threshold: <b>{settings.data?.secondApprovalThreshold ? money(settings.data.secondApprovalThreshold, currency || 'USD') : money(100000000, currency || 'USD')}</b></div>
    {error && <p role="alert" className="mb-4 rounded-lg bg-[#fff2ed] p-3 text-[10px] text-[#a45247]">{error}</p>}{success && <p role="status" className="mb-4 rounded-lg bg-[#eef7f0] p-3 text-[10px] text-[#47755e]">{success}</p>}
    <div className="grid items-start gap-5 xl:grid-cols-[1fr_.78fr]"><Panel title="New funding instruction" eyebrow="Review before submission" note="No external financial service is connected. This creates a traceable, audited wallet adjustment."><form onSubmit={e => { e.preventDefault(); if (ready) setConfirm(true); }} className="grid gap-3 p-5 sm:grid-cols-2">
       {!memberId && <><Field label="Find member"><div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#849496]" /><input className={`${input} pl-9`} placeholder="Name, email or Customer ID" value={search} onChange={e => setSearch(e.target.value)} /></div></Field>
       <Field label="Selected member"><select required className={input} value={selected} onChange={e => { setSelected(e.target.value); setCurrency(''); }}><option value="">Choose a member</option>{users.data?.items.map(u => <option key={u.id} value={u.id}>{nameOf(u)} · {u.customerId || u.email}</option>)}</select></Field></>}
       {memberId && <div className="rounded-lg border border-[#e3ebe6] bg-[#f8faf6] p-3 text-[10px] sm:col-span-2"><b>{member ? nameOf(member) : fixedMember.isLoading ? 'Loading member…' : 'Member unavailable'}</b><span className="ml-2 text-[#7a8c8e]">{member?.customerId || member?.email}</span></div>}
      <Field label="Direction"><select className={input} value={direction} onChange={e => setDirection(e.target.value as 'credit' | 'debit')}><option value="credit">Credit wallet</option><option value="debit">Debit wallet</option></select></Field>
      <Field label="Currency wallet"><select required className={input} value={currency} onChange={e => setCurrency(e.target.value as CurrencyCode | '')} disabled={!member || memberWallets.isLoading}><option value="">{!member ? 'Select a member first' : memberWallets.isLoading ? 'Loading wallets…' : 'Select a currency wallet'}</option>{matchedWallets.map(w => <option key={w.id} value={w.currency}>{w.currency} · {currencyLabel[w.currency]} · {money(w.balance, w.currency)} · {human(w.status)}</option>)}</select></Field>
      <Field label={`Amount (maximum ${fundingCap.toLocaleString()} ${currency || ''})`}><input required className={input} inputMode="decimal" pattern="[0-9]+(\\.[0-9]{1,2})?" min="0.01" max={fundingCap} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></Field>
      <Field label="Customer transaction date (optional)"><input type="date" className={input} value={transactionDate} onChange={e => setTransactionDate(e.target.value)} /><span className="mt-1 block text-[9px] leading-4 text-[#849496]">Leave blank to use the time this record is saved.</span></Field>
      {selectedWallet?.status === 'restricted' && direction === 'debit' && <p className="text-[10px] text-[#a45247] sm:col-span-2">This wallet is frozen; debit funding is unavailable until it is unfrozen. Credits remain permitted.</p>}
      <Field label="Sender / funding label"><input required maxLength={120} className={input} value={sender} onChange={e => setSender(e.target.value)} /></Field>
      <Field label="Description"><input required maxLength={240} className={input} value={description} onChange={e => setDescription(e.target.value)} placeholder="Visible in member activity" /></Field>
      <Field label="Internal reference"><input maxLength={120} className={input} value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional reference" /></Field>
      <Field label="Administrator six-digit PIN" className="sm:col-span-2"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className={input} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>
      <button disabled={!ready || create.isPending} className={`${button} sm:col-span-2`}>Review funding details <ArrowRight size={14} /></button>
    </form></Panel>
       <Panel title="Second administrator review" eyebrow="Pending funding & corrections" note="High-value adjustments require a different administrator to approve or reject."><div className="divide-y divide-[#edf0ed]">{pending.length ? pending.map(t => <PendingFunding key={t.id} transaction={t} currentEmail={user?.primaryEmailAddress?.emailAddress || ''} onReview={(id, decision) => { setReviewKind('funding'); setReviewId(id); setReviewDecision(decision); setReviewPin(''); }} />) : <Empty title="No adjustments awaiting approval" text="Entries requiring a second approval will appear here until reviewed." />}</div></Panel>
    </div>
        <Panel title="Withdrawal requests" eyebrow="Customer requests" note="Approved withdrawals update the requested wallet; each decision is recorded automatically."><div className="divide-y divide-[#edf0ed]">{requests.isLoading ? <Skeleton rows={2} /> : requests.isError ? <InlineError text="Withdrawal queue unavailable." retry={() => requests.refetch()} /> : requests.data?.length ? requests.data.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="text-[11px] font-bold">{r.memberName} · {human(r.type)}</p><p className="mt-1 font-mono text-[9px] text-[#819092]">{r.reference} · {dateTime(r.createdAt)}</p></div><div className="flex items-center gap-2"><b className="text-[11px]">{money(r.amount, r.currency)}</b><button className={quietButton} onClick={() => { setReviewKind('ledger'); setReviewId(r.id); setReviewDecision('approve'); setReviewPin(''); }} data-request-id={r.id}>Review</button></div></div>) : <Empty title="No withdrawals to review" text="New withdrawal requests will be listed here." />}</div></Panel>
      {confirm && member && <Modal title="Confirm internal funding" close={() => setConfirm(false)}><div className="rounded-xl bg-[#f4f7f1] p-4"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#7b8d8d]">Funding instruction</p><div className="mt-3 flex justify-between gap-3 text-[11px]"><span>{nameOf(member)} · {member.customerId || member.email}</span><b className="font-mono">{direction.toUpperCase()}</b></div><p className="mt-3 font-mono text-[24px] font-semibold">{money(amount, currency)}</p><p className="mt-2 text-[10px] text-[#718588]">{description} · {sender}</p><p className="mt-2 text-[10px] text-[#718588]">Customer transaction date: <b>{transactionDate || 'Recorded date'}</b></p></div><label className="mt-4 flex gap-2 text-[10px] leading-5 text-[#708487]"><input type="checkbox" id="fund-confirm" className="mt-1 accent-[#438481]" />I confirm these values are correct and understand this balance change is recorded and audited.</label><div className="mt-4 flex justify-end gap-2"><button className={quietButton} onClick={() => setConfirm(false)}>Back to edit</button><button className={button} onClick={() => { const el = document.getElementById('fund-confirm') as HTMLInputElement; if (el?.checked) void submit(); }}>{create.isPending ? 'Recording…' : 'Confirm & record'}</button></div></Modal>}
      {reviewId && <Modal title={reviewKind === 'funding' ? 'Second administrator funding review' : 'Request review'} close={() => setReviewId('')}><form onSubmit={doReview} className="space-y-3"><p className="text-[10px] leading-5 text-[#718588]">{reviewKind === 'funding' ? 'This is a separate audited decision. It must be performed by an administrator other than the funding initiator.' : 'Reviewing a customer request records the decision and updates the requested wallet when approved.'}</p><Field label="Decision"><select className={input} value={reviewDecision} onChange={e => setReviewDecision(e.target.value as 'approve' | 'reject')}><option value="approve">Approve</option><option value="reject">Reject</option></select></Field><Field label="Six-digit transaction PIN"><input required type="password" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" className={input} value={reviewPin} onChange={e => setReviewPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></Field><div className="flex justify-end gap-2"><button type="button" className={quietButton} onClick={() => setReviewId('')}>Cancel</button><button disabled={review.isPending || requestReview.isPending || reviewPin.length !== 6} className={button}>Confirm decision</button></div></form></Modal>}
  </div>;
}

function PendingFunding({ transaction, currentEmail, onReview }: { transaction: BankTransaction; currentEmail: string; onReview: (id: string, decision: 'approve' | 'reject') => void }) {
  const detail = useGetAdminTransactionDetail(transaction.id, { query: { queryKey: getGetAdminTransactionDetailQueryKey(transaction.id) } });
  const isOwn = !!currentEmail && detail.data?.initiatorEmail.toLowerCase() === currentEmail.toLowerCase();
  return <div className="px-5 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[9px] text-[#7d8e90]">{transaction.reference}</p><p className="mt-1 text-[11px] font-bold">{transaction.description}</p><p className="mt-1 text-[9px] text-[#859597]">{detail.data?.customerName || 'Loading member…'} · {dateTime(transaction.createdAt)}</p></div><strong className="text-[12px]">{money(transaction.amount, transaction.currency)}</strong></div>{isOwn && <p className="mt-3 text-[9px] font-semibold text-[#a45247]">You initiated this adjustment. A different administrator must review it.</p>}{detail.isError && <p role="alert" className="mt-3 text-[9px] text-[#a45247]">The initiator could not be verified. Reload before reviewing.</p>}<div className="mt-3 flex justify-end gap-2"><button disabled={isOwn || detail.isLoading || detail.isError} className={quietButton} onClick={() => onReview(transaction.id, 'reject')}>Reject</button><button disabled={isOwn || detail.isLoading || detail.isError} className={button} onClick={() => onReview(transaction.id, 'approve')}>Approve</button></div></div>;
}

function TransactionsPage({ memberId, compact = false }: { memberId?: string; compact?: boolean } = {}) {
  const client = useQueryClient();
  const [search, setSearch] = useState(''); const [customer, setCustomer] = useState(''); const [currency, setCurrency] = useState(''); const [type, setType] = useState(''); const [status, setStatus] = useState(''); const [fromDate, setFromDate] = useState(''); const [toDate, setToDate] = useState(''); const [min, setMin] = useState(''); const [max, setMax] = useState(''); const [page, setPage] = useState(1);
  const memberDetail = useGetAdminUserDetail(memberId || '', { query: { queryKey: getGetAdminUserDetailQueryKey(memberId || ''), enabled: !!memberId } });
  const memberFilter = memberId ? (memberDetail.data?.user.customerId || memberDetail.data?.user.email || memberId) : customer.trim();
  const params: ListAdminTransactionsParams = useMemo(() => ({ ...(search.trim() ? { search: search.trim() } : {}), ...(memberFilter ? { customer: memberFilter } : {}), ...(currency ? { currency: currency as CurrencyCode } : {}), ...(type ? { type: type as TransactionType } : {}), ...(status ? { status: status as ListAdminTransactionsParams['status'] } : {}), ...(fromDate ? { fromDate } : {}), ...(toDate ? { toDate } : {}), ...(min ? { minimumAmount: min } : {}), ...(max ? { maximumAmount: max } : {}), page, pageSize: 25 }), [search, memberFilter, currency, type, status, fromDate, toDate, min, max, page]);
  const list = useListAdminTransactions(params, { query: { queryKey: getListAdminTransactionsQueryKey(params), enabled: !memberId || !!memberDetail.data } });
  const [detailId, setDetailId] = useState(''); const [correction, setCorrection] = useState<'reversal' | 'adjustment' | null>(null); const [direction, setDirection] = useState<'credit' | 'debit'>('credit'); const [walletId, setWalletId] = useState(''); const [amount, setAmount] = useState(''); const [pin, setPin] = useState(''); const [statusModal, setStatusModal] = useState(false); const [newStatus, setNewStatus] = useState(''); const [processModal, setProcessModal] = useState(false); const [processPin, setProcessPin] = useState(''); const [processError, setProcessError] = useState(''); const [dateEditOpen, setDateEditOpen] = useState(false); const [transactionDateDraft, setTransactionDateDraft] = useState(''); const [datePin, setDatePin] = useState(''); const [error, setError] = useState('');
  const detail = useGetAdminTransactionDetail(detailId, { query: { queryKey: getGetAdminTransactionDetailQueryKey(detailId), enabled: !!detailId } });
  const history = useListAdminTransactionStatusHistory(detailId, { query: { queryKey: getListAdminTransactionStatusHistoryQueryKey(detailId), enabled: !!detailId } });
  const makeCorrection = useCreateAdminTransactionCorrection(); const changeStatus = useUpdateAdminTransactionStatus(); const processInternal = useProcessAdminInternalTransfer(); const updateTransactionDate = useUpdateAdminTransactionDate();
  const postingState = detail.data ? ledgerPostingState(detail.data.ledgerEntries) : 'not_posted';
  const statusChoices: BankTransaction['status'][] = (() => {
    const transaction = detail.data?.transaction;
    if (!transaction || transaction.status === 'completed' || transaction.status === 'reversed') return [];
    if (['deposit_request', 'withdrawal_request'].includes(transaction.type) && transaction.status === 'pending') return [];
    if (postingState === 'posted') return ['completed'];
    if (postingState === 'inconsistent') return [];
    if (transaction.status === 'pending') return ['failed', 'rejected'];
    if (transaction.status === 'failed') return ['pending'];
    return [];
  })();
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: getListAdminTransactionsQueryKey() }), client.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }), client.invalidateQueries({ queryKey: getGetAdminTransactionDetailQueryKey(detailId) }), client.invalidateQueries({ queryKey: getListAdminAccountsQueryKey() }), client.invalidateQueries({ queryKey: getListAdminTransactionStatusHistoryQueryKey(detailId) }), ...(memberId ? [client.invalidateQueries({ queryKey: getGetAdminUserDetailQueryKey(memberId) })] : [])]); };
  const submitCorrection = async (e: FormEvent) => { e.preventDefault(); if (!detail.data || !correction) return; setError(''); try { await makeCorrection.mutateAsync({ transactionId: detailId, data: { kind: correction, ...(correction === 'adjustment' ? { walletId: walletId || null, direction, amount } : {}), idempotencyKey: crypto.randomUUID(), transactionPin: pin } }); await refresh(); setCorrection(null); setAmount(''); setPin(''); } catch (err) { setError(err instanceof Error ? err.message : 'The compensating entry could not be recorded.'); } };
  const submitTransactionDate = async (e: FormEvent) => { e.preventDefault(); if (!detail.data) return; setError(''); try { await updateTransactionDate.mutateAsync({ transactionId: detailId, data: { transactionDate: transactionDateDraft || null, transactionPin: datePin, confirmed: true } }); await refresh(); setDateEditOpen(false); setDatePin(''); } catch (err) { setError(err instanceof Error ? err.message : 'The customer transaction date could not be updated.'); } };
  const submitStatus = async (e: FormEvent) => { e.preventDefault(); if (!detail.data) return; setError(''); try { await changeStatus.mutateAsync({ transactionId: detailId, data: { status: newStatus as BankTransaction['status'], transactionPin: pin, confirmed: true } }); await refresh(); setStatusModal(false); setPin(''); } catch (err) { setError(err instanceof Error ? err.message : 'Status change could not be recorded.'); } };
  const submitProcess = async (e: FormEvent) => { e.preventDefault(); if (!detail.data) return; setProcessError(''); try { await processInternal.mutateAsync({ transactionId: detailId, data: { transactionPin: processPin, confirmed: true } }); await refresh(); setProcessModal(false); setProcessPin(''); } catch (err) { setProcessError(err instanceof Error ? err.message : 'The internal transfer could not be posted.'); } };
  const exportReport = () => {
    const rows = list.data?.items || [];
    const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [['reference', 'type', 'status', 'currency', 'amount', 'description', 'customer_transaction_date', 'recorded_at'], ...rows.map(t => [t.reference, t.type, t.status, t.currency, t.amount, t.description, t.transactionDate || t.createdAt.slice(0, 10), t.createdAt])].map(row => row.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `globus-transaction-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const txTypes: TransactionType[] = ['admin_funding', 'admin_debit', 'admin_adjustment', 'reversal', 'transfer_in', 'transfer_out', 'external_transfer', 'external_transfer_in', 'deposit_request', 'withdrawal_request', 'exchange_request'];
  return <div className="space-y-3">{!compact && <Heading kicker="Account records" title="Transaction management" subtitle="Search and inspect immutable transactions and their account postings. Corrections add separate compensating entries; originals remain intact." action={<button className={quietButton} onClick={exportReport}><Download size={14} />Export report</button>} />}
    {memberId && memberDetail.data && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dce7e1] bg-[#f9fbf7] px-4 py-2.5 text-[9px]"><span className="font-semibold text-[#4b656b]">{nameOf(memberDetail.data.user)} · {memberDetail.data.user.customerId || memberDetail.data.user.email}</span><span className="text-[#758a8b]">{list.data?.total ?? '—'} matching records</span></div>}
    {memberId && <div className="flex justify-end"><button className={quietButton} onClick={exportReport}><Download size={13} />Export member report</button></div>}
    <Panel title="Search transactions" eyebrow={`${list.data?.total ?? 0} records`}>
      <div className="grid grid-cols-2 gap-2 border-b border-[#e9efec] bg-[#f8f9f4] p-3 sm:grid-cols-2 sm:gap-3 sm:p-4 xl:grid-cols-4">
        <Field label="Search" className="col-span-2 sm:col-span-1"><input data-testid="input-transaction-search" className={input} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Reference or description" /></Field>{!memberId && <Field label="Customer"><input className={input} value={customer} onChange={e => { setCustomer(e.target.value); setPage(1); }} placeholder="Name, email or ID" /></Field>}
        <Field label="Currency"><select className={input} value={currency} onChange={e => { setCurrency(e.target.value); setPage(1); }}><option value="">All currencies</option>{historicalCurrencies.map(c => <option key={c} value={c}>{c}</option>)}</select></Field><Field label="Transaction type"><select className={input} value={type} onChange={e => { setType(e.target.value); setPage(1); }}><option value="">All types</option>{txTypes.map(t => <option key={t} value={t}>{human(t)}</option>)}</select></Field>
        <Field label="Status"><select className={input} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{['pending', 'completed', 'failed', 'rejected', 'reversed'].map(s => <option key={s} value={s}>{human(s)}</option>)}</select></Field><Field label="From date"><input type="date" className={input} value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} /></Field><Field label="To date"><input type="date" className={input} value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} /></Field><div className="grid grid-cols-2 gap-2"><Field label="Minimum amount"><input className={input} inputMode="decimal" value={min} onChange={e => { setMin(e.target.value); setPage(1); }} placeholder="0.00" /></Field><Field label="Maximum amount"><input className={input} inputMode="decimal" value={max} onChange={e => { setMax(e.target.value); setPage(1); }} placeholder="0.00" /></Field><button type="button" className={quietButton + " col-span-2 justify-center sm:col-span-1"} onClick={() => { setSearch(''); setCustomer(''); setCurrency(''); setType(''); setStatus(''); setFromDate(''); setToDate(''); setMin(''); setMax(''); setPage(1); }}>Clear filters</button></div>
      </div>
      {list.isLoading ? <Skeleton /> : list.isError ? <InlineError text="Transactions could not be loaded." retry={() => list.refetch()} /> : list.data?.items.length ? <><div className="grid gap-2 p-2 sm:hidden">{list.data.items.map(t => <article key={t.id} className="rounded-xl border border-[#e7ece8] bg-[#fffefa] p-3" data-testid="mobile-transaction-card"><div className="flex items-start justify-between gap-2"><button onClick={() => { setDetailId(t.id); setError(''); }} className="min-w-0 truncate text-left font-mono text-[10px] font-bold text-[#396e73]">{t.reference}</button><StatusPill status={t.status} /></div><div className="mt-2 flex items-end justify-between gap-2"><div className="min-w-0"><p className="truncate text-[10px] font-semibold text-[#435e66]">{t.description || human(t.type)}</p><p className="mt-0.5 text-[9px] text-[#829292]">{t.counterparty || 'Globus account'} · {human(t.type)}</p></div><p className="shrink-0 font-mono text-[12px] font-bold text-[#2d4653]">{money(t.amount, t.currency)}</p></div><div className="mt-2 flex items-center justify-between border-t border-[#edf1ee] pt-2"><span className="text-[9px] text-[#788c8d]">{dateTime(t.createdAt)}</span><button className={quietButton} onClick={() => { setDetailId(t.id); setError(''); }}>Inspect</button></div></article>)}</div><div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[780px] text-left"><thead className="bg-[#f7f8f4] text-[9px] uppercase tracking-[.12em] text-[#829191]"><tr>{['Reference / description', 'Customer', 'Type', 'Currency & amount', 'Status', 'Recorded', ''].map(x => <th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody>{list.data.items.map(t => <tr key={t.id} className="border-t border-[#edf1ee] text-[10px] hover:bg-[#f8faf7]"><td className="px-4 py-3"><button onClick={() => { setDetailId(t.id); setError(''); }} className="font-mono font-bold text-[#396e73] hover:underline">{t.reference}</button><p className="mt-1 max-w-[220px] truncate text-[9px] text-[#829292]">{t.description}</p></td><td className="px-4 py-3 text-[#536d74]">{t.counterparty || 'Globus account'}</td><td className="px-4 py-3">{human(t.type)}</td><td className="px-4 py-3 font-mono font-semibold">{money(t.amount, t.currency)}</td><td className="px-4 py-3"><StatusPill status={t.status} /></td><td className="px-4 py-3 whitespace-nowrap text-[#788c8d]">{dateTime(t.createdAt)}</td><td className="px-4 py-3"><button className={quietButton} onClick={() => { setDetailId(t.id); setError(''); }}>Inspect</button></td></tr>)}</tbody></table></div><Pager page={page} pages={Math.ceil(list.data.total / list.data.pageSize)} onChange={setPage} /></> : <Empty title="No transactions found" text="The selected criteria do not match any transaction records." />}
    </Panel>
    {detailId && <Modal title="Transaction record" close={() => { setDetailId(''); setCorrection(null); setStatusModal(false); }}><div className="space-y-4">{detail.isLoading ? <Skeleton rows={3} /> : detail.isError || !detail.data ? <InlineError text="Transaction details unavailable." retry={() => detail.refetch()} /> : <>
       <div className="rounded-xl bg-[#f3f7f1] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] text-[#718588]">{detail.data.transaction.reference}</p><p className="mt-1 text-[14px] font-bold">{detail.data.transaction.description || human(detail.data.transaction.type)}</p><p className="mt-1 text-[10px] text-[#768a8c]">{detail.data.customerName} · {detail.data.customerEmail}</p></div><div className="text-right"><b className="font-mono text-[16px]">{money(detail.data.transaction.amount, detail.data.transaction.currency)}</b></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-lg border border-[#e1e9e3] bg-white/70 p-3"><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#849394]">Internal processing status</p><div className="mt-1"><StatusPill status={detail.data.transaction.status} /></div></div><div className="rounded-lg border border-[#e1e9e3] bg-white/70 p-3"><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#849394]">Wallet posting status</p><div className="mt-1"><StatusPill status={postingState} /></div></div></div><p className="mt-3 text-[9px] text-[#7d8f90]">Customer-facing date: <b>{customerTransactionDate(detail.data.transaction.transactionDate, detail.data.transaction.createdAt)}</b> · Recorded {dateTime(detail.data.transaction.createdAt)} · Initiated by {detail.data.initiatorName} ({detail.data.initiatorEmail})</p></div>
       <div><h3 className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#718588]">Immutable account postings</h3>{detail.data.ledgerEntries.length ? <div className="overflow-hidden rounded-xl border border-[#e4ebe7]"><div className="grid gap-2 p-2 sm:hidden">{detail.data.ledgerEntries.map(entry => <article key={entry.id} className="rounded-lg bg-[#f7f9f5] p-3"><div className="flex items-center justify-between gap-2"><span className="font-mono text-[9px] font-bold">{entry.id.slice(0, 9)}</span><span className="text-[9px] font-semibold uppercase text-[#6b8580]">{human(entry.side)}</span></div><div className="mt-2 flex items-center justify-between gap-2"><span className="text-[9px] text-[#75898a]">Account {entry.accountCode}</span><b className="font-mono text-[11px]">{money(entry.amount, entry.currency)}</b></div><p className="mt-1 text-[8px] text-[#849394]">Wallet {entry.walletId?.slice(0, 9) || '—'} · {dateTime(entry.createdAt)}</p></article>)}</div><div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[450px] text-left text-[9px]"><thead className="bg-[#f7f9f5] text-[#849394]"><tr>{['Entry', 'Account code', 'Wallet', 'Side', 'Amount', 'Time'].map(x => <th key={x} className="px-3 py-2">{x}</th>)}</tr></thead><tbody>{detail.data.ledgerEntries.map(entry => <tr key={entry.id} className="border-t border-[#edf0ed]"><td className="px-3 py-2 font-mono">{entry.id.slice(0, 9)}</td><td className="px-3 py-2">{entry.accountCode}</td><td className="px-3 py-2 font-mono">{entry.walletId?.slice(0, 9) || '—'}</td><td className="px-3 py-2">{human(entry.side)}</td><td className="px-3 py-2 font-mono">{money(entry.amount, entry.currency)}</td><td className="px-3 py-2">{dateTime(entry.createdAt)}</td></tr>)}</tbody></table></div></div> : <p className="text-[10px] text-[#809092]">No account posting details were returned.</p>}</div>
      {(detail.data.correctionOfTransactionId || detail.data.reversalOfTransactionId) && <p className="rounded-lg border border-[#dde8e2] p-3 text-[9px] leading-5 text-[#718588]">Correction relationship: {detail.data.reversalOfTransactionId ? `reversal of ${detail.data.reversalOfTransactionId}` : `adjustment of ${detail.data.correctionOfTransactionId}`} {detail.data.correctionReason ? `· ${detail.data.correctionReason}` : ''}</p>}
      <div><h3 className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#718588]">Status history</h3>{history.isLoading ? <Skeleton rows={2} /> : history.isError ? <InlineError text="Status history unavailable." retry={() => history.refetch()} /> : history.data?.length ? <div className="max-h-32 space-y-2 overflow-auto">{history.data.map((h, i) => <div key={`${h.timestamp}-${i}`} className="rounded-lg border border-[#e6ece8] p-3"><p className="text-[10px] font-bold">{human(h.previousStatus)} <ArrowRight className="mx-1 inline" size={11} /> {human(h.newStatus)}</p><p className="mt-1 text-[9px] text-[#7d8e90]">{h.actorName} · {dateTime(h.timestamp)} · {h.reason}</p></div>)}</div> : <p className="text-[9px] text-[#849394]">No administrative status overrides recorded.</p>}</div>
       {!correction && !statusModal && !processModal && !dateEditOpen && <div className="flex flex-wrap justify-end gap-2 border-t border-[#e9efec] pt-3"><button className={quietButton} onClick={() => { setTransactionDateDraft(transactionDateInputValue(detail.data.transaction.transactionDate, detail.data.transaction.createdAt)); setDatePin(''); setDateEditOpen(true); setError(''); }}>Edit customer date</button><button className={quietButton} onClick={() => { setCorrection('reversal'); setPin(''); }}>Create reversal</button><button className={quietButton} onClick={() => { setCorrection('adjustment'); setPin(''); }}>Record adjustment</button>{detail.data.transaction.type === 'external_transfer' && detail.data.transaction.status === 'pending' && postingState === 'not_posted' && <button className={quietButton} onClick={() => { setProcessModal(true); setProcessPin(''); setProcessError(''); }}>Process internal transfer</button>}{statusChoices.length > 0 && <button className={button} onClick={() => { setStatusModal(true); setNewStatus(statusChoices[0]); setPin(''); }}>Correct status</button>}</div>}
       {dateEditOpen && <form onSubmit={submitTransactionDate} className="space-y-3 rounded-xl border border-[#dde7e2] p-4"><h3 className="text-[11px] font-bold">Edit customer transaction date</h3><p className="text-[9px] leading-4 text-[#788b8d]">This changes the date displayed in the customer’s transaction history and dashboard only. The original record timestamp, amount, and ledger postings stay unchanged.</p><Field label="Date shown to customer"><input type="date" className={input} value={transactionDateDraft} onChange={event => setTransactionDateDraft(event.target.value)} /><button type="button" className="mt-1 text-[9px] font-semibold text-[#5a7e80] underline" onClick={() => setTransactionDateDraft('')}>Use recorded date</button></Field><Field label="Six-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className={input} value={datePin} onChange={event => setDatePin(event.target.value.replace(/\D/g, '').slice(0, 6))} /></Field><label className="flex items-start gap-2 rounded-lg bg-[#f6f7f1] p-3 text-[10px] leading-5 text-[#718386]"><input required type="checkbox" className="mt-1 accent-[#438481]" />I confirm this customer-facing date change.</label>{error && <p role="alert" className="text-[10px] text-[#a45247]">{error}</p>}<div className="flex justify-end gap-2"><button type="button" className={quietButton} onClick={() => setDateEditOpen(false)}>Cancel</button><button disabled={updateTransactionDate.isPending || datePin.length !== 6 || (transactionDateDraft || null) === detail.data.transaction.transactionDate || (!detail.data.transaction.transactionDate && transactionDateDraft === transactionDateInputValue(null, detail.data.transaction.createdAt))} className={button}>{updateTransactionDate.isPending ? 'Saving…' : 'Save date'}</button></div></form>}
      {correction && <form onSubmit={submitCorrection} className="space-y-3 rounded-xl border border-[#dde7e2] p-4"><h3 className="text-[11px] font-bold">{correction === 'reversal' ? 'Create compensating reversal' : 'Record compensating adjustment'}</h3><p className="text-[9px] leading-4 text-[#788b8d]">The original transaction and account postings remain unchanged. A new compensating entry will be created.</p>{correction === 'adjustment' && <><Field label="Wallet"><select required className={input} value={walletId} onChange={e => setWalletId(e.target.value)}><option value="">Select a wallet from original entries</option>{detail.data.ledgerEntries.filter(x => x.walletId).map(x => <option key={x.id} value={x.walletId!}>{x.currency} · {x.accountCode} · {x.walletId?.slice(0, 10)}</option>)}</select></Field><div className="grid grid-cols-2 gap-2"><Field label="Direction"><select className={input} value={direction} onChange={e => setDirection(e.target.value as 'credit' | 'debit')}><option value="credit">Credit</option><option value="debit">Debit</option></select></Field><Field label="Amount"><input required className={input} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></Field></div></>}<Field label="Six-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className={input} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>{error && <p className="text-[10px] text-[#a45247]">{error}</p>}<div className="flex justify-end gap-2"><button type="button" className={quietButton} onClick={() => setCorrection(null)}>Cancel</button><button disabled={makeCorrection.isPending || pin.length !== 6 || (correction === 'adjustment' && (!walletId || !amount))} className={button}>Confirm compensating entry</button></div></form>}
       {statusModal && <form onSubmit={submitStatus} className="space-y-3 rounded-xl border border-[#dde7e2] p-4"><h3 className="text-[11px] font-bold">Correct internal processing status</h3><p className="text-[9px] leading-4 text-[#788b8d]">This changes the recorded status only. It never changes existing wallet postings or balances. A completed state requires balanced postings to exist; posted transactions must use a compensating reversal.</p><Field label="New status"><select className={input} value={newStatus} onChange={e => setNewStatus(e.target.value)}>{statusChoices.map(value => <option key={value} value={value}>{human(value)}</option>)}</select></Field><Field label="Six-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className={input} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></Field><label className="flex items-start gap-2 rounded-lg bg-[#f6f7f1] p-3 text-[10px] leading-5 text-[#718386]"><input required type="checkbox" className="mt-1 accent-[#438481]" />I reviewed the wallet posting state and confirm this status correction.</label>{error && <p className="text-[10px] text-[#a45247]">{error}</p>}<div className="flex justify-end gap-2"><button type="button" className={quietButton} onClick={() => setStatusModal(false)}>Cancel</button><button disabled={changeStatus.isPending || pin.length !== 6 || newStatus === detail.data.transaction.status} className={button}>Confirm status correction</button></div></form>}
       {processModal && <form onSubmit={submitProcess} className="space-y-3 rounded-xl border border-[#dde7e2] p-4"><h3 className="text-[11px] font-bold">Process pending transfer</h3><p className="text-[9px] leading-4 text-[#788b8d]">This action checks current restrictions and available balance, then records equal wallet debit and credit postings. It updates Globus balances only.</p><Field label="Six-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className={input} value={processPin} onChange={e => setProcessPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></Field><label className="flex items-start gap-2 rounded-lg bg-[#f6f7f1] p-3 text-[10px] leading-5 text-[#718386]"><input required type="checkbox" className="mt-1 accent-[#438481]" />I confirm processing this pending transfer in Globus.</label>{processError && <p role="alert" className="text-[10px] text-[#a45247]">{processError}</p>}<div className="flex justify-end gap-2"><button type="button" className={quietButton} onClick={() => setProcessModal(false)}>Cancel</button><button disabled={processInternal.isPending || processPin.length !== 6} className={button}>{processInternal.isPending ? 'Processing…' : 'Confirm & record transfer'}</button></div></form>}
    </>}</div></Modal>}
  </div>;
}

function AuditPage() {
  const [search, setSearch] = useState(''); const [action, setAction] = useState(''); const [page, setPage] = useState(1);
  const params = useMemo(() => ({ ...(search.trim() ? { search: search.trim() } : {}), ...(action.trim() ? { action: action.trim() } : {}), page, pageSize: 30 }), [search, action, page]);
  const logs = useListAdminAuditLogs(params, { query: { queryKey: getListAdminAuditLogsQueryKey(params) } });
  return <><Heading kicker="Immutable record" title="Administrative audit trail" subtitle="Search decisions and changes by actor, member, action or reason. These logs are read-only." /><Panel title="Audit events" eyebrow={`${logs.data?.total ?? 0} events`}><div className="grid gap-2 border-b border-[#e9efec] bg-[#f8f9f4] p-4 sm:grid-cols-2"><Field label="Search actor, member, email or reason"><input className={input} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search audit records" /></Field><Field label="Action filter"><input className={input} value={action} onChange={e => { setAction(e.target.value); setPage(1); }} placeholder="Action name" /></Field></div>{logs.isLoading ? <Skeleton /> : logs.isError ? <InlineError text="Audit records could not be loaded." retry={() => logs.refetch()} /> : logs.data?.items.length ? <><div className="divide-y divide-[#edf0ed]">{logs.data.items.map(log => <article key={log.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_170px]"><div><div className="flex flex-wrap items-center gap-2"><Pill>{human(log.action)}</Pill><span className="text-[9px] text-[#849395]">Target: {log.targetName} · {log.targetEmail}</span></div><p className="mt-2 text-[10px] text-[#536e74]">Performed by <b>{log.actorName}</b> · {log.actorEmail}</p><p className="mt-1 whitespace-pre-wrap text-[10px] leading-5 text-[#718588]">{log.reason}</p></div><time className="text-[9px] text-[#89999a] sm:text-right">{dateTime(log.createdAt)}</time></article>)}</div><Pager page={page} pages={Math.ceil(logs.data.total / logs.data.pageSize)} onChange={setPage} /></> : <Empty title="No audit events match" text="Change the search or action filter to see other recorded events." />}</Panel></>;
}

function SupportConfigurationPage() {
  const client = useQueryClient();
  const settings = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  const update = useUpdateAdminSettings();
  const [url, setUrl] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setMessage('');
    const supportUrl = (url ?? settings.data?.defaultSupportUrl ?? '').trim();
    const supportEmailValue = (email ?? settings.data?.supportEmail ?? '').trim();
    if (supportUrl) {
      try {
        if (new URL(supportUrl).protocol !== 'https:') { setError('Use a secure HTTPS support URL.'); return; }
      } catch { setError('Enter a valid HTTPS support URL.'); return; }
    }
    try {
      const result = await update.mutateAsync({ data: {
        fundingLimit: settings.data?.fundingLimit || '',
        secondApprovalThreshold: settings.data?.secondApprovalThreshold || '',
        vaultPlan1mPrice: settings.data?.vaultPlan1mPrice || '',
        vaultPlan3mPrice: settings.data?.vaultPlan3mPrice || '',
        vaultPlan1yPrice: settings.data?.vaultPlan1yPrice || '',
        customerEmailSenderDisplayName: settings.data?.customerEmailSenderDisplayName || '',
        defaultSupportUrl: supportUrl || null,
        supportEmail: supportEmailValue || null,
        transactionPin: pin,
      }});
      setUrl(result.defaultSupportUrl); setEmail(result.supportEmail);
      await client.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
      setPin(''); setMessage('Support configuration saved and audit recorded.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Support configuration could not be saved.'); }
  };
  return <>
    <Heading kicker="Customer care operations" title="Support configuration" subtitle="Configure the secure support destination used in transfer alerts and customer support entry points." action={<Link href="/admin/support" className={quietButton}><MessageSquareText size={13}/> Open inbox</Link>} />
    {settings.isError && <InlineError text="Support settings could not be loaded." retry={() => settings.refetch()} />}
    {error && <p role="alert" className="mb-3 rounded-lg bg-[#fff2ed] p-3 text-[10px] text-[#a45247]">{error}</p>}
    {message && <p role="status" className="mb-3 rounded-lg bg-[#eef7f0] p-3 text-[10px] text-[#47755e]">{message}</p>}
    <form onSubmit={save} className="space-y-4">
      <Panel title="Private Vault and account support" eyebrow="Customer-facing routing" note="The default destination is used when no sender-specific support URL is configured. Keep the destination on a domain controlled by Globus.">
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Default support inbox URL (HTTPS)"><input type="url" className={input} placeholder="https://www.global-internetbanking.globus.website/support" value={url ?? settings.data?.defaultSupportUrl ?? ''} onChange={e => setUrl(e.target.value)} /></Field>
          <Field label="Support email"><input type="email" className={input} placeholder="support@globus.website" value={email ?? settings.data?.supportEmail ?? ''} onChange={e => setEmail(e.target.value)} /></Field>
          <div className="sm:col-span-2 rounded-xl bg-[#f3f7f2] p-3 text-[10px] leading-5 text-[#718588]">
            <p className="font-bold text-[#3e6263]">Routing and access safeguards</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Private Vault conversations remain visible only to authorized support operators.</li>
              <li>Transfer alerts carry their transfer reference into the support conversation.</li>
              <li>HTTPS is required for the web destination; the email contact is rendered as a separate mail link.</li>
              <li>Changing these values does not grant customer Vault access or change account entitlements.</li>
            </ul>
          </div>
        </div>
      </Panel>
      <Panel title="Confirm configuration" eyebrow="Transaction PIN required">
        <div className="space-y-3 p-4"><Field label="Six-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className={input} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></Field><button disabled={settings.isLoading || update.isPending || pin.length !== 6} className={button}>{update.isPending ? 'Saving…' : 'Save support configuration'}</button></div>
      </Panel>
    </form>
  </>;
}

function SettingsPage() {
  const client = useQueryClient();
  const settings = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  const update = useUpdateAdminSettings();
  const { openUserProfile } = useClerk();
  const { user } = useUser();
  const [activeCategory, setActiveCategory] = useState<'general' | 'security' | 'notifications' | 'display' | 'operations'>('general');
  const [notifications, setNotifications] = useState(() => {
    if (typeof window === 'undefined') return { email: true, sms: true, inApp: true, security: true, product: false };
    try { return { email: true, sms: true, inApp: true, security: true, product: false, ...JSON.parse(window.localStorage.getItem('globus-admin-notification-preferences') || '{}') }; }
    catch { return { email: true, sms: true, inApp: true, security: true, product: false }; }
  });
  const [display, setDisplay] = useState(() => {
    if (typeof window === 'undefined') return { theme: 'light', density: 'comfortable', language: 'English' };
    try { return { theme: 'light', density: 'comfortable', language: 'English', ...JSON.parse(window.localStorage.getItem('globus-admin-display-preferences') || '{}') }; }
    catch { return { theme: 'light', density: 'comfortable', language: 'English' }; }
  });
  const [limit, setLimit] = useState('');
  const [threshold, setThreshold] = useState('');
  const [vaultPlan1mPrice, setVaultPlan1mPrice] = useState<string | null>(null);
  const [vaultPlan3mPrice, setVaultPlan3mPrice] = useState<string | null>(null);
  const [vaultPlan1yPrice, setVaultPlan1yPrice] = useState<string | null>(null);
  const [customerEmailSenderDisplayName, setCustomerEmailSenderDisplayName] = useState<string | null>(null);
  const [defaultSupportUrl, setDefaultSupportUrl] = useState<string | null>(null);
  const [supportEmail, setSupportEmail] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const categories = [
    { id: 'general', label: 'General', detail: 'Account overview', icon: Users },
    { id: 'security', label: 'Security', detail: 'Sign-in and protection', icon: ShieldCheck },
    { id: 'notifications', label: 'Notifications', detail: 'Email, SMS and alerts', icon: Bell },
    { id: 'display', label: 'Display', detail: 'Theme and language', icon: Monitor },
    { id: 'operations', label: 'Operations', detail: 'Bank-wide policy settings', icon: SlidersHorizontal },
  ] as const;
  const saveNotifications = (key: keyof typeof notifications, value: boolean) => {
    const next = { ...notifications, [key]: value };
    setNotifications(next);
    try { window.localStorage.setItem('globus-admin-notification-preferences', JSON.stringify(next)); } catch { /* Preferences remain active for this session. */ }
  };
  const saveDisplay = (key: keyof typeof display, value: string) => {
    const next = { ...display, [key]: value };
    setDisplay(next);
    try { window.localStorage.setItem('globus-admin-display-preferences', JSON.stringify(next)); } catch { /* Preferences remain active for this session. */ }
  };
  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const result = await update.mutateAsync({
        data: {
          fundingLimit: limit || settings.data?.fundingLimit || '',
          secondApprovalThreshold: threshold || settings.data?.secondApprovalThreshold || '',
          vaultPlan1mPrice: vaultPlan1mPrice ?? settings.data?.vaultPlan1mPrice ?? '',
          vaultPlan3mPrice: vaultPlan3mPrice ?? settings.data?.vaultPlan3mPrice ?? '',
          vaultPlan1yPrice: vaultPlan1yPrice ?? settings.data?.vaultPlan1yPrice ?? '',
          customerEmailSenderDisplayName: customerEmailSenderDisplayName ?? settings.data?.customerEmailSenderDisplayName ?? '',
          defaultSupportUrl: (defaultSupportUrl ?? settings.data?.defaultSupportUrl ?? '') || null,
          supportEmail: (supportEmail ?? settings.data?.supportEmail ?? '') || null,
          transactionPin: pin,
        },
      });
      setCustomerEmailSenderDisplayName(result.customerEmailSenderDisplayName);
      setDefaultSupportUrl(result.defaultSupportUrl);
      setSupportEmail(result.supportEmail);
      setVaultPlan1mPrice(result.vaultPlan1mPrice);
      setVaultPlan3mPrice(result.vaultPlan3mPrice);
      setVaultPlan1yPrice(result.vaultPlan1yPrice);
      await client.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
      setMessage('Operations, support contacts, transfer-alert sender name, and Vault plan settings saved.');
      setPin('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Settings could not be updated.');
    }
  };
  const ToggleRow = ({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) => (
    <div className="flex min-w-0 items-center justify-between gap-4 rounded-xl border border-[#e0e8ed] bg-white p-3.5">
      <div className="min-w-0"><p className="text-[11px] font-bold text-[#233e53]">{title}</p><p className="mt-1 text-[9px] leading-4 text-[#7a8d99]">{description}</p></div>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-[#168b68]' : 'bg-[#c5d0d8]'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} /></button>
    </div>
  );
  return (
    <div className="space-y-4">
      <Heading kicker="Account preferences" title="Account settings" subtitle="Manage your administrator profile, security, notifications and display preferences." />
      <div className="grid items-start gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[#dce5eb] bg-white p-2.5 shadow-sm">
          <p className="px-3 pb-2 pt-1 text-[8px] font-extrabold uppercase tracking-[.16em] text-[#8295a0]">Settings categories</p>
          <nav aria-label="Account settings categories" className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
            {categories.map(item => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setActiveCategory(item.id)} aria-current={activeCategory === item.id ? 'page' : undefined} className={`flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-3 text-left transition ${activeCategory === item.id ? 'bg-[#e4f4ed] text-[#164c4b]' : 'text-[#526b7b] hover:bg-[#f2f6f8]'}`}><Icon size={17} className="shrink-0" /><span className="min-w-0"><span className="block text-[10px] font-bold">{item.label}</span><span className="mt-0.5 block truncate text-[8px] opacity-75">{item.detail}</span></span><ChevronRight size={13} className="ml-auto hidden shrink-0 lg:block" /></button>; })}
          </nav>
        </aside>
        <main className="min-w-0 space-y-4">
          {activeCategory === 'general' && <>
            <Panel title="General account information" eyebrow="Administrator profile" action={<button type="button" onClick={() => openUserProfile()} className={button}>Manage profile</button>}>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <div><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#8295a0]">Full name</p><p className="mt-1 text-[12px] font-semibold text-[#233e53]">{user?.fullName || 'Administrator'}</p></div>
                <div><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#8295a0]">Email address</p><p className="mt-1 break-all text-[12px] font-semibold text-[#233e53]">{user?.primaryEmailAddress?.emailAddress || 'Not available'}</p></div>
                <div><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#8295a0]">Account provider</p><p className="mt-1 text-[11px] font-semibold text-[#496578]">Clerk authentication</p></div>
                <div><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#8295a0]">Workspace</p><p className="mt-1 text-[11px] font-semibold text-[#496578]">GLOBUS BANK · Operations</p></div>
              </div>
            </Panel>
            <Panel title="Account preferences" eyebrow="Quick overview" note="Choose a category to update the preferences available to your administrator account.">
              <div className="grid gap-2 p-3 sm:grid-cols-2"><button type="button" onClick={() => setActiveCategory('notifications')} className="rounded-xl border border-[#e0e8ed] p-3 text-left hover:bg-[#f5f9f7]"><p className="text-[10px] font-bold text-[#233e53]">Notification preferences</p><p className="mt-1 text-[9px] text-[#7a8d99]">Manage email, SMS, in-app and security alerts.</p></button><button type="button" onClick={() => setActiveCategory('display')} className="rounded-xl border border-[#e0e8ed] p-3 text-left hover:bg-[#f5f9f7]"><p className="text-[10px] font-bold text-[#233e53]">Display preferences</p><p className="mt-1 text-[9px] text-[#7a8d99]">Set your appearance, density and language.</p></button></div>
            </Panel>
          </>}
          {activeCategory === 'security' && <>
            <Panel title="Sign-in and account security" eyebrow="Clerk-managed authentication" note="Authentication credentials and multi-factor options are managed securely by Clerk.">
              <div className="space-y-3 p-4"><div className="flex items-center justify-between gap-3 rounded-xl bg-[#f2f7f5] p-3"><div><p className="text-[10px] font-bold text-[#233e53]">Administrator identity</p><p className="mt-1 text-[9px] text-[#718795]">Signed in as {user?.primaryEmailAddress?.emailAddress || 'your administrator account'}</p></div><span className="rounded-full bg-[#e0f3e9] px-2.5 py-1 text-[8px] font-bold text-[#24734f]">Authenticated</span></div><p className="text-[9px] leading-5 text-[#718795]">Use the secure identity settings to update your password, connected sign-in methods and available verification options.</p><button type="button" onClick={() => openUserProfile()} className={button}>Open security and profile settings</button></div>
            </Panel>
            <Panel title="Administrative safeguards" eyebrow="Protected operations"><div className="p-4 text-[9px] leading-5 text-[#718795]">Sensitive banking operations continue to require the existing server-side authorization, transaction PIN validation and audit logging. These controls are not changed by display preferences.</div></Panel>
          </>}
          {activeCategory === 'notifications' && <>
            <Panel title="Notification preferences" eyebrow="Delivery channels" note="Choose which notification categories you want to receive. Changes are saved in this browser for this administrator profile.">
              <div className="grid gap-3 p-3 xl:grid-cols-2">
                <div className="space-y-2"><p className="px-1 text-[9px] font-extrabold uppercase tracking-[.12em] text-[#64818b]">Communication channels</p><ToggleRow title="Email notifications" description="Administrative updates and account notices by email." checked={notifications.email} onChange={v => saveNotifications('email',v)} /><ToggleRow title="SMS notifications" description="Time-sensitive operational alerts by SMS." checked={notifications.sms} onChange={v => saveNotifications('sms',v)} /><ToggleRow title="In-app notifications" description="Show notifications inside the Globus workspace." checked={notifications.inApp} onChange={v => saveNotifications('inApp',v)} /></div>
                <div className="space-y-2"><p className="px-1 text-[9px] font-extrabold uppercase tracking-[.12em] text-[#64818b]">Notification types</p><ToggleRow title="Security alerts" description="Sign-in, access and account-security events." checked={notifications.security} onChange={v => saveNotifications('security',v)} /><ToggleRow title="Product and service updates" description="Non-critical product news and workspace updates." checked={notifications.product} onChange={v => saveNotifications('product',v)} /></div>
              </div>
            </Panel>
            <p className="rounded-xl border border-[#e3eaf0] bg-[#f7fafb] p-3 text-[9px] leading-5 text-[#718795]">These are local administrator display preferences. They do not unsubscribe customers, change transaction-alert delivery, or alter mandatory security and banking notifications.</p>
          </>}
          {activeCategory === 'display' && <>
            <Panel title="Display preferences" eyebrow="Workspace appearance" note="Choose a comfortable workspace presentation for this browser.">
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <Field label="Theme"><select className={input} value={display.theme} onChange={e => saveDisplay('theme',e.target.value)}><option value="light">Light · Globus classic</option><option value="system">Follow device preference</option></select></Field>
                <Field label="Interface density"><select className={input} value={display.density} onChange={e => saveDisplay('density',e.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></Field>
                <Field label="Language"><select className={input} value={display.language} onChange={e => saveDisplay('language',e.target.value)}><option>English</option><option>French</option><option>Spanish</option></select></Field>
              </div>
              <div className="mx-4 mb-4 rounded-xl border border-[#dce7eb] bg-[#f5f9fa] p-3"><p className="text-[9px] font-bold text-[#345367]">Preview</p><p className="mt-1 text-[9px] text-[#718795]">{display.theme === 'system' ? 'Device-based theme preference' : 'Globus classic light theme'} · {display.density} layout · {display.language}</p></div>
            </Panel>
          </>}
          {activeCategory === 'operations' && <>
                  {settings.isError && <InlineError text="Operational settings could not be loaded." retry={() => settings.refetch()} />}
      {error && <p role="alert" className="mb-4 rounded-lg bg-[#fff2ed] p-3 text-[10px] text-[#a45247]">{error}</p>}
      {message && <p role="status" className="mb-4 rounded-lg bg-[#eef7f0] p-3 text-[10px] text-[#47755e]">{message}</p>}
      <form onSubmit={saveSettings} className="space-y-5">
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Panel title="Funding controls" eyebrow="Global policy" note="Funding is capped at 100,000,000 per currency. Operations may set a lower maximum.">
            <div className="space-y-3 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-[#f2f6f1] p-4"><p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#7d8d8e]">Current maximum</p><p className="mt-2 font-mono text-[17px] font-semibold">{settings.data?.fundingLimit ? `${settings.data.fundingLimit} / currency` : '—'}</p></div>
                <div className="rounded-xl bg-[#f2f6f1] p-4"><p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#7d8d8e]">Second approval</p><p className="mt-2 font-mono text-[17px] font-semibold">{settings.data?.secondApprovalThreshold || '—'}</p></div>
              </div>
              <p className="text-[9px] text-[#829294]">Frozen-wallet incoming policy: {human(settings.data?.frozenIncomingPolicy)}</p>
              <Field label="Maximum funding amount per currency"><input required className={input} inputMode="decimal" pattern="[0-9]+(\\.[0-9]{1,2})?" min="0.01" max="100000000" value={limit || settings.data?.fundingLimit || ''} onChange={e => setLimit(e.target.value)} /></Field>
              <Field label="Second administrator approval threshold"><input required className={input} inputMode="decimal" pattern="[0-9]+(\\.[0-9]{1,2})?" min="0" max="100000000" value={threshold || settings.data?.secondApprovalThreshold || ''} onChange={e => setThreshold(e.target.value)} /></Field>
            </div>
          </Panel>
          <Panel title="Private Vault plan prices" eyebrow="Paystack checkout" note="Access activates automatically after Paystack confirms payment. Administrators cannot manually approve subscriptions.">
            <div className="space-y-3 p-5">
              <div className="rounded-xl border border-[#e4e9df] bg-[#f8faf5] p-3">
                <p className="mb-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#6f817d]">Access plans · NGN</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="1 month"><input required className={input} inputMode="decimal" pattern="[0-9]+(\\.[0-9]{1,2})?" value={vaultPlan1mPrice ?? settings.data?.vaultPlan1mPrice ?? '12000.00'} onChange={e => setVaultPlan1mPrice(e.target.value)} /></Field>
                  <Field label="3 months"><input required className={input} inputMode="decimal" pattern="[0-9]+(\\.[0-9]{1,2})?" value={vaultPlan3mPrice ?? settings.data?.vaultPlan3mPrice ?? '22000.00'} onChange={e => setVaultPlan3mPrice(e.target.value)} /></Field>
                  <Field label="1 year"><input required className={input} inputMode="decimal" pattern="[0-9]+(\\.[0-9]{1,2})?" value={vaultPlan1yPrice ?? settings.data?.vaultPlan1yPrice ?? '79000.00'} onChange={e => setVaultPlan1yPrice(e.target.value)} /></Field>
                </div>
              </div>
            </div>
          </Panel>
        </div>
        <Panel title="Customer transfer-email identity" eyebrow="Server-managed sender">
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <Field label="Transfer-alert display name">
              <input
                required
                maxLength={80}
                className={input}
                value={customerEmailSenderDisplayName ?? settings.data?.customerEmailSenderDisplayName ?? ''}
                onChange={event => setCustomerEmailSenderDisplayName(event.target.value)}
                autoComplete="organization"
                data-testid="input-transfer-alert-display-name"
              />
            </Field>
            <div className="rounded-xl bg-[#f2f6f1] p-4">
              <p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#7d8d8e]">Fixed email domain</p>
              <p className="mt-2 font-mono text-[13px] font-semibold">@{settings.data?.customerEmailSenderDomain || 'globus.website'}</p>
            </div>
            <p className="text-[9px] leading-4 text-[#829294] sm:col-span-2">This display name applies to customer transfer alerts only. The verified sender address and fixed Globus domain remain unchanged; password and security emails keep their existing sender identity.</p>
          </div>
        </Panel>
        <Panel title="Support contact settings" eyebrow="Transfer alerts and customer support" note="These global values are used when a sender has not configured a custom support URL.">
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <Field label="Default support URL (HTTPS)">
              <input className={input} type="url" placeholder="https://www.global-internetbanking.globus.website/support" value={defaultSupportUrl ?? settings.data?.defaultSupportUrl ?? ''} onChange={event => setDefaultSupportUrl(event.target.value)} autoComplete="url" />
            </Field>
            <Field label="Support email address">
              <input className={input} type="email" placeholder="support@globus.website" value={supportEmail ?? settings.data?.supportEmail ?? ''} onChange={event => setSupportEmail(event.target.value)} autoComplete="email" />
            </Field>
            <p className="text-[9px] leading-4 text-[#829294] sm:col-span-2">Transfer alert links automatically include the transfer reference. A sender-specific custom URL overrides the default URL. The email contact is shown as a separate secure mailto link.</p>
          </div>
        </Panel>
        <Panel title="Exchange-rate quotes" eyebrow="Current rate sources" note="Frankfurter is primary; Grey is a read-only fallback. Neither is used to move money.">
          <div className="space-y-3 p-5 text-[10px] leading-5 text-[#657c82]">
            <p>Globus uses Frankfurter’s published reference rates when a transfer pair is selected. Quotes are cached briefly and refreshed; the rate and retrieval time used are saved with the Globus transaction record.</p>
            <p>If Frankfurter cannot quote a pair, Globus tries Grey’s dedicated rate endpoint. If neither source can provide a valid rate, the transfer is blocked rather than using an administrator-entered or guessed value.</p>
            <p>Globus requests rates only. It does not call any Grey swap, payout, or transfer endpoints. A quote does not confirm that an outside bank received or sent money.</p>
          </div>
        </Panel>
        <Panel title="Confirm and save" eyebrow="Audit recorded automatically">
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <div className="space-y-3 sm:col-span-2"><Field label="Six-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className={input} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></Field><button disabled={settings.isLoading || update.isPending || pin.length !== 6} className={`${button} w-full`}>{update.isPending ? 'Saving…' : 'Save settings'}</button></div>
          </div>
        </Panel>
      </form>
      <div className="mt-5"><LegacyWalletCurrencyMigrationPanel /></div>
          </>}
        </main>
      </div>
    </div>
  );
}

function LegacyWalletCurrencyMigrationPanel() {
  const client = useQueryClient();
  const preview = useGetAdminWalletCurrencyMigrationPreview({
    query: { queryKey: getGetAdminWalletCurrencyMigrationPreviewQueryKey() },
  });
  const convert = useConvertAdminWalletCurrenciesToUsd();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pin, setPin] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const eligible = preview.data?.items.filter(item => item.eligible) ?? [];
  const selectable = eligible.slice(0, 500);
  const selected = selectable.filter(item => selectedIds.includes(item.walletId));
  const toggle = (walletId: string) => setSelectedIds(current =>
    current.includes(walletId) ? current.filter(id => id !== walletId) : [...current, walletId],
  );
  const toggleAll = () => setSelectedIds(current =>
    current.length === selectable.length ? [] : selectable.map(item => item.walletId),
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setResultMessage('');
    if (!selected.length) {
      setError('Select at least one eligible wallet.');
      return;
    }
    if (!window.confirm(`Convert ${selected.length} legacy wallet balance(s) using the displayed rates? This creates permanent audited ledger entries; original transactions remain unchanged.`)) return;
    try {
      const result = await convert.mutateAsync({
        data: {
          conversions: selected.map(item => ({
            walletId: item.walletId,
            sourceAmount: item.sourceAmount,
            exchangeRate: item.exchangeRate ?? '0',
            rateUpdatedAt: item.rateUpdatedAt ?? new Date().toISOString(),
          })),
          transactionPin: pin,
          confirmed: true,
        },
      });
      setResultMessage(`${result.convertedCount} wallet balance(s) converted to USD. The original transaction history was preserved.`);
      setSelectedIds([]);
      setPin('');
      setConfirmed(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: getGetAdminWalletCurrencyMigrationPreviewQueryKey() }),
        client.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }),
        client.invalidateQueries({ queryKey: getListAdminAccountsQueryKey() }),
        client.invalidateQueries({ queryKey: getListAdminAuditLogsQueryKey() }),
        client.invalidateQueries({ queryKey: getListAdminTransactionsQueryKey() }),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The conversion was not completed.');
    }
  };

  return (
    <Panel title="Convert retired-currency balances to USD" eyebrow="Audited conversion" note="Only balances in retired wallet currencies appear here. Rates are rechecked before posting; the original ledger history is preserved.">
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e7e8d9] bg-[#faf9f0] p-3">
          <p className="text-[10px] leading-4 text-[#72643d]">
            {preview.data ? `${preview.data.eligibleCount} eligible · ${preview.data.blockedCount} blocked` : 'Loading wallet balances and current rates…'}
            {eligible.length > 500 ? ' · Select up to 500 per batch' : ''}
          </p>
          <button type="button" className={quietButton} onClick={() => { setError(''); void preview.refetch(); }} disabled={preview.isFetching}>Refresh preview</button>
        </div>
        {preview.isError && <InlineError text="Legacy wallet balances could not be previewed." retry={() => void preview.refetch()} />}
        {error && <p role="alert" className="rounded-lg bg-[#fff2ed] p-3 text-[10px] text-[#a45247]">{error}</p>}
        {resultMessage && <p role="status" className="rounded-lg bg-[#eef7f0] p-3 text-[10px] text-[#47755e]">{resultMessage}</p>}
        {preview.data && (
          <div className="overflow-x-auto rounded-xl border border-[#e4ebe8]">
            <table className="w-full min-w-[780px] text-left text-[10px]">
              <thead className="bg-[#f7f8f4] text-[9px] uppercase tracking-[.1em] text-[#829191]"><tr>
                <th className="px-3 py-2"><input aria-label="Select all eligible wallets" type="checkbox" checked={selectable.length > 0 && selected.length === selectable.length} onChange={toggleAll} /></th>
                <th className="px-3 py-2">Member / wallet</th><th className="px-3 py-2">Source balance</th><th className="px-3 py-2">USD estimate</th><th className="px-3 py-2">Rate · source</th><th className="px-3 py-2">Status</th>
              </tr></thead>
              <tbody>{preview.data.items.map(item => <tr key={item.walletId} className="border-t border-[#edf1ee]">
                <td className="px-3 py-2"><input type="checkbox" aria-label={`Select ${item.memberName} ${item.currency} wallet`} checked={selectedIds.includes(item.walletId)} disabled={!item.eligible || !selectable.some(row => row.walletId === item.walletId)} onChange={() => toggle(item.walletId)} /></td>
                <td className="px-3 py-2"><b>{item.memberName}</b><p className="mt-0.5 text-[9px] text-[#829292]">{item.email} · {item.customerId || 'No Customer ID'} · {item.currency}</p></td>
                <td className="px-3 py-2 font-mono">{money(item.sourceAmount, item.currency)}</td>
                <td className="px-3 py-2 font-mono">{item.targetAmount ? money(item.targetAmount, 'USD') : '—'}</td>
                <td className="px-3 py-2 font-mono">{item.exchangeRate ? `${item.exchangeRate} · ${item.rateProvider}` : 'Unavailable'}</td>
                <td className="px-3 py-2">{item.eligible ? <Pill tone="good">Eligible</Pill> : <span className="text-[#a45247]">{item.blockReason}</span>}</td>
              </tr>)}
              {!preview.data.items.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#819195]">No legacy wallet balances need conversion.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {selected.length > 0 && <form onSubmit={submit} className="grid gap-3 rounded-xl border border-[#dce7e5] bg-[#fbfcf9] p-4 sm:grid-cols-2">
          <div className="space-y-3">
            <Field label="Administrator transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" className={input} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>
            <label className="flex items-start gap-2 text-[9px] leading-4 text-[#647a7f]"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5" />I reviewed the displayed balances and rates. Each conversion will create a new audited transaction and will not alter prior entries.</label>
            <button className={button} disabled={!confirmed || pin.length !== 6 || convert.isPending}>{convert.isPending ? 'Converting…' : `Convert ${selected.length} selected wallet(s)`}</button>
          </div>
          <p className="sm:col-span-2 text-[9px] text-[#829294]">Estimated total selected balance: {selected.map(item => `${money(item.sourceAmount, item.currency)} → ${money(item.targetAmount ?? '0', 'USD')}`).join(' · ')}</p>
        </form>}
      </div>
    </Panel>
  );
}

function LogoutPage() {
  const { signOut } = useClerk();
  return <div className="mx-auto max-w-lg py-12"><div className={`${box} p-7 text-center`}><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#edf4ef] text-[#4c8580]"><LogOut size={20} /></div><p className="mt-4 text-[9px] font-bold uppercase tracking-[.18em] text-[#568887]">Secure session</p><h1 className="mt-1 text-[22px] font-extrabold tracking-[-.04em]">Sign out of Globus</h1><p className="mx-auto mt-2 max-w-sm text-[11px] leading-5 text-[#7c8e91]">Your session will end and you will return to the Globus sign-in page.</p><button className={`${button} mt-5`} onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })}>Sign out <LogOut size={14} /></button></div></div>;
}
