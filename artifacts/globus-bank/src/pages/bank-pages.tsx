import { Link, useRoute } from 'wouter';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Calculator,
  Building2,
  CreditCard,
  Download,
  FileText,
  Globe2,
  History,
  LockKeyhole,
  Printer,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAdminAccessQueryKey,
  getGetAdminSummaryQueryKey,
  getGetAdminUserDetailQueryKey,
  getGetBankDashboardQueryKey,
  getGetBankProfileQueryKey,
  getHealthCheckQueryKey,
  getListAdminLedgerQueryKey,
  getListAdminLedgerRequestsQueryKey,
  getListAdminTransactionStatusHistoryQueryKey,
  getListAdminUsersQueryKey,
  getListBankExchangeRatesQueryKey,
  getListInternationalTransferRequestsQueryKey,
  getListBankTransactionsQueryKey,
  getListBankWalletsQueryKey,
  getListBankSavedPaymentMethodsQueryKey,
  useCreateAdminFunding,
  useCreateBankTransfer,
  useCreateBankSavedPaymentMethod,
  useCreateInternationalTransferRequest,
  useCreateLedgerRequest,
  useGetAdminAccess,
  useGetAdminSummary,
  useGetAdminUserDetail,
  useGetBankDashboard,
  useGetBankProfile,
  useHealthCheck,
  useListAdminLedger,
  useListAdminLedgerRequests,
  useListAdminTransactionStatusHistory,
  useListAdminUsers,
  useListBankTransactions,
  useListBankWallets,
  useListBankSavedPaymentMethods,
  useListBankExchangeRates,
  useListInternationalTransferRequests,
  useUpdateAdminUserStatus,
  useUpdateAdminTransactionStatus,
  useReviewAdminLedgerRequest,
  useResetAdminUserTransactionPin,
  useUpdateTransactionPin,
  useUpdateBankProfile,
  useUpsertBankExchangeRate,
  useDeleteBankSavedPaymentMethod,
} from '@workspace/api-client-react';
import type { AdminLedgerRequest, AdminUser, BankTransaction, InternationalTransferRequest, Wallet, SavedPaymentMethod } from '@workspace/api-client-react';
import { GlobusLoader } from '@/components/globus-loader';
import { BankSelect } from '@/components/bank-select';
import { CountrySelect } from '@/components/country-select';
import { InstallAppButton } from '@/components/pwa-install-prompt';
import { countries } from '@/lib/countries';
import { customerProfileFieldLabels, formatCustomerProfileValue, getMissingCustomerProfileFields } from '@/lib/customer-profile';
import { destinationCurrencyForCountry } from '@/lib/destination-currency';
import { customerTransactionDate } from '@/lib/transaction-date';
import { TransferReceiptModal } from '@/components/transfer/transfer-receipt';
import { PrivateVaultPanel } from '@/components/private-vault-panel';
import { CompactExpenseTracker } from '@/pages/personal-finance/personal-finance';
import { LandingPageHeader } from '@/components/landing-page-header';
import { AppLanguageSelector } from '@/components/app-language-selector';
import { useLanguage } from '@/lib/i18n';
const currencies = ['USD', 'EUR', 'GBP', 'CAD'] as const;
const historicalCurrencies = ['USD', 'EUR', 'GBP', 'NGN', 'CAD', 'AUD'] as const;
type Currency = typeof currencies[number];
type ReceiptConversion = {
  sourceAmount: string;
  sourceCurrency: string;
  exchangeRate: string;
  destinationAmount: string;
  destinationCurrency: string;
};
type ReceiptTransaction = BankTransaction & { conversion?: ReceiptConversion };
const currencyNames: Record<string, string> = {
  USD: 'US dollar',
  EUR: 'Euro',
  GBP: 'Pound sterling',
  NGN: 'Nigerian naira',
  CAD: 'Canadian dollar',
  AUD: 'Australian dollar',
};

function currencyFromQuery(): Currency | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('currency');
  return currencies.find(currency => currency === value) ?? null;
}

function preferredCurrencyFromQuery(): Currency {
  return currencyFromQuery() ?? 'USD';
}

function currencyActionHref(path: string, currency: Currency) {
  return `${path}?currency=${encodeURIComponent(currency)}`;
}

export function HomePage() {
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: false } });
  const { isSignedIn } = useUser();
  const { t } = useLanguage();
  return (
    <div className="public-viewport-scroll bg-[#f7f9fc] pt-[5.2rem] text-[#101f3c] sm:pt-[6rem]">
      <LandingPageHeader
        isSignedIn={Boolean(isSignedIn)}
        t={t}
      />

      <main>
        <section id="account-record" className="dutstar-landing-hero relative isolate overflow-hidden scroll-mt-24">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="dutstar-orbit absolute -right-28 -top-40 h-[32rem] w-[32rem] rounded-full border border-[#0b9da4]/10" />
            <div className="dutstar-orbit dutstar-orbit-delay absolute -right-12 -top-24 h-[24rem] w-[24rem] rounded-full border border-[#1763ad]/10" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#16a9a6]/35 to-transparent" />
            <div className="absolute -left-28 top-32 h-72 w-72 rounded-full bg-[#d9f3f1]/45 blur-3xl" />
          </div>
          <div className="mx-auto grid min-h-[590px] max-w-[1320px] items-center gap-12 px-5 pb-14 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:grid-cols-[1.02fr_.98fr] lg:gap-14 lg:px-12 lg:py-24">
            <div className="dutstar-reveal relative z-10 max-w-[650px]">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#d6e8e8] bg-white/85 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#087f87] shadow-sm backdrop-blur">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0da9a5] opacity-30 motion-reduce:animate-none" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#0da9a5]" /></span>
                {t('A clearer view of your finances')}
              </div>
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[.22em] text-[#71869b]">{t('Welcome to DUTSTAR BANK')}</p>
              <h1 className="max-w-[680px] text-[clamp(2.65rem,6vw,5.2rem)] font-semibold leading-[1.02] tracking-[-.055em] text-[#0a2147]">
                {t('Your financial picture,')}
                <span className="mt-1 block bg-gradient-to-r from-[#087d91] via-[#087caa] to-[#1456a5] bg-clip-text pb-2 text-transparent">{t('in clearer focus.')}</span>
              </h1>
              <p className="mt-6 max-w-[560px] text-[15px] leading-7 text-[#60748a] sm:text-[17px] sm:leading-8">
                {t('A considered digital workspace for viewing supported currency wallets, following account activity and keeping your financial records organised.')}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href={isSignedIn ? '/dashboard' : '/sign-up'} className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#09234f] to-[#1456a5] px-6 py-3.5 text-[13px] font-bold text-white shadow-[0_12px_28px_rgba(8,39,86,.2)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(8,39,86,.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0b8f9a]">
                  {isSignedIn ? t('Open your workspace') : t('Create your account')} <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
                <Link href={isSignedIn ? '/transactions' : '/sign-in'} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#d9e3eb] bg-white/75 px-6 py-3.5 text-[13px] font-semibold text-[#28435f] transition duration-300 hover:border-[#8dbfc0] hover:bg-white">
                  {isSignedIn ? t('View account activity') : t('Sign in securely')}
                </Link>
              </div>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[#dce6ec] pt-5 text-[10px] font-semibold text-[#61758a] sm:gap-x-8">
                <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-[#078e91]" />{t('Clerk-powered sign-in')}</span>
                <span className="inline-flex items-center gap-2"><Globe2 size={15} className="text-[#078e91]" />{t('Multi-currency workspace')}</span>
              </div>
            </div>
            <div className="dutstar-reveal dutstar-reveal-late relative mx-auto w-full max-w-[590px]">
              <div className="absolute -inset-8 rounded-[42px] bg-gradient-to-br from-[#c9eeeb]/65 via-white/30 to-[#d8e6fa]/75 blur-3xl" />
              <img
                src={`${import.meta.env.BASE_URL}dutstar-hero-artwork.svg`}
                alt={t('DUTSTAR BANK digital banking hero artwork featuring a secure financial overview, multi-currency wallet workspace and premium bank card')}
                className="relative block h-auto w-full rounded-[30px] object-contain drop-shadow-[0_28px_48px_rgba(19,48,83,.18)]"
                fetchPriority="high"
                decoding="async"
              />
              <div className="dutstar-float absolute -left-3 top-[24%] hidden items-center gap-2 rounded-xl border border-white bg-white px-3 py-2.5 text-[9px] font-bold text-[#38536e] shadow-[0_12px_30px_rgba(25,50,80,.12)] sm:flex">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e8f6f4] text-[#0c9293]"><ShieldCheck size={14} /></span>
                {t('Secure digital banking')}
              </div>
            </div>
          <div className="mx-auto max-w-[1320px] px-5 pb-14 sm:px-8 lg:px-12">
            <div className="dutstar-brand-panel relative overflow-hidden rounded-[24px] border border-[#e0e9ee] bg-white px-5 py-6 shadow-[0_18px_55px_rgba(25,53,82,.07)] sm:px-10 sm:py-8">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0b2b68] via-[#087eb0] to-[#12b8ad]" />
              <p className="mb-4 text-center text-[9px] font-bold uppercase tracking-[.2em] text-[#8293a4]">{t('A more considered financial experience')}</p>
              <img src={`${import.meta.env.BASE_URL}dutstar-lockup.svg`} alt={t('DUTSTAR BANK — Banking Made Smarter')} className="dutstar-brand-art mx-auto block h-auto w-full max-w-[390px] object-contain" />
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-[1320px] scroll-mt-24 px-5 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
          <div className="mx-auto mb-10 max-w-[680px] text-center sm:mb-14">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#078c91]">{t('Designed around clarity')}</p>
            <h2 className="mt-4 text-[clamp(2rem,5vw,3.6rem)] font-semibold leading-[1.08] tracking-[-.045em] text-[#102b4e]">{t('A more organised view of your money.')}</h2>
            <p className="mx-auto mt-4 max-w-[590px] text-[14px] leading-7 text-[#718296]">{t('The essentials are easier to follow when your supported wallets and account records sit in one well-structured place.')}</p>
          </div>
          <div data-testid="landing-feature-grid" className="grid gap-4 md:grid-cols-3">
            <article className="dutstar-feature-card rounded-2xl border border-[#e2eaf0] bg-white p-6 shadow-[0_8px_26px_rgba(21,48,78,.04)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(21,48,78,.09)] sm:p-7"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eaf5f5] text-[#087f87]"><WalletCards size={20} /></span><p className="mt-6 text-[9px] font-bold uppercase tracking-[.18em] text-[#8a9aaa]">01 / {t('Wallets')}</p><h3 className="mt-2 text-[17px] font-bold text-[#203b59]">{t('See supported currencies clearly')}</h3><p className="mt-3 text-[12px] leading-6 text-[#718296]">{t('Review the balances and status of your available currency wallets from a single account overview.')}</p></article>
            <article className="dutstar-feature-card rounded-2xl border border-[#e2eaf0] bg-white p-6 shadow-[0_8px_26px_rgba(21,48,78,.04)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(21,48,78,.09)] sm:p-7"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf2fb] text-[#285e9c]"><History size={20} /></span><p className="mt-6 text-[9px] font-bold uppercase tracking-[.18em] text-[#8a9aaa]">02 / {t('Activity')}</p><h3 className="mt-2 text-[17px] font-bold text-[#203b59]">{t('Follow every account entry')}</h3><p className="mt-3 text-[12px] leading-6 text-[#718296]">{t('Find recorded activity with useful references, dates and status information for easier review.')}</p></article>
            <article className="dutstar-feature-card rounded-2xl border border-[#e2eaf0] bg-white p-6 shadow-[0_8px_26px_rgba(21,48,78,.04)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(21,48,78,.09)] sm:p-7"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#fbf4e6] text-[#a17a2d]"><ShieldCheck size={20} /></span><p className="mt-6 text-[9px] font-bold uppercase tracking-[.18em] text-[#8a9aaa]">03 / {t('Account access')}</p><h3 className="mt-2 text-[17px] font-bold text-[#203b59]">{t('A considered sign-in experience')}</h3><p className="mt-3 text-[12px] leading-6 text-[#718296]">{t('Access your private workspace through the configured Clerk authentication experience.')}</p></article>
          </div>
        </section>

        <section id="banking-portfolio" className="mx-auto max-w-[1320px] scroll-mt-24 px-5 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
          <div className="mb-9 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-[700px]">
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#078c91]">{t('The DUTSTAR experience')}</p>
              <h2 className="mt-3 text-[clamp(2rem,5vw,3.4rem)] font-semibold leading-[1.08] tracking-[-.045em] text-[#102b4e]">{t('A closer look at modern banking.')}</h2>
              <p className="mt-4 max-w-[620px] text-[14px] leading-7 text-[#718296]">{t('Explore the digital banking experience through a curated collection of financial services, thoughtful design and secure account access.')}</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#dce8e9] bg-white px-3.5 py-2 text-[9px] font-bold uppercase tracking-[.14em] text-[#527b80] shadow-sm"><ShieldCheck size={13} /> {t('Built around clarity and control')}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="group relative min-h-[290px] overflow-hidden rounded-[22px] border border-[#dfe7ec] bg-[#102b4e] shadow-[0_12px_32px_rgba(20,48,78,.08)]">
              <img src="https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=900&q=85" alt={t('Customer using a payment card at a modern point of sale')} loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-85 transition duration-700 group-hover:scale-105 group-hover:opacity-95" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#071b38]/95 via-[#071b38]/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#9de3dc]">01 / {t('Everyday banking')}</p><h3 className="mt-2 text-[19px] font-semibold tracking-tight">{t('A simpler way to manage money')}</h3><p className="mt-2 text-[11px] leading-5 text-white/75">{t('A clear digital view of your supported wallets and account activity.')}</p></div>
            </article>
            <article className="group relative min-h-[290px] overflow-hidden rounded-[22px] border border-[#dfe7ec] bg-[#102b4e] shadow-[0_12px_32px_rgba(20,48,78,.08)]">
              <img src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=85" alt={t('Contemporary financial district architecture')} loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-85 transition duration-700 group-hover:scale-105 group-hover:opacity-95" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#071b38]/95 via-[#071b38]/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#9de3dc]">02 / {t('Global perspective')}</p><h3 className="mt-2 text-[19px] font-semibold tracking-tight">{t('A world of currency options')}</h3><p className="mt-2 text-[11px] leading-5 text-white/75">{t('Follow supported currency records in one organised workspace.')}</p></div>
            </article>
            <article className="group relative min-h-[290px] overflow-hidden rounded-[22px] border border-[#dfe7ec] bg-[#102b4e] shadow-[0_12px_32px_rgba(20,48,78,.08)]">
              <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=85" alt={t('Financial analytics dashboard on a computer screen')} loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-85 transition duration-700 group-hover:scale-105 group-hover:opacity-95" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#071b38]/95 via-[#071b38]/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#9de3dc]">03 / {t('Financial insight')}</p><h3 className="mt-2 text-[19px] font-semibold tracking-tight">{t('Your finances, in perspective')}</h3><p className="mt-2 text-[11px] leading-5 text-white/75">{t('Keep financial information and personal records easier to review.')}</p></div>
            </article>
            <article className="group relative min-h-[290px] overflow-hidden rounded-[22px] border border-[#dfe7ec] bg-[#102b4e] shadow-[0_12px_32px_rgba(20,48,78,.08)]">
              <img src="https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=900&q=85" alt={t('Digital security and software engineering workspace')} loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-85 transition duration-700 group-hover:scale-105 group-hover:opacity-95" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#071b38]/95 via-[#071b38]/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#9de3dc]">04 / {t('Digital confidence')}</p><h3 className="mt-2 text-[19px] font-semibold tracking-tight">{t('Security at the centre')}</h3><p className="mt-2 text-[11px] leading-5 text-white/75">{t('A considered account experience with secure sign-in and private access.')}</p></div>
            </article>
          </div>
          <p className="mt-4 text-center text-[9px] leading-4 text-[#8a98a6]">{t('Illustrative imagery. Available features and supported services are subject to account eligibility and applicable terms.')}</p>
        </section>

        <section className="mx-5 mb-14 overflow-hidden rounded-[26px] bg-gradient-to-br from-[#081d42] via-[#0d3769] to-[#087d88] px-6 py-9 text-white shadow-[0_24px_60px_rgba(8,34,70,.18)] sm:mx-8 sm:mb-20 sm:px-12 sm:py-12 lg:mx-auto lg:max-w-[1280px] lg:px-16 lg:py-16">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div className="max-w-[700px]"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9fe1dc]">{t('Your next step')}</p><h2 className="mt-3 text-[clamp(1.8rem,4vw,3.2rem)] font-semibold leading-[1.08] tracking-[-.04em]">{t('Bring your account records into better view.')}</h2><p className="mt-4 max-w-[590px] text-[13px] leading-6 text-white/70">{t('Sign in to review your own wallet information and account activity, or create an account to get started.')}</p></div>
            <Link href={isSignedIn ? '/dashboard' : '/sign-up'} className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[#e9bd4b] px-6 py-3.5 text-[12px] font-bold text-[#10294c] shadow-lg transition duration-300 hover:-translate-y-1 hover:bg-[#f4cf70]">{isSignedIn ? t('Open your workspace') : t('Get started with DUTSTAR')}<ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" /></Link>
          </div>
        </section>
      </main>

            <footer className="border-t border-[#e1e7ec] bg-white">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-6 py-8 text-[11px] text-[#76869a] sm:flex-row sm:items-center sm:justify-between lg:px-12">
          <p>{t('© {year} DUTSTAR. A multi-currency software platform.', { year: new Date().getFullYear() })}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/fees">{t('Fees')}</Link><Link href="/contact">{t('Contact')}</Link></div>
        </div>
      </footer>
      <div className="sr-only" aria-live="polite">{health.isError ? 'Service status unavailable' : health.data?.status ?? 'Checking service status'}</div>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useLanguage();
  const query = useGetBankDashboard({
    query: {
      queryKey: getGetBankDashboardQueryKey(),
      refetchInterval: 15_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
  });
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const dash = query.data;
  const selectedWallet = dash?.wallets.find(wallet => wallet.currency === selectedCurrency)
    ?? dash?.wallets.find(wallet => wallet.currency === dash.referenceCurrency)
    ?? dash?.wallets[0];
  const selectedActionCurrency = selectedWallet?.currency ?? dash?.referenceCurrency ?? 'USD';
  const actionCurrency = currencies.includes(selectedActionCurrency as Currency)
    ? selectedActionCurrency as Currency
    : 'USD';
  const recentTransactions = dash?.recentTransactions.filter(
    transaction => !selectedWallet || transaction.currency === selectedWallet.currency,
  ) ?? [];
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <Failure title={t('Your overview isn’t available')} retry={() => query.refetch()} />;
  return (
    <div data-testid="dashboard-workspace" className="flex min-h-full w-full flex-col">
      {dash?.profile.testingMode && <div role="status" data-testid="dashboard-testing-mode-warning" className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[#ead9a8] bg-[#fff9e9] px-3.5 py-2.5 text-[10px] leading-4 text-[#765e2d]">
        <ShieldCheck size={14} className="shrink-0" />
        <p className="min-w-0 flex-1"><strong className="font-bold">{t('Testing Mode')}</strong> · {t('Private Vault is inactive. Set it up and choose a subscription to unlock its services.')}</p>
        <Link href="/private-vault" data-testid="link-dashboard-setup-vault" className="shrink-0 font-bold text-[#315f63] underline underline-offset-2">{t('Set up Private Vault')}</Link>
      </div>}
      <section data-testid="dashboard-sticky-balance" className="balance-panel sticky top-0 z-10 min-w-0 w-full overflow-hidden rounded-[16px] p-3 text-white sm:p-3.5">
          <div className="absolute -right-10 -top-12 h-48 w-48 rounded-full border border-white/[.08]" />
          <div className="absolute -right-2 -top-5 h-32 w-32 rounded-full border border-white/[.08]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
               <p className="text-[10px] font-medium text-[#cad9e4]">{selectedWallet ? `${t(currencyNames[selectedWallet.currency])} · ${t('available')}` : t('Available balance')}</p>
              <div data-testid="dashboard-active-wallet-balance" className="bank-display mt-1.5 break-words text-[clamp(1.8rem,7vw,2.8rem)] font-semibold tracking-[-.06em]">{selectedWallet ? formatMoney(Number(selectedWallet.available), selectedWallet.currency) : '—'}</div>
              {selectedWallet && <p className="mt-0.5 text-[10px] text-[#b5c7d4]">{selectedWallet.currency} wallet</p>}
              <span data-testid="dashboard-account-tier-badge" className="mt-2 inline-flex max-w-full truncate rounded-full border border-white/20 bg-white/[.1] px-2.5 py-1 text-[9px] font-bold text-[#e4eff0]">
              {t(dash?.profile.accountTier.name ?? 'Standard 🏦')}
              </span>
            </div>
            {selectedWallet && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[.08] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.13em] text-[#d9e7eb]"><span className="h-1.5 w-1.5 rounded-full bg-[#8fd2cf]" /> {selectedWallet.currency}</span>}
          </div>
          <div className="relative mt-2.5 border-t border-white/10 pt-2.5">
            <p className="mb-1 text-[8px] font-bold uppercase tracking-[.14em] text-[#b5c7d4]">{t('Switch wallet')}</p>
            {dash?.wallets.length ? (
              <div role="group" aria-label={t('Switch dashboard wallet')} className="flex min-w-0 gap-2 overflow-x-auto pb-1">
                {dash.wallets.map(wallet => {
                  const isSelected = wallet.id === selectedWallet?.id;
                  return (
                    <button
                      key={wallet.id}
                      type="button"
                      data-testid={`dashboard-wallet-${wallet.currency.toLowerCase()}`}
                      aria-label={t('{currency} wallet, available {amount}', { currency: wallet.currency, amount: formatMoney(Number(wallet.available), wallet.currency) })}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedCurrency(wallet.currency as Currency)}
                      className={`min-w-[98px] shrink-0 rounded-lg border px-2 py-1 text-left transition ${isSelected ? 'border-white/35 bg-white/15 text-white' : 'border-white/10 bg-white/[.06] text-[#d4e1eb] hover:bg-white/[.12]'}`}
                    >
                      <span className="block text-[8px] font-bold">{wallet.currency}</span>
                      <span className="mt-0.5 block text-[8px] text-[#c2d2dd]">{formatMoney(Number(wallet.available), wallet.currency)}</span>
                    </button>
                  );
                })}
              </div>
            ) : <p className="text-[11px] text-[#c2d2dd]">{t('No wallets are available.')}</p>}
          </div>
          {dash?.profile.accountStatus === 'suspended' && <p role="status" className="relative mt-2 rounded-lg border border-white/15 bg-white/[.08] px-3 py-1.5 text-[8px] leading-4 text-[#f2d8d1]">{t('Your account is suspended. Financial actions are unavailable.')}</p>}
          {dash?.profile.accountStatus === 'restricted' && <p role="status" className="relative mt-2 rounded-lg border border-white/15 bg-white/[.08] px-3 py-1.5 text-[8px] leading-4 text-[#f2e7c9]">{t('Some account operations are restricted.')}</p>}
          {selectedWallet?.status === 'restricted' && dash?.profile.accountStatus === 'active' && <p role="status" className="relative mt-2 rounded-lg border border-white/15 bg-white/[.08] px-3 py-1.5 text-[8px] leading-4 text-[#f2e7c9]">{t('This wallet is frozen. Outgoing transfers and withdrawals are unavailable.')}</p>}
      </section>

      <div data-testid="dashboard-content-grid" className="mt-2 grid min-h-0 min-w-0 flex-1 content-start gap-2 xl:grid-cols-[.75fr_1.25fr]">
        <section data-testid="dashboard-action-toolbar" aria-label={t('Dashboard quick actions')} className="min-w-0 rounded-[16px] border border-[#e2e9ef] bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#589198]">{t('Quick actions')}</p>
              <p className="mt-0.5 text-[9px] text-[#8190a0]">{t('Using {currency}', { currency: actionCurrency })}</p>
            </div>
            {selectedWallet && <span className="shrink-0 rounded-full bg-[#eff5f6] px-2 py-1 text-[8px] font-bold text-[#456c73]">{selectedWallet.currency} wallet</span>}
          </div>
          <nav role="toolbar" aria-label="Dashboard actions" className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <ActionTile href={currencyActionHref('/withdraw', actionCurrency)} icon={<ArrowUpRight size={16} />} label={t('Withdraw')} testId="dashboard-quick-withdraw" />
            <ActionTile href={currencyActionHref('/transfer', actionCurrency)} icon={<ArrowLeftRight size={16} />} label={t('Transfer')} testId="dashboard-quick-transfer" />
            <ActionTile href="/calculator" icon={<Calculator size={16} />} label={t('Convert')} testId="dashboard-quick-converter" />
            <ActionTile href="/transactions" icon={<History size={16} />} label={t('Activity')} testId="dashboard-quick-activity" />
          </nav>
        </section>

        <section className="min-h-0 min-w-0 overflow-hidden rounded-[16px] border border-[#e2e9ef] bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-[#edf0f3] px-3.5 py-2.5">
            <div><h2 className="text-[12px] font-bold text-[#203851]">{selectedWallet ? t('Recent activity · {currency}', { currency: selectedWallet.currency }) : t('Recent activity')}</h2><p className="mt-0.5 text-[9px] text-[#8592a1]">{t('Latest wallet entries')}</p></div>
            <Link href={currencyActionHref('/transactions', actionCurrency)} aria-label={t('View all activity')} className="inline-flex shrink-0 items-center gap-1 text-[9px] font-bold text-[#397d83]">{t('View all')} <ChevronRight size={12} /></Link>
          </div>
          <div className="min-w-0">
            {recentTransactions.length ? <TransactionList transactions={recentTransactions.slice(0, 3)} showReceipt={false} /> : <EmptyState title={t('Nothing recorded yet')} text={t('Your latest DUTSTAR ledger entries will appear here.')} />}
          </div>
        </section>
      </div>
      <CompactExpenseTracker />
    </div>
  );
}

export function WalletsPage() {
  const query = useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } });
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <Failure title="Wallets could not be loaded" retry={() => query.refetch()} />;
  return (
    <>
      <PageHeading eyebrow="DUTSTAR account" title="Your wallets" subtitle="A separate record for each currency. Available, pending and reserved amounts stay distinct." />
      <div data-testid="wallet-list" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(query.data ?? []).map((wallet) => (
          <Link key={wallet.id} href={`/wallets/${encodeURIComponent(wallet.id)}`} aria-label={`View ${wallet.currency} wallet details`} className="group block min-w-0 rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65a4a7] focus-visible:ring-offset-2">
            <WalletCard wallet={wallet} />
            <span className="mt-2 inline-flex items-center gap-1 px-1 text-[9px] font-bold text-[#397d83] group-hover:text-[#245e66]">View wallet details <ArrowRight size={12} /></span>
          </Link>
        ))}
      </div>
      {!query.data?.length && <EmptyState title="No currency wallets yet" text="Wallets will appear here when they are provisioned for your account." />}
    </>
  );
}

export function WalletDetailsPage() {
  const [, routeParams] = useRoute('/wallets/:walletId');
  const walletId = routeParams?.walletId ?? '';
  const walletsQuery = useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } });
  const profileQuery = useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey() } });
  const [copied, setCopied] = useState(false);
  if (walletsQuery.isLoading || profileQuery.isLoading) return <PageSkeleton />;
  if (walletsQuery.isError) return <Failure title="Wallet details could not be loaded" retry={() => walletsQuery.refetch()} />;
  if (profileQuery.isError || !profileQuery.data) return <Failure title="Account details could not be loaded" retry={() => profileQuery.refetch()} />;
  const wallet = walletsQuery.data?.find(item => item.id === walletId);
  if (!wallet) {
    return (
      <>
        <PageHeading eyebrow="Wallets" title="Wallet not found" subtitle="This wallet is not available in your account." />
        <Link href="/wallets" className="mt-5 inline-flex items-center gap-2 text-[11px] font-bold text-[#397d83]"><ArrowLeft size={14} /> Back to wallets</Link>
      </>
    );
  }
  const profile = profileQuery.data;
  const reference = walletReferenceValue(profile.customerId, wallet);
  const accountHolder = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'DUTSTAR member';
  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <>
      <Link href="/wallets" className="inline-flex items-center gap-2 text-[10px] font-bold text-[#397d83] hover:text-[#245e66]"><ArrowLeft size={13} /> Back to wallets</Link>
      <PageHeading eyebrow={`${wallet.currency} wallet`} title={`${currencyNames[wallet.currency]} wallet details`} subtitle="View the unique account reference and current wallet information." />
      <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
        <section className="relative isolate aspect-[1.65] min-h-[190px] overflow-hidden rounded-[22px] border border-[#d4e4e5] bg-[linear-gradient(130deg,#e4f4f3_0%,#c5e4e3_52%,#f1f5ec_100%)] p-5 text-[#173b58] shadow-[0_16px_38px_rgba(28,73,88,.12)] sm:p-7">
          <div aria-hidden="true" className="absolute -right-8 -top-16 h-52 w-52 rounded-full border border-white/55 shadow-[0_0_0_24px_rgba(255,255,255,.12),0_0_0_54px_rgba(255,255,255,.08)]" />
          <div aria-hidden="true" className="absolute -bottom-28 -left-10 h-56 w-56 rounded-full border border-[#d0ac58]/25" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <img src={`${import.meta.env.BASE_URL}dutstar-mark.svg`} alt="" className="h-10 w-12 object-contain" />
                <span className="text-[10px] font-extrabold tracking-[.13em]">DUTSTAR<br /><span className="text-[8px] tracking-[.3em] text-[#a47b25]">BANK</span></span>
              </div>
              <span className="rounded-full border border-white/70 bg-white/45 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.1em]">{humanize(wallet.status)}</span>
            </div>
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[.18em] text-[#62828c]">DUTSTAR wallet · {wallet.currency}</p>
              <p className="bank-display mt-1 text-[23px] font-semibold tracking-[-.04em] sm:text-[30px]">{currencyNames[wallet.currency]}</p>
              <p className="mt-3 text-[9px] font-bold uppercase tracking-[.16em] text-[#62828c]">Account holder</p>
              <p className="mt-1 truncate text-[13px] font-semibold">{accountHolder}</p>
            </div>
          </div>
        </section>
        <section className="min-w-0 rounded-[20px] border border-[#e1e8ee] bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#548d92]">Wallet account details</p><h2 className="mt-1 text-[14px] font-bold text-[#27405a]">{wallet.currency} account</h2></div>
            <span className="rounded-full bg-[#eef6f6] px-2.5 py-1 text-[9px] font-bold text-[#477b81]">{humanize(wallet.status)}</span>
          </div>
          <dl className="mt-4 divide-y divide-[#edf0f2]">
            <div className="flex justify-between gap-3 py-2.5 text-[10px]"><dt className="text-[#8291a0]">Account holder</dt><dd className="min-w-0 break-words text-right font-semibold text-[#3b5169]">{accountHolder}</dd></div>
            <div className="flex justify-between gap-3 py-2.5 text-[10px]"><dt className="text-[#8291a0]">Customer ID</dt><dd className="font-mono font-semibold text-[#3b5169]">{profile.customerId}</dd></div>
            <div className="flex justify-between gap-3 py-2.5 text-[10px]"><dt className="text-[#8291a0]">Currency</dt><dd className="font-semibold text-[#3b5169]">{wallet.currency} · {currencyNames[wallet.currency]}</dd></div>
            <div className="py-2.5 text-[10px]">
              <dt className="text-[#8291a0]">Unique DUTSTAR wallet reference</dt>
              <dd data-testid="wallet-account-reference" className="mt-1 break-all font-mono font-semibold leading-5 text-[#294763]">{reference}</dd>
            </div>
          </dl>
          <button type="button" onClick={copyReference} data-testid="button-copy-wallet-reference" className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg border border-[#dfe6eb] px-3 text-[9px] font-bold text-[#355570] hover:bg-[#f5f8f9]"><Copy size={13} />{copied ? 'Copied' : 'Copy reference'}</button>
          <p data-testid="wallet-detail-reference-disclosure" className="mt-3 rounded-lg bg-[#f5f8f8] px-3 py-2 text-[9px] leading-4 text-[#71858b]">This reference identifies your wallet inside DUTSTAR; it is not a bank account or payment destination.</p>
        </section>
        <section className="rounded-[20px] border border-[#e1e8ee] bg-white p-4 sm:p-5 xl:col-span-2">
          <p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#548d92]">Current balances</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <WalletBalanceDetail label="Available" amount={wallet.available} currency={wallet.currency} />
            <WalletBalanceDetail label="Pending" amount={wallet.pending} currency={wallet.currency} />
            <WalletBalanceDetail label="Reserved" amount={wallet.reserved} currency={wallet.currency} />
          </div>
        </section>
      </div>
    </>
  );
}

function walletReferenceValue(customerId: string, wallet: Wallet) {
  const uniqueWalletId = wallet.id.replace(/-/g, '').toUpperCase();
  return customerId
    ? `GB-${customerId}-${wallet.currency}-${uniqueWalletId}`
    : `GB-${wallet.currency}-${uniqueWalletId}`;
}

function WalletReference({ customerId, wallet }: { customerId: string; wallet: Wallet }) {
  const reference = walletReferenceValue(customerId, wallet);
  return (
    <div className="min-w-0 rounded-xl border border-[#e0e8ed] bg-white px-3 py-2.5">
      <p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#7c8c99]">DUTSTAR wallet reference</p>
      <p className="mt-1 break-all font-mono text-[9px] font-semibold leading-4 text-[#294763]">{reference}</p>
      <p className="mt-1 text-[8px] leading-3.5 text-[#8794a1]">This identifies the wallet inside DUTSTAR; it is not a bank account or payment destination.</p>
    </div>
  );
}

function WalletBalanceDetail({ label, amount, currency }: { label: string; amount: string; currency: string }) {
  return <div className="rounded-xl bg-[#f6f8fa] px-3.5 py-3"><p className="text-[9px] text-[#8492a0]">{label}</p><p className="mt-1 text-[13px] font-bold text-[#29435d]">{formatMoney(Number(amount), currency)}</p></div>;
}

export function TransactionsPage() {
  const [search, setSearch] = useState('');
  const [currency, setCurrency] = useState(() => currencyFromQuery() ?? '');
  const params = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(currency ? { currency: currency as Currency } : {}),
    limit: 100,
  }), [search, currency]);
  const query = useListBankTransactions(params, { query: { queryKey: getListBankTransactionsQueryKey(params) } });
  return (
    <>
      <PageHeading eyebrow="DUTSTAR account ledger" title="Activity" subtitle="A searchable history of entries recorded in your DUTSTAR account." />
      <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="relative min-w-0"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8695a5]" /><input aria-label="Search transactions" data-testid="input-transaction-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search description or reference" className="h-11 w-full rounded-xl border border-[#dfe6ec] bg-white pl-10 pr-3 text-[12px] outline-none transition focus:border-[#6aa6aa]" /></label>
        <select aria-label="Filter by currency" data-testid="select-transaction-currency" value={currency} onChange={event => setCurrency(event.target.value)} className="h-11 min-w-0 rounded-xl border border-[#dfe6ec] bg-white px-3 text-[12px] text-[#435872] outline-none focus:border-[#6aa6aa]"><option value="">All currencies</option>{historicalCurrencies.map(item => <option key={item} value={item}>{item} · {currencyNames[item]}</option>)}</select>
      </div>
      <section data-testid="transaction-history" className="mt-4 overflow-hidden rounded-[18px] border border-[#e1e8ee] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#edf0f3] px-4 py-3 sm:px-5"><div><p className="text-[12px] font-bold text-[#28405c]">Transaction history</p><p className="mt-0.5 text-[9px] text-[#8291a1]">DUTSTAR ledger entries</p></div><span className="shrink-0 rounded-full bg-[#f3f6f7] px-2.5 py-1 text-[9px] font-semibold text-[#718397]">{query.data?.length ?? 0} entries</span></div>
        {query.isLoading ? <ListSkeleton /> : query.isError ? <Failure title="Transaction history isn’t available" retry={() => query.refetch()} /> : query.data?.length ? <TransactionList transactions={query.data} /> : <EmptyState title="No matching activity" text="Try a different search or check back when an account transaction is recorded." />}
      </section>
    </>
  );
}

export function SendPage() {
  const queryClient = useQueryClient();
  const profileQuery = useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey() } });
  const walletsQuery = useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } });
  const memberTransfer = useCreateBankTransfer();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [currency, setCurrency] = useState<Currency>(() => preferredCurrencyFromQuery());
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionPin, setTransactionPin] = useState('');
  const [success, setSuccess] = useState<BankTransaction | null>(null);
  const [receipt, setReceipt] = useState<BankTransaction | null>(null);
  const [message, setMessage] = useState('');
  const available = Number(walletsQuery.data?.find(item => item.currency === currency)?.available ?? 0);
  const pending = memberTransfer.isPending;
  const hasError = memberTransfer.isError;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setSuccess(null);
    const onSuccess = (transaction: BankTransaction) => {
      setSuccess(transaction);
      setRecipientEmail('');
      setAmount('');
      setDescription('');
      setTransactionPin('');
      queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() });
    };
    const onError = (error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'The member transfer could not be recorded. Please try again.');
    };
    memberTransfer.mutate({
      data: {
        recipientEmail: recipientEmail.trim(),
        currency,
        amount,
        ...(description.trim() ? { description: description.trim() } : {}),
        transactionPin,
        idempotencyKey: crypto.randomUUID(),
      },
    }, { onSuccess, onError });
  };
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading eyebrow="Internal ledger" title="Send to a DUTSTAR member" subtitle="Transfers update both members’ DUTSTAR ledger wallets. No outside account is contacted." />
        <Link href="/transfer" className="mb-1 inline-flex items-center gap-2 rounded-xl border border-[#d8e4e9] bg-white px-4 py-2.5 text-[10px] font-bold text-[#365771] hover:bg-[#f4f8f9]"><ArrowLeftRight size={14} /> International transfer request</Link>
      </div>
      <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={submit} className="rounded-[22px] border border-[#e1e8ee] bg-white p-5 sm:p-8">
          <div className="mb-7 flex gap-3 rounded-xl border border-[#d9e9e9] bg-[#f0f8f8] p-4 text-[11px] leading-5 text-[#497b80]"><ShieldCheck size={17} className="mt-0.5 shrink-0" /><span><b className="text-[#2d646a]">Internal member transfer</b><br />The sender’s and recipient’s DUTSTAR ledgers are updated together. This does not send money to a bank or outside account.</span></div>
          <div className="space-y-5">
            <Field label="Recipient email"><input required type="email" value={recipientEmail} onChange={event => setRecipientEmail(event.target.value)} placeholder="name@example.com" className={inputClass} /></Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Currency"><select value={currency} onChange={event => setCurrency(event.target.value as Currency)} className={inputClass}>{currencies.map(item => <option key={item} value={item}>{item} · {currencyNames[item]}</option>)}</select></Field>
              <Field label="Amount"><input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" min="0.01" max={available || undefined} value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" className={inputClass} /><span className="mt-1.5 block text-[10px] text-[#8391a0]">Available in {currency}: {formatMoney(available, currency)}</span></Field>
            </div>
            <Field label="Note (optional)"><input maxLength={140} value={description} onChange={event => setDescription(event.target.value)} placeholder="What’s this transfer for?" className={inputClass} /></Field>
            <Field label="6-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" value={transactionPin} onChange={event => setTransactionPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter your PIN" className={inputClass} /></Field>
          </div>
          {profileQuery.data?.transactionPinConfigured === false && <p className="mt-4 rounded-lg border border-[#eadfbe] bg-[#fbf7eb] px-4 py-3 text-[10px] leading-5 text-[#806b3d]">Set up your transaction PIN in <Link href="/profile" className="font-bold underline">Profile</Link> before sending a transfer.</p>}
          {(message || hasError) && <p role="alert" className="mt-5 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{message || 'Please check the transfer details and try again.'}</p>}
          {success && <div role="status" className="mt-5 rounded-xl border border-[#cfe5db] bg-[#f1f8f4] p-4 text-[12px] text-[#417461]"><p className="font-bold">Member transfer recorded</p><p className="mt-1">Reference {success.reference} · {humanize(success.status)}</p><p className="mt-1">The recipient’s DUTSTAR wallet was credited. No outside account was involved.</p><button type="button" onClick={() => setReceipt(success)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#bfd8cc] bg-white px-3 py-2 text-[10px] font-bold text-[#3d725d] hover:bg-[#f7fbf8]"><FileText size={14} /> View receipt</button></div>}
          <button disabled={pending || transactionPin.length !== 6 || !recipientEmail.trim() || !amount || Number(amount) <= 0 || Number(amount) > available} className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#142f51] text-[12px] font-bold text-white transition hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Sending…' : 'Send internal transfer'} <ArrowRight size={15} /></button>
        </form>
        <aside className="rounded-[22px] bg-[#eaf0f4] p-6">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#638092]">Ledger transfer</p>
          <h2 className="bank-display mt-3 text-[23px] font-semibold leading-tight text-[#213a55]">Transfer between active DUTSTAR member wallets.</h2>
          <ul className="mt-5 space-y-4 text-[11px] leading-5 text-[#60748a]"><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#43888b]" /> Both accounts must be active DUTSTAR members.</li><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#43888b]" /> Transfers are posted to both members’ ledgers in one database transaction.</li><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#43888b]" /> DUTSTAR does not contact banks or move outside funds.</li></ul>
        </aside>
      </div>
      {receipt && <ReceiptDialog transaction={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}

export { InternationalTransferPage } from '@/components/transfer/transfer-wizard';

export function ProviderRequestPage({ type }: { type: 'deposit' | 'withdrawal' }) {
  const queryClient = useQueryClient();
  const profileQuery = useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey() } });
  const walletsQuery = useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } });
  const savedPaymentMethodsQuery = useListBankSavedPaymentMethods({
    query: {
      queryKey: getListBankSavedPaymentMethodsQueryKey(),
      enabled: type === 'withdrawal',
    },
  });
  const mutation = useCreateLedgerRequest();
  const createSavedPaymentMethod = useCreateBankSavedPaymentMethod();
  const deleteSavedPaymentMethod = useDeleteBankSavedPaymentMethod();
  const [currency, setCurrency] = useState<Currency | null>(() => type === 'deposit' ? currencyFromQuery() : preferredCurrencyFromQuery());
  const [depositWalletSelected, setDepositWalletSelected] = useState(() => type === 'deposit' && currencyFromQuery() !== null);
  const [withdrawalWalletSelected, setWithdrawalWalletSelected] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [withdrawalMethod, setWithdrawalMethod] = useState<'bank_card' | 'bank_transfer'>('bank_transfer');
  const [savedPaymentMethodId, setSavedPaymentMethodId] = useState('');
  const [showDestinationForm, setShowDestinationForm] = useState(false);
  const [destinationError, setDestinationError] = useState('');
  const [cardBrand, setCardBrand] = useState<'visa' | 'mastercard' | 'amex' | 'discover' | 'other'>('visa');
  const [cardLastFour, setCardLastFour] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [bankCountry, setBankCountry] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [transactionPin, setTransactionPin] = useState('');
  const [copiedWalletReference, setCopiedWalletReference] = useState(false);
  const [result, setResult] = useState<{ reference: string; message: string; status: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const activeWallets = (walletsQuery.data ?? []).filter(wallet =>
    currencies.includes(wallet.currency as Currency),
  );
  const selectedWallet = activeWallets.find(wallet => wallet.currency === currency);
  const available = Number(selectedWallet?.available ?? 0);
  const currentPaymentMethod = withdrawalMethod;
  const destinationsForMethod = (savedPaymentMethodsQuery.data ?? []).filter(
    destination => destination.method === currentPaymentMethod,
  );
  const selectedDestination = destinationsForMethod.find(
    destination => destination.id === savedPaymentMethodId,
  );
  const requiresSavedMethod = type === 'withdrawal';
  const shouldShowDestinationForm =
    requiresSavedMethod &&
    (showDestinationForm ||
      (savedPaymentMethodsQuery.isSuccess && destinationsForMethod.length === 0));
  const heading = type === 'deposit' ? 'Add funds' : 'Request a withdrawal';
  const sub = type === 'deposit'
    ? 'Active Private Vault subscribers can add funds to an eligible wallet immediately.'
    : 'Ask an administrator to review a withdrawal from your selected wallet.';
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(null);
    setErrorMessage('');
    if (requiresSavedMethod && !selectedDestination) {
      setErrorMessage(
        type === 'withdrawal'
          ? 'Choose or save a withdrawal destination before continuing.'
          : 'An active Private Vault subscription is required to add funds.',
      );
      return;
    }
    const requestDescription = type === 'deposit'
      ? 'Private Vault wallet top-up'
      : description.trim();
    mutation.mutate({ data: { type, currency: currency ?? preferredCurrencyFromQuery(), amount, ...(requestDescription ? { description: requestDescription } : {}), ...(requiresSavedMethod && selectedDestination ? { savedPaymentMethodId: selectedDestination.id, paymentMethod: currentPaymentMethod } : {}), transactionPin, idempotencyKey: crypto.randomUUID() } }, {
      onSuccess: request => {
        setResult(request);
        setAmount('');
        setDescription('');
        setTransactionPin('');
        queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() });
      },
      onError: error => setErrorMessage(error instanceof Error ? error.message : 'Request could not be recorded. Please try again.'),
    });
  };
  const savePaymentMethod = async () => {
    setDestinationError('');
    try {
      const data = currentPaymentMethod === 'bank_card'
        ? { method: 'bank_card' as const, cardBrand, lastFour: cardLastFour.trim() }
        : {
            method: 'bank_transfer' as const,
            bankName: bankName.trim(),
            accountHolder: accountHolder.trim(),
            country: bankCountry.trim() || undefined,
            bankAccountNumber: bankAccountNumber.trim(),
          };
      const saved = await createSavedPaymentMethod.mutateAsync({ data });
      await queryClient.invalidateQueries({ queryKey: getListBankSavedPaymentMethodsQueryKey() });
      setSavedPaymentMethodId(saved.id);
      setShowDestinationForm(false);
      setCardLastFour('');
      setBankName('');
      setAccountHolder('');
      setBankCountry('');
      setBankAccountNumber('');
    } catch (error) {
      setDestinationError(error instanceof Error ? error.message : 'The payment method could not be saved.');
    }
  };
  const removePaymentMethod = async (method: SavedPaymentMethod) => {
    if (!window.confirm(`Remove the saved ${method.method === 'bank_card' ? 'card' : 'bank account'} ending ${method.lastFour}?`)) return;
    setDestinationError('');
    try {
      await deleteSavedPaymentMethod.mutateAsync({ paymentMethodId: method.id });
      await queryClient.invalidateQueries({ queryKey: getListBankSavedPaymentMethodsQueryKey() });
      if (savedPaymentMethodId === method.id) setSavedPaymentMethodId('');
    } catch (error) {
      setDestinationError(error instanceof Error ? error.message : 'The payment method could not be removed.');
    }
  };
  if (profileQuery.isLoading) {
    return <div className="mx-auto min-w-0 max-w-[920px] rounded-2xl border border-[#e1e8ee] bg-white p-5"><ListSkeleton /></div>;
  }
  if (profileQuery.isError || !profileQuery.data) {
    return <div className="mx-auto min-w-0 max-w-[920px] rounded-2xl border border-[#e1e8ee] bg-white p-5"><InlineError text="Your account eligibility could not be checked." retry={() => profileQuery.refetch()} /></div>;
  }
  const operationAllowed = type === 'deposit'
    ? profileQuery.data.depositAllowed
    : profileQuery.data.withdrawalAllowed;
  if (!operationAllowed) {
    const needsSubscription = !profileQuery.data.vaultAccessActive;
    const needsDepositAccess = type === 'deposit';
    return (
      <div className="mx-auto min-w-0 max-w-[920px]" data-testid="financial-access-gate">
        <header>
          <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#4d858a]">Wallet services</p>
          <h1 className="bank-display mt-0.5 text-[22px] font-semibold leading-tight text-[#213a55] sm:text-[26px]">{type === 'deposit' ? 'Deposit' : 'Withdrawal'}</h1>
        </header>
        <section className="mt-4 rounded-2xl border border-[#e6dfc8] bg-[#fbf8ee] p-4 sm:p-5">
          <h2 className="text-[13px] font-bold text-[#6f5d35]">{needsSubscription ? 'Private Vault subscription required' : needsDepositAccess ? 'Deposit eligibility required' : 'Withdrawal access is restricted'}</h2>
          <p className="mt-2 max-w-[620px] text-[10px] leading-5 text-[#827653]">
            {needsSubscription
              ? 'An active Private Vault subscription is required before you can submit this request.'
              : needsDepositAccess
              ? 'Adding funds requires an active Private Vault subscription and no applicable account or wallet restriction.'
                : 'An account restriction currently blocks this operation. Deposit and withdrawal permissions are checked separately.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/profile" className="inline-flex h-9 items-center justify-center rounded-lg bg-[#173653] px-4 text-[10px] font-bold text-white hover:bg-[#21496a]">
              Review your profile
            </Link>
            {needsDepositAccess && <Link href="/private-vault" className="inline-flex h-9 items-center justify-center rounded-lg border border-[#d9cfad] bg-white px-4 text-[10px] font-bold text-[#735f38] hover:bg-[#fbf8ee]">View Private Vault</Link>}
          </div>
        </section>
      </div>
    );
  }
  if (type === 'deposit') {
    const accountHolder = [profileQuery.data?.firstName, profileQuery.data?.lastName].filter(Boolean).join(' ') || 'DUTSTAR member';
    const walletReference = selectedWallet ? walletReferenceValue(profileQuery.data?.customerId ?? '', selectedWallet) : '';
    const copyWalletReference = async () => {
      if (!walletReference) return;
      try {
        await navigator.clipboard.writeText(walletReference);
        setCopiedWalletReference(true);
        window.setTimeout(() => setCopiedWalletReference(false), 1800);
      } catch {
        setCopiedWalletReference(false);
      }
    };

    return (
      <div className="mx-auto min-w-0 max-w-[1100px]" data-testid="deposit-workflow">
        <header className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#4d858a]">Wallet services</p>
            <h1 className="bank-display mt-0.5 truncate text-[22px] font-semibold leading-tight text-[#213a55] sm:text-[26px]">Add funds</h1>
            <p className="mt-1 text-[10px] leading-4 text-[#758596]">Active Private Vault members can add funds to an eligible wallet immediately.</p>
          </div>
          {depositWalletSelected && selectedWallet && (
            <button type="button" onClick={() => { setDepositWalletSelected(false); setResult(null); }} className="shrink-0 rounded-lg border border-[#dce6e9] bg-white px-3 py-2 text-[10px] font-bold text-[#3c7278] hover:bg-[#f3f8f8]" data-testid="button-change-deposit-wallet">
              Change wallet
            </button>
          )}
        </header>

        {walletsQuery.isLoading ? (
          <div className="mt-4 rounded-2xl border border-[#e1e8ee] bg-white p-5"><ListSkeleton /></div>
        ) : walletsQuery.isError ? (
          <div className="mt-4 rounded-2xl border border-[#e1e8ee] bg-white p-5"><InlineError text="Wallets could not be loaded." retry={() => walletsQuery.refetch()} /></div>
        ) : !depositWalletSelected || !selectedWallet ? (
          <section className="mt-4 rounded-2xl border border-[#e1e8ee] bg-white p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h2 className="text-[12px] font-bold text-[#2c425c]">Choose a wallet</h2><p className="mt-0.5 text-[10px] text-[#8391a0]">Select the wallet to receive your funds.</p></div>
              <WalletCards size={18} className="shrink-0 text-[#4d858a]" />
            </div>
            {activeWallets.length ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {activeWallets.map(wallet => (
                  <button key={wallet.id} type="button" onClick={() => { setCurrency(wallet.currency as Currency); setDepositWalletSelected(true); setResult(null); setErrorMessage(''); }} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#e1e8ed] bg-[#fbfcfd] px-3.5 py-3 text-left transition hover:border-[#71a8aa] hover:bg-[#f3f9f9]" data-testid={`button-select-deposit-wallet-${wallet.currency.toLowerCase()}`}>
                    <span className="flex min-w-0 items-center gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eaf4f4] text-[10px] font-extrabold text-[#397b80]">{wallet.currency}</span><span className="min-w-0"><b className="block truncate text-[10px] text-[#344b64]">{currencyNames[wallet.currency] ?? wallet.currency}</b><small className="mt-0.5 block text-[9px] text-[#8492a1]">{humanize(wallet.status)}</small></span></span>
                    <span className="shrink-0 text-[10px] font-bold text-[#344b64]">{formatMoney(Number(wallet.available), wallet.currency)}</span>
                  </button>
                ))}
              </div>
            ) : <EmptyState title="No wallets available" text="There are no wallets to select for a deposit request." />}
          </section>
        ) : (
          <div className="mt-3 grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
            <section className="min-w-0 rounded-2xl border border-[#e1e8ee] bg-white p-3.5 sm:p-4" data-testid="deposit-wallet-details">
              <div className="relative isolate min-h-[174px] overflow-hidden rounded-[18px] bg-gradient-to-br from-[#18375d] via-[#15506c] to-[#147078] p-4 text-white shadow-[0_12px_28px_rgba(20,47,81,.18)] sm:min-h-[184px] sm:p-5">
                <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full border border-white/10 before:absolute before:inset-4 before:rounded-full before:border before:border-[#dfc477]/35 after:absolute after:inset-10 after:rounded-full after:border after:border-white/10" />
                <div className="relative flex items-start justify-between gap-4">
                  <div><p className="text-[12px] font-extrabold tracking-[.12em]">DUTSTAR</p><p className="mt-0.5 text-[7px] font-bold tracking-[.32em] text-[#e0c77d]">BANK</p></div>
                  <div className="text-right"><p className="text-[8px] font-bold uppercase tracking-[.14em] text-white/75">Wallet card</p><p className="mt-1 text-[11px] font-bold">{selectedWallet.currency} wallet</p></div>
                </div>
                <div className="relative mt-5 flex items-center gap-2.5">
                  <div aria-hidden="true" className="h-6 w-8 rounded-md border border-[#f3d78f]/65 bg-gradient-to-br from-[#f4e2ae] via-[#c8a959] to-[#f2d98d] shadow-inner" />
                  <span className="font-mono text-[11px] font-semibold tracking-[.14em] text-white/95">•••• •••• •••• {walletReference.slice(-4)}</span>
                </div>
                <div className="relative mt-5 flex items-end justify-between gap-3">
                  <div className="min-w-0"><p className="text-[7px] uppercase tracking-[.13em] text-white/60">Account holder</p><p className="mt-1 truncate text-[10px] font-semibold">{accountHolder}</p></div>
                  <p className="shrink-0 text-[9px] font-bold tracking-[.12em] text-[#e4ce8e]">{selectedWallet.currency}</p>
                </div>
              </div>
              <div className="mt-3">
                <h2 className="text-[11px] font-bold text-[#2d435c]">Account details</h2>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-[#f7f9fa] px-3.5 py-3">
                  <div className="min-w-0"><dt className="text-[8px] font-semibold uppercase tracking-[.1em] text-[#8593a1]">Account holder</dt><dd className="mt-0.5 truncate text-[9px] font-semibold text-[#40576f]">{accountHolder}</dd></div>
                  <div><dt className="text-[8px] font-semibold uppercase tracking-[.1em] text-[#8593a1]">Currency</dt><dd className="mt-0.5 text-[9px] font-semibold text-[#40576f]">{selectedWallet.currency}</dd></div>
                  <div><dt className="text-[8px] font-semibold uppercase tracking-[.1em] text-[#8593a1]">Available</dt><dd className="mt-0.5 text-[9px] font-semibold text-[#40576f]">{formatMoney(Number(selectedWallet.available), selectedWallet.currency)}</dd></div>
                  <div className="min-w-0"><dt className="text-[8px] font-semibold uppercase tracking-[.1em] text-[#8593a1]">Wallet reference</dt><dd className="mt-0.5 flex min-w-0 items-center gap-1"><span className="min-w-0 break-all font-mono text-[8px] font-semibold leading-3 text-[#40576f]" title={walletReference}>{walletReference}</span><button type="button" onClick={() => void copyWalletReference()} aria-label="Copy wallet reference" data-testid="button-copy-wallet-reference" className="shrink-0 rounded p-1 text-[#4a8588] hover:bg-white">{copiedWalletReference ? <Check size={12} /> : <Copy size={12} />}</button></dd></div>
                </dl>
              </div>
            </section>

            <form onSubmit={submit} className="min-w-0 rounded-2xl border border-[#e1e8ee] bg-white p-3.5 sm:p-4" data-testid="deposit-request-form">
              <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-[12px] font-bold text-[#2c425c]">Add funds</h2><p className="mt-0.5 text-[9px] text-[#8391a0]">Selected wallet · {selectedWallet.currency}</p></div><span className="rounded-lg bg-[#eef7f7] px-2.5 py-1.5 text-[9px] font-bold text-[#377b82]">{selectedWallet.currency}</span></div>
              <div className="mt-3">
                <Field label="Amount"><input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" min="0.01" max="1000000" value={amount} onChange={event => setAmount(event.target.value)} placeholder={`0.00 ${selectedWallet.currency}`} className={inputClass} data-testid="input-deposit-amount" /><span className="mt-1 block text-[8px] text-[#8492a1]">Maximum 1,000,000.00</span></Field>
              </div>
              <div className="mt-2"><Field label="6-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" value={transactionPin} onChange={event => setTransactionPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter your PIN" className={inputClass} data-testid="input-deposit-pin" /></Field></div>
              {profileQuery.data?.transactionPinConfigured === false && <p className="mt-2 rounded-lg border border-[#eadfbe] bg-[#fbf7eb] px-3 py-2 text-[9px] leading-4 text-[#806b3d]">Set up your transaction PIN in <Link href="/profile" className="font-bold underline">Profile</Link> before submitting.</p>}
              {(errorMessage || mutation.isError) && <p role="alert" className="mt-2 rounded-lg bg-[#fff1ef] px-3 py-2 text-[9px] text-[#a24940]" data-testid="status-deposit-error">{errorMessage || 'The request could not be recorded.'}</p>}
              {result && <div role="status" className="mt-2 rounded-lg border border-[#d6e6e5] bg-[#f2f8f7] px-3 py-2 text-[9px] text-[#426e70]" data-testid="status-deposit-result"><p className="font-bold">{result.status === 'approved' ? 'Wallet updated' : `Request recorded · ${humanize(result.status)}`}</p><p className="mt-0.5">{result.message} · Ref {result.reference}</p></div>}
              <button type="submit" disabled={mutation.isPending || transactionPin.length !== 6 || !amount || Number(amount) <= 0} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#142f51] text-[10px] font-bold text-white transition hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-submit-deposit">{mutation.isPending ? 'Adding…' : 'Add funds'} <ArrowRight size={13} /></button>
            </form>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="mx-auto min-w-0 max-w-[920px]" data-testid="withdrawal-workflow">
      <header className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#4d858a]">Wallet services</p><h1 className="bank-display mt-0.5 truncate text-[22px] font-semibold leading-tight text-[#213a55] sm:text-[26px]">{heading}</h1><p className="mt-1 text-[10px] text-[#758596]">{sub}</p></div>
        {withdrawalWalletSelected && selectedWallet && <button type="button" onClick={() => { setWithdrawalWalletSelected(false); setResult(null); }} className="shrink-0 rounded-lg border border-[#dce6e9] bg-white px-3 py-2 text-[10px] font-bold text-[#3c7278] hover:bg-[#f3f8f8]" data-testid="button-change-withdrawal-wallet">Change wallet</button>}
      </header>
      {walletsQuery.isLoading ? (
        <div className="mt-4 rounded-2xl border border-[#e1e8ee] bg-white p-5"><ListSkeleton /></div>
      ) : walletsQuery.isError ? (
        <div className="mt-4 rounded-2xl border border-[#e1e8ee] bg-white p-5"><InlineError text="Wallets could not be loaded." retry={() => walletsQuery.refetch()} /></div>
      ) : !withdrawalWalletSelected || !selectedWallet ? (
        <section className="mt-4 rounded-2xl border border-[#e1e8ee] bg-white p-4 sm:p-5" data-testid="withdrawal-wallet-picker">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-[12px] font-bold text-[#2c425c]">Select a source wallet</h2><p className="mt-0.5 text-[10px] text-[#8391a0]">Choose the wallet for your withdrawal request.</p></div><WalletCards size={18} className="shrink-0 text-[#4d858a]" /></div>
          {activeWallets.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{activeWallets.map(wallet => (
            <button key={wallet.id} type="button" onClick={() => { setCurrency(wallet.currency as Currency); setWithdrawalWalletSelected(true); setResult(null); setErrorMessage(''); }} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#e1e8ed] bg-[#fbfcfd] px-3.5 py-3 text-left transition hover:border-[#71a8aa] hover:bg-[#f3f9f9]" data-testid={`button-select-withdrawal-wallet-${wallet.currency.toLowerCase()}`}>
              <span className="flex min-w-0 items-center gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eaf4f4] text-[10px] font-extrabold text-[#397b80]">{wallet.currency}</span><span className="min-w-0"><b className="block truncate text-[10px] text-[#344b64]">{currencyNames[wallet.currency] ?? wallet.currency}</b><small className="mt-0.5 block text-[9px] text-[#8492a1]">{humanize(wallet.status)}</small></span></span>
              <span className="shrink-0 text-[10px] font-bold text-[#344b64]">{formatMoney(Number(wallet.available), wallet.currency)}</span>
            </button>
          ))}</div> : <EmptyState title="No wallets available" text="There are no wallets to select for a withdrawal request." />}
        </section>
      ) : (
        <div className="mt-3 grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,.78fr)_minmax(0,1.22fr)]">
          <section className="min-w-0 rounded-2xl border border-[#e1e8ee] bg-white p-3.5 sm:p-4" data-testid="withdrawal-wallet-details">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[.14em] text-[#72859b]">Source wallet</p>
            <WalletMini wallet={selectedWallet} />
            <div className="mt-2"><WalletReference customerId={profileQuery.data?.customerId ?? ''} wallet={selectedWallet} /></div>
            <p className="mt-3 text-[9px] text-[#768696]">Available to withdraw: <b className="text-[#40576f]">{formatMoney(available, selectedWallet.currency)}</b></p>
          </section>
          <form onSubmit={submit} className="min-w-0 rounded-2xl border border-[#e1e8ee] bg-white p-3.5 sm:p-4" data-testid="withdrawal-request-form">
            <h2 className="text-[12px] font-bold text-[#2c425c]">Withdrawal details</h2>
            <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Withdrawal method">
              <button type="button" onClick={() => { setWithdrawalMethod('bank_card'); setSavedPaymentMethodId(''); setShowDestinationForm(false); setDestinationError(''); }} aria-pressed={withdrawalMethod === 'bank_card'} data-testid="button-withdrawal-bank-card" className={`rounded-lg border px-3 py-2.5 text-left text-[9px] font-bold transition ${withdrawalMethod === 'bank_card' ? 'border-[#4e8c91] bg-[#f1f8f8] text-[#315c67]' : 'border-[#e1e8ed] bg-white text-[#718195]'}`}><span className="flex items-center gap-2"><CreditCard size={13} />Bank card</span></button>
              <button type="button" onClick={() => { setWithdrawalMethod('bank_transfer'); setSavedPaymentMethodId(''); setShowDestinationForm(false); setDestinationError(''); }} aria-pressed={withdrawalMethod === 'bank_transfer'} data-testid="button-withdrawal-bank-transfer" className={`rounded-lg border px-3 py-2.5 text-left text-[9px] font-bold transition ${withdrawalMethod === 'bank_transfer' ? 'border-[#4e8c91] bg-[#f1f8f8] text-[#315c67]' : 'border-[#e1e8ed] bg-white text-[#718195]'}`}><span className="flex items-center gap-2"><Building2 size={13} />Bank transfer</span></button>
            </div>
            <section className="mt-3 rounded-xl border border-[#e1e8ed] bg-[#fbfcfd] p-3" aria-label="Saved withdrawal destination">
              <div className="flex items-center justify-between gap-2"><h3 className="text-[9px] font-bold text-[#344b64]">Saved {withdrawalMethod === 'bank_card' ? 'cards' : 'bank accounts'}</h3>{destinationsForMethod.length > 0 && <button type="button" onClick={() => setShowDestinationForm(value => !value)} className="inline-flex items-center gap-1 text-[8px] font-bold text-[#397b80]"><Plus size={11} />Add new</button>}</div>
              {savedPaymentMethodsQuery.isLoading && <p className="mt-2 text-[8px] text-[#8492a1]">Loading saved details…</p>}
              <div className="mt-2 space-y-1.5">
                {destinationsForMethod.map(method => <div key={method.id} className={`flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 ${savedPaymentMethodId === method.id ? 'border-[#4e8c91] bg-[#f1f8f8]' : 'border-[#e1e8ed] bg-white'}`}>
                  <button type="button" onClick={() => setSavedPaymentMethodId(method.id)} aria-pressed={savedPaymentMethodId === method.id} className="flex min-w-0 flex-1 items-center gap-2 text-left" data-testid={`button-select-saved-method-${method.lastFour}`}>
                    {method.method === 'bank_card' ? <CreditCard size={14} className="shrink-0 text-[#4d858a]" /> : <Building2 size={14} className="shrink-0 text-[#4d858a]" />}
                    <span className="min-w-0"><b className="block truncate text-[9px] text-[#40576f]">{method.method === 'bank_card' ? `${humanize(method.cardBrand ?? 'card')} card` : `${method.bankName ?? 'Bank account'} · ${method.accountHolder ?? ''}`}</b><small className="text-[8px] text-[#8492a1]">•••• {method.lastFour}</small></span>
                    <span className="ml-auto shrink-0 text-[8px] text-[#8492a1]">{savedPaymentMethodId === method.id ? 'Selected' : 'Select'}</span>
                  </button>
                  <button type="button" aria-label={`Remove saved destination ending ${method.lastFour}`} onClick={() => void removePaymentMethod(method)} className="rounded p-1 text-[#8a98a5] hover:bg-[#f3f5f7] hover:text-[#a24940]"><Trash2 size={12} /></button>
                </div>)}
              </div>
              {shouldShowDestinationForm && (
                <div className="mt-3 rounded-lg border border-dashed border-[#cbd9df] bg-white p-3" data-testid="withdrawal-destination-form">
                  <p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#72859b]">{destinationsForMethod.length ? 'Add another destination' : 'Add a destination'}</p>
                  {withdrawalMethod === 'bank_card' ? <div className="mt-2 grid grid-cols-2 gap-2">
                    <Field label="Card brand"><select value={cardBrand} onChange={event => setCardBrand(event.target.value as typeof cardBrand)} className={inputClass}><option value="visa">Visa</option><option value="mastercard">Mastercard</option><option value="amex">American Express</option><option value="discover">Discover</option><option value="other">Other</option></select></Field>
                    <Field label="Last 4 digits"><input inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" maxLength={4} value={cardLastFour} onChange={event => setCardLastFour(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" className={inputClass} /></Field>
                  </div> : <div className="mt-2 grid grid-cols-2 gap-2">
                    <Field label="Bank name"><input value={bankName} onChange={event => setBankName(event.target.value)} maxLength={80} placeholder="Bank name" className={inputClass} /></Field>
                    <Field label="Account holder"><input value={accountHolder} onChange={event => setAccountHolder(event.target.value)} maxLength={100} placeholder="Name on account" className={inputClass} /></Field>
                    <Field label="Country (optional)"><input value={bankCountry} onChange={event => setBankCountry(event.target.value)} maxLength={60} placeholder="Country" className={inputClass} /></Field>
                    <Field label="Bank account number or IBAN"><input autoComplete="off" inputMode="text" maxLength={64} minLength={5} value={bankAccountNumber} onChange={event => setBankAccountNumber(event.target.value)} placeholder="Enter full account number or IBAN" className={inputClass} data-testid="input-bank-account-number" /></Field>
                  </div>}
                  <p className="mt-2 text-[8px] leading-4 text-[#758596]">Full bank account numbers are encrypted and only the last four are shown in review lists. Card references keep the brand and last four only; never enter a security code.</p>
                  {destinationError && <p role="alert" className="mt-2 text-[8px] text-[#a24940]">{destinationError}</p>}
                  <button type="button" disabled={createSavedPaymentMethod.isPending || (withdrawalMethod === 'bank_card' ? cardLastFour.length !== 4 : !bankName.trim() || !accountHolder.trim() || bankAccountNumber.replace(/[\s-]/g, '').length < 5)} onClick={() => void savePaymentMethod()} className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#eaf4f4] text-[8px] font-bold text-[#34747b] disabled:opacity-50">{createSavedPaymentMethod.isPending ? 'Saving…' : 'Save destination'} <ArrowRight size={11} /></button>
                </div>
              )}
              {!shouldShowDestinationForm && destinationsForMethod.length > 0 && <p className="mt-2 text-[8px] text-[#758596]">Select a saved destination or add a new one.</p>}
            </section>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Field label="Amount"><input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" min="0.01" max={available} value={amount} onChange={event => setAmount(event.target.value)} placeholder={`0.00 ${selectedWallet.currency}`} className={inputClass} data-testid="input-withdrawal-amount" /></Field>
              <Field label="Note for administrator (optional)"><input maxLength={80} value={description} onChange={event => setDescription(event.target.value)} placeholder="Add context" className={inputClass} /></Field>
            </div>
            <div className="mt-2"><Field label="6-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" value={transactionPin} onChange={event => setTransactionPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter your PIN" className={inputClass} /></Field></div>
            {profileQuery.data?.transactionPinConfigured === false && <p className="mt-2 rounded-lg border border-[#eadfbe] bg-[#fbf7eb] px-3 py-2 text-[9px] leading-4 text-[#806b3d]">Set up your transaction PIN in <Link href="/profile" className="font-bold underline">Profile</Link> before submitting.</p>}
            {(destinationError || errorMessage || mutation.isError) && <p role="alert" className="mt-2 rounded-lg bg-[#fff1ef] px-3 py-2 text-[9px] text-[#a24940]">{destinationError || errorMessage || 'The request could not be recorded.'}</p>}
            {result && <div role="status" className="mt-2 rounded-lg border border-[#d6e6e5] bg-[#f2f8f7] px-3 py-2 text-[9px] text-[#426e70]"><p className="font-bold">Request recorded · {humanize(result.status)}</p><p className="mt-0.5">{result.message} · Ref {result.reference}</p></div>}
            <button type="submit" disabled={mutation.isPending || transactionPin.length !== 6 || !amount || Number(amount) <= 0 || Number(amount) > available || !selectedDestination} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#142f51] text-[10px] font-bold text-white transition hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-submit-withdrawal">{mutation.isPending ? 'Sending for review…' : 'Submit withdrawal request'} <ArrowRight size={13} /></button>
          </form>
        </div>
      )}
    </div>
  );
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const { isLoaded: userLoaded, user } = useUser();
  const { t } = useLanguage();
  const query = useGetBankProfile({
    query: {
      queryKey: getGetBankProfileQueryKey(),
      enabled: userLoaded && Boolean(user),
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        if (error instanceof Error && /401|unauthorized/i.test(error.message)) return false;
        return true;
      },
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
    },
  });
  const update = useUpdateBankProfile();
  const [note, setNote] = useState('');
  const [customerIdCopied, setCustomerIdCopied] = useState(false);
  const [photoMessage, setPhotoMessage] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [photoPending, setPhotoPending] = useState(false);
  const [profileTab, setProfileTab] = useState<'overview' | 'details' | 'security'>('overview');
  const profile = query.data;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [cityOfOrigin, setCityOfOrigin] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [occupation, setOccupation] = useState('');
  const [initialised, setInitialised] = useState(false);
  useEffect(() => {
    if (profile && !initialised) {
      setFirstName(profile.firstName ?? '');
      setLastName(profile.lastName ?? '');
      setAddress(profile.address ?? '');
      setPhone(profile.phone ?? '');
      setCountry(profile.country ?? '');
      setCityOfOrigin(profile.cityOfOrigin ?? '');
      setDateOfBirth(profile.dateOfBirth ?? '');
      setOccupation(profile.occupation ?? '');
      setInitialised(true);
    }
  }, [profile, initialised]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNote('');
    if (!firstName.trim() || !lastName.trim()) {
      setNote('Enter both your first and last name.');
      return;
    }
    update.mutate({ data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      address: address.trim() || null,
      phone: phone.trim() || null,
      country: country.trim() || null,
      cityOfOrigin: cityOfOrigin.trim() || null,
      dateOfBirth: dateOfBirth || null,
      occupation: occupation.trim() || null,
    } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBankProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() });
        setNote('Profile saved.');
      },
      onError: error => setNote(error instanceof Error ? error.message : 'Profile could not be saved. Please try again.'),
    });
  };
  const copyCustomerId = async () => {
    if (!profile?.customerId) return;
    try {
      await navigator.clipboard.writeText(profile.customerId);
      setCustomerIdCopied(true);
      window.setTimeout(() => setCustomerIdCopied(false), 1800);
    } catch {
      setCustomerIdCopied(false);
    }
  };
  const updatePin = useUpdateTransactionPin();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const submitPin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPinMessage('');
    if (!/^[0-9]{6}$/.test(newPin)) {
      setPinMessage('Enter a new PIN with exactly six digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinMessage('The new PIN entries do not match.');
      return;
    }
    if (profile?.transactionPinConfigured && !/^[0-9]{6}$/.test(currentPin)) {
      setPinMessage('Enter your current six-digit PIN to change it.');
      return;
    }
    try {
      await updatePin.mutateAsync({
        data: {
          pin: newPin,
          ...(profile?.transactionPinConfigured ? { currentPin } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetBankProfileQueryKey() });
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setPinMessage('Transaction PIN saved. You will need it for every transaction.');
    } catch (error) {
      setPinMessage(error instanceof Error ? error.message : 'The transaction PIN could not be saved.');
    }
  };
  const uploadProfilePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setPhotoMessage('');
    setPhotoError('');
    if (!user) {
      setPhotoError('Your signed-in profile is unavailable. Refresh and try again.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Choose an image smaller than 5 MB.');
      return;
    }
    setPhotoPending(true);
    try {
      await user.setProfileImage({ file });
      await user.reload();
      setPhotoMessage('Profile photo updated.');
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'The profile photo could not be updated.');
    } finally {
      setPhotoPending(false);
    }
  };
  if (!userLoaded || query.isLoading) return <PageSkeleton />;
  if (query.isError) return <Failure title="Your profile is unavailable" text="Your saved details are unchanged. Check your connection and try again." retry={() => void query.refetch()} />;
  if (!profile) return <Failure title="Your profile is unavailable" text="Your saved details are unchanged. Try loading your profile again." retry={() => void query.refetch()} />;
  const missingProfileFields = getMissingCustomerProfileFields(profile);
  const profileTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'details', label: 'Personal details' },
    { id: 'security', label: 'Security' },
  ] as const;
  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5" data-testid="customer-profile-page">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[8px] font-bold uppercase tracking-[.17em] text-[#55868b]">Your account</p>
          <h1 className="mt-0.5 text-[19px] font-bold tracking-tight text-[#17314f] sm:text-[22px]">Profile</h1>
          <p className="text-[9px] text-[#7c8b9a]">Manage your personal details and account security.</p>
        </div>
        <Link href="/private-vault" data-testid="link-profile-private-vault" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[#d6e8e9] bg-white px-3 text-[9px] font-bold text-[#377d83] hover:bg-[#eff8f8]"><LockKeyhole size={13} />Private Vault</Link>
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-[#e1e8ee] bg-white px-3 py-2">
          <div>
            <p className="text-[7px] font-bold uppercase tracking-[.13em] text-[#718296]">Customer ID</p>
            <p className="font-mono text-[11px] font-bold tracking-[.12em] text-[#17314f]">{profile?.customerId}</p>
          </div>
          <button type="button" data-testid="button-copy-customer-id" onClick={copyCustomerId} aria-label="Copy Customer ID" className="grid h-8 w-8 place-items-center rounded-lg border border-[#dfe6eb] text-[#355570] hover:bg-[#f5f8f9]">
            {customerIdCopied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      </header>
      <nav
        role="tablist"
        aria-label="Profile sections"
        onKeyDown={event => {
          const currentIndex = profileTabs.findIndex(tab => tab.id === profileTab);
          const nextIndex = event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? profileTabs.length - 1
              : event.key === 'ArrowRight'
                ? (currentIndex + 1) % profileTabs.length
                : event.key === 'ArrowLeft'
                  ? (currentIndex - 1 + profileTabs.length) % profileTabs.length
                  : -1;
          if (nextIndex >= 0) {
            event.preventDefault();
            const nextTab = profileTabs[nextIndex];
            setProfileTab(nextTab.id);
            document.getElementById(`profile-tab-${nextTab.id}`)?.focus();
          }
        }}
        className="flex shrink-0 gap-1 overflow-x-auto rounded-xl border border-[#e1e8ee] bg-white p-1"
      >
        {profileTabs.map(tab => <button
          key={tab.id}
          type="button"
          role="tab"
          id={`profile-tab-${tab.id}`}
          tabIndex={profileTab === tab.id ? 0 : -1}
          aria-selected={profileTab === tab.id}
          aria-controls="profile-tab-panel"
          data-testid={`profile-tab-button-${tab.id}`}
          onClick={() => setProfileTab(tab.id)}
          className={`shrink-0 rounded-lg px-3 py-2 text-[9px] font-bold transition sm:px-4 ${profileTab === tab.id ? 'bg-[#173858] text-white shadow-sm' : 'text-[#64798d] hover:bg-[#f3f7f8] hover:text-[#315b65]'}`}
        >{tab.label}</button>)}
      </nav>
      <div id="profile-tab-panel" role="tabpanel" aria-labelledby={`profile-tab-${profileTab}`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
        {profileTab === 'overview' && <section className="rounded-[18px] border border-[#e1e8ee] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f2] pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-[#dbe5ea] bg-[#eef5f6] text-[15px] font-bold text-[#387b82]">
                {user?.imageUrl ? <img src={user.imageUrl} alt="Your profile" className="h-full w-full object-cover" /> : (user?.firstName?.[0] ?? profile?.email?.[0] ?? 'G').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-bold text-[#29425c]">{[profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'DUTSTAR member'}</p>
                <p className="truncate text-[9px] text-[#7e8d9c]">{profile?.email}</p>
              </div>
            </div>
            <label htmlFor="profile-photo-upload" className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-[#dfe7eb] px-3 text-[9px] font-bold text-[#3f5c75] hover:bg-[#f5f8f9] ${photoPending ? 'pointer-events-none opacity-50' : ''}`}>
              <Camera size={13} />{photoPending ? 'Uploading…' : 'Change photo'}
            </label>
            <input id="profile-photo-upload" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={uploadProfilePhoto} disabled={photoPending} />
          </div>
          <p className="mt-2 text-[8px] text-[#8794a2]">JPG, PNG or WebP · up to 5 MB. Your photo appears across DUTSTAR.</p>
          {photoMessage && <p role="status" className="mt-2 rounded-lg bg-[#f0f8f4] px-3 py-2 text-[9px] text-[#41755f]">{photoMessage}</p>}
          {photoError && <p role="alert" className="mt-2 rounded-lg bg-[#fff1ef] px-3 py-2 text-[9px] text-[#a24940]">{photoError}</p>}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-[#f7f9fa] p-3"><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#71869a]">Account</p><span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[9px] font-bold ${profile?.accountStatus === 'active' ? 'bg-[#edf6f1] text-[#4c836e]' : 'bg-[#fbf7eb] text-[#927944]'}`}>{humanize(profile?.accountStatus)}</span></div>
            <div data-testid="profile-account-tier" className="rounded-xl bg-[#f7f9fa] p-3"><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#71869a]">Account tier</p><span data-testid="profile-account-tier-badge" className="mt-1 inline-flex max-w-full truncate rounded-full border border-[#d5e5e2] bg-[#edf5f2] px-2 py-1 text-[9px] font-bold text-[#3f716d]">{profile.accountTier.name || 'Standard 🏦'}</span></div>
          </div>
          <section className="mt-4 rounded-xl border border-[#e1e8ee] bg-white p-3" aria-label="Customer profile information" data-testid="customer-profile-completeness">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[10px] font-bold text-[#29425c]">Personal information</h2>
              <span className="text-[8px] text-[#8492a0]">{missingProfileFields.length ? `${missingProfileFields.length} missing` : 'All details supplied'}</span>
            </div>
            <dl className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="min-w-0" data-testid="profile-field-username">
                <dt className="text-[8px] font-semibold text-[#8492a0]">{t('Username')}</dt>
                <dd className={`mt-0.5 break-words text-[9px] font-semibold ${user?.username ? 'text-[#40566e]' : 'text-[#a07855]'}`}>
                  {formatCustomerProfileValue(user?.username) === 'Missing' ? t('Missing') : formatCustomerProfileValue(user?.username)}
                </dd>
              </div>
              {customerProfileFieldLabels.map(([key, label]) => {
                const value = profile[key];
                const provided = typeof value === 'string' && value.trim().length > 0;
                return <div key={key} data-testid={`profile-field-${key}`} className="min-w-0">
                  <dt className="text-[8px] font-semibold text-[#8492a0]">{t(label)}</dt>
                  <dd className={`mt-0.5 break-words text-[9px] font-semibold ${provided ? 'text-[#40566e]' : 'text-[#a07855]'}`}>
                    {formatCustomerProfileValue(value) === 'Missing' ? t('Missing') : formatCustomerProfileValue(value)}
                  </dd>
                </div>;
              })}
            </dl>
          </section>
          <button type="button" onClick={() => setProfileTab('details')} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[#173858] px-4 text-[9px] font-bold text-white hover:bg-[#1b4269]">Review personal details <ArrowRight size={12} /></button>
        </section>}
        {profileTab === 'details' && (profile.profileSetupComplete ? <section className="rounded-[18px] border border-[#e1e8ee] bg-white p-4 sm:p-5" data-testid="profile-details-readonly">
          <div className="mb-3"><h2 className="text-[12px] font-bold text-[#29425c]">Personal details</h2><p className="mt-1 text-[9px] text-[#7c8b9a]">These details are read-only after initial setup. Contact an administrator to request a correction.</p></div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-xl bg-[#f7f9fa] p-3" data-testid="profile-details-username">
              <dt className="text-[8px] font-bold uppercase tracking-[.1em] text-[#8291a0]">{t('Username')}</dt>
              <dd className={`mt-1 break-words text-[10px] font-semibold ${user?.username ? 'text-[#40566e]' : 'text-[#a07855]'}`}>{formatCustomerProfileValue(user?.username) === 'Missing' ? t('Missing') : formatCustomerProfileValue(user?.username)}</dd>
            </div>
            {customerProfileFieldLabels.map(([key, label]) => {
              const value = profile[key];
              const provided = typeof value === 'string' && value.trim().length > 0;
              return <div key={key} className="min-w-0 rounded-xl bg-[#f7f9fa] p-3"><dt className="text-[8px] font-bold uppercase tracking-[.1em] text-[#8291a0]">{t(label)}</dt><dd className={`mt-1 break-words text-[10px] font-semibold ${provided ? 'text-[#40566e]' : 'text-[#a07855]'}`}>{formatCustomerProfileValue(value) === 'Missing' ? t('Missing') : formatCustomerProfileValue(value)}</dd></div>;
            })}
          </dl>
          <p className="mt-3 text-[9px] text-[#7c8b9a]">Email address · {profile.email}</p>
        </section> : <form onSubmit={submit} className="rounded-[18px] border border-[#e1e8ee] bg-white p-4 sm:p-5">
          <div className="mb-3"><h2 className="text-[12px] font-bold text-[#29425c]">Complete your personal details</h2><p className="mt-1 text-[9px] text-[#7c8b9a]">This initial setup can be completed once. Later changes require an administrator.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name"><input required maxLength={80} value={firstName} onChange={event => setFirstName(event.target.value)} className={inputClass} /></Field>
            <Field label="Last name"><input required maxLength={80} value={lastName} onChange={event => setLastName(event.target.value)} className={inputClass} /></Field>
            <Field label="Address"><textarea maxLength={1024} value={address} onChange={event => setAddress(event.target.value)} className={`${inputClass} min-h-[72px] resize-y py-2`} placeholder="Missing" /></Field>
            <Field label="Phone number"><input maxLength={1024} value={phone} onChange={event => setPhone(event.target.value)} className={inputClass} placeholder="Missing" /></Field>
            <Field label="Country of origin"><input maxLength={1024} value={country} onChange={event => setCountry(event.target.value)} className={inputClass} placeholder="Missing" /></Field>
            <Field label="City of origin"><input maxLength={1024} value={cityOfOrigin} onChange={event => setCityOfOrigin(event.target.value)} className={inputClass} placeholder="Missing" /></Field>
            <Field label="Date of birth"><input type="date" value={dateOfBirth} onChange={event => setDateOfBirth(event.target.value)} className={inputClass} /></Field>
            <Field label="Occupation / employment status"><input maxLength={1024} value={occupation} onChange={event => setOccupation(event.target.value)} className={inputClass} placeholder="Missing" /></Field>
            <Field label="Email address"><input disabled value={profile?.email ?? ''} className={`${inputClass} bg-[#f4f7f9] text-[#8190a0]`} /></Field>
          </div>
          {note && <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-[9px] ${note.startsWith('Profile saved') ? 'bg-[#f0f8f4] text-[#41755f]' : 'bg-[#fff1ef] text-[#a24940]'}`}>{note}</p>}
          <button disabled={update.isPending} className="mt-3 h-9 rounded-lg bg-[#142f51] px-4 text-[9px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-45">{update.isPending ? 'Saving profile…' : 'Save profile'}</button>
        </form>)}
        {profileTab === 'security' && <section id="transaction-security" className="rounded-[18px] border border-[#e1e8ee] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#55868b]">Transaction security</p>
            <h2 className="mt-1 text-[13px] font-bold text-[#29425c]">{profile?.transactionPinConfigured ? 'Update transaction PIN' : 'Create transaction PIN'}</h2>
            <p className="mt-1.5 max-w-2xl text-[10px] leading-4 text-[#718296]">Use a six-digit PIN to authorize every transfer, wallet top-up, and withdrawal request. Your PIN is stored as a secure hash and cannot be viewed by administrators.</p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-[9px] font-bold ${profile?.transactionPinConfigured ? 'bg-[#eef7f3] text-[#4b826d]' : 'bg-[#fbf7eb] text-[#92773e]'}`}>{profile?.transactionPinConfigured ? 'PIN active' : 'PIN not set'}</span>
        </div>
        <form onSubmit={submitPin} className="mt-3 grid gap-3 sm:grid-cols-2">
          {profile?.transactionPinConfigured && <Field label="Current PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={currentPin} onChange={event => setCurrentPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field>}
          <Field label="New 6-digit PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="new-password" value={newPin} onChange={event => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field>
          <Field label="Confirm new PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="new-password" value={confirmPin} onChange={event => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field>
          {pinMessage && <p role={pinMessage.startsWith('Transaction PIN saved') ? 'status' : 'alert'} className={`sm:col-span-2 rounded-lg px-4 py-3 text-[11px] ${pinMessage.startsWith('Transaction PIN saved') ? 'bg-[#f0f8f4] text-[#41755f]' : 'bg-[#fff1ef] text-[#a24940]'}`}>{pinMessage}</p>}
          <button disabled={updatePin.isPending || newPin.length !== 6 || confirmPin.length !== 6} className="h-10 w-fit rounded-lg bg-[#142f51] px-4 text-[10px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{updatePin.isPending ? 'Saving PIN…' : profile?.transactionPinConfigured ? 'Update PIN' : 'Create PIN'}</button>
        </form>
        </section>}
      </div>
    </div>
  );
}

export function PrivateVaultPage() {
  return (
    <div className="min-h-dvh w-full min-w-0" data-testid="private-vault-page">
      <PrivateVaultPanel />
    </div>
  );
}

function AdminLedgerRequestQueue() {
  const queryClient = useQueryClient();
  const requests = useListAdminLedgerRequests(undefined, {
    query: {
      queryKey: getListAdminLedgerRequestsQueryKey(),
      retry: false,
    },
  });
  const review = useReviewAdminLedgerRequest();
  const [error, setError] = useState('');
  const [reviewTarget, setReviewTarget] = useState<{
    request: AdminLedgerRequest;
    decision: 'approve' | 'reject';
  } | null>(null);
  const [transactionPin, setTransactionPin] = useState('');

  const decide = (request: AdminLedgerRequest, decision: 'approve' | 'reject') => {
    setError('');
    setTransactionPin('');
    setReviewTarget({ request, decision });
  };

  const submitDecision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewTarget || !/^[0-9]{6}$/.test(transactionPin)) {
      setError('Enter your six-digit transaction PIN.');
      return;
    }
    setError('');
    try {
      await review.mutateAsync({
        requestId: reviewTarget.request.id,
        data: {
          decision: reviewTarget.decision,
          transactionPin,
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListAdminLedgerRequestsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListAdminLedgerQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAdminUserDetailQueryKey(reviewTarget.request.userId) }),
        queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() }),
      ]);
      setReviewTarget(null);
      setTransactionPin('');
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'The ledger request could not be reviewed.');
    }
  };

  return (
    <>
      <section className="mt-6 overflow-hidden rounded-[20px] border border-[#e1e8ee] bg-white">
        <div className="border-b border-[#edf0f3] px-5 py-4 sm:px-7">
          <h2 className="text-[14px] font-bold text-[#28405c]">Withdrawal approvals</h2>
          <p className="mt-1 text-[10px] leading-4 text-[#8592a1]">Review eligible withdrawal requests. Decisions are recorded automatically and require an administrator PIN.</p>
        </div>
        {error && !reviewTarget && <p role="alert" className="border-b border-[#edf0f3] bg-[#fff1ef] px-5 py-3 text-[11px] text-[#a24940]">{error}</p>}
        {requests.isLoading ? <ListSkeleton /> : requests.isError ? <InlineError text="Customer requests are unavailable." retry={() => requests.refetch()} /> : requests.data?.length ? (
          <div className="divide-y divide-[#edf0f2]">
            {requests.data.map(request => (
              <article key={request.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#eef6f6] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-[#36777c]">{request.type}</span><span className="font-mono text-[9px] text-[#8291a0]">{request.reference}</span><span className="text-[9px] text-[#8291a0]">{formatDate(request.createdAt)}</span></div>
                  <p className="mt-2 truncate text-[11px] font-semibold text-[#344b64]">{request.memberName} · {request.email}</p>
                  <p className="mt-1 text-[10px] text-[#7e8d9c]">{request.description || `${humanize(request.type)} request`} · {request.status === 'pending_provider_setup' ? 'Awaiting review' : humanize(request.status)}</p>
                  {request.paymentMethodSummary && <p className="mt-1 truncate text-[9px] text-[#5f7789]">Payment destination: {request.paymentMethodSummary}</p>}
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                  <strong className="text-[13px] text-[#2d435c]">{formatMoney(Number(request.amount), request.currency)}</strong>
                  <button type="button" disabled={review.isPending} onClick={() => decide(request, 'approve')} className="rounded-lg bg-[#eaf5ef] px-3 py-2 text-[10px] font-bold text-[#47795f] hover:bg-[#dff0e6] disabled:opacity-50">Approve</button>
                  <button type="button" disabled={review.isPending} onClick={() => decide(request, 'reject')} className="rounded-lg border border-[#ead8d5] px-3 py-2 text-[10px] font-bold text-[#a24940] hover:bg-[#fff7f5] disabled:opacity-50">Reject</button>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No withdrawals awaiting review" text="New withdrawal requests will appear here." />}
      </section>
      {reviewTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14263e]/55 p-4">
        <form role="dialog" aria-modal="true" aria-labelledby="ledger-review-title" onSubmit={submitDecision} className="w-full max-w-lg rounded-[22px] border border-[#dfe7ec] bg-white p-5 shadow-2xl sm:p-7">
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Administrator authorization</p>
          <h2 id="ledger-review-title" className="mt-1 text-[16px] font-bold text-[#29425c]">{reviewTarget.decision === 'approve' ? 'Approve customer request' : 'Reject customer request'}</h2>
          <p className="mt-2 text-[11px] leading-5 text-[#718296]">{reviewTarget.request.memberName} · {reviewTarget.request.reference} · {formatMoney(Number(reviewTarget.request.amount), reviewTarget.request.currency)}{reviewTarget.request.paymentMethodSummary ? ` · ${reviewTarget.request.paymentMethodSummary}` : ''}</p>
          <div className="mt-5">
            <Field label="Your 6-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={transactionPin} onChange={event => setTransactionPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field>
          </div>
          {error && <p role="alert" className="mt-4 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setReviewTarget(null)} className="rounded-xl border border-[#dfe6eb] px-4 py-3 text-[10px] font-bold text-[#546b80] hover:bg-[#f5f8f9]">Cancel</button>
            <button disabled={review.isPending || transactionPin.length !== 6} className="rounded-xl bg-[#142f51] px-4 py-3 text-[10px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{review.isPending ? 'Saving…' : 'Confirm decision'}</button>
          </div>
        </form>
      </div>}
    </>
  );
}

export function AdminPage() {
  const queryClient = useQueryClient();
  const access = useGetAdminAccess({ query: { queryKey: getGetAdminAccessQueryKey(), retry: false } });
  const summary = useGetAdminSummary({ query: { queryKey: getGetAdminSummaryQueryKey(), enabled: !!access.data?.allowed, retry: false } });
  const exchangeRates = useListBankExchangeRates({ query: { queryKey: getListBankExchangeRatesQueryKey(), enabled: !!access.data?.allowed } });
  const [search, setSearch] = useState('');
  const [statusError, setStatusError] = useState('');
  const [fundTarget, setFundTarget] = useState<AdminUser | null>(null);
  const [fundDirection, setFundDirection] = useState<'credit' | 'debit'>('credit');
  const [fundCurrency, setFundCurrency] = useState<Currency>('USD');
  const [fundAmount, setFundAmount] = useState('');
  const [fundSenderName, setFundSenderName] = useState('');
  const [fundDescription, setFundDescription] = useState('');
  const [fundTransactionPin, setFundTransactionPin] = useState('');
  const [fundingError, setFundingError] = useState('');
  const [fundingSuccess, setFundingSuccess] = useState<BankTransaction | null>(null);
  const [rateSource, setRateSource] = useState<Currency>('USD');
  const [rateDestination, setRateDestination] = useState<Currency>('EUR');
  const [rateValue, setRateValue] = useState('');
  const [ratePin, setRatePin] = useState('');
  const [rateMessage, setRateMessage] = useState('');
  const [statusTarget, setStatusTarget] = useState<BankTransaction | null>(null);
  const params = useMemo(() => ({ ...(search.trim() ? { search: search.trim() } : {}), limit: 100 }), [search]);
  const usersQuery = useListAdminUsers(params, { query: { queryKey: getListAdminUsersQueryKey(params), enabled: !!access.data?.allowed } });
  const users = { ...usersQuery, data: usersQuery.data?.items };
  const ledgerParams = { limit: 100 };
  const ledger = useListAdminLedger(ledgerParams, { query: { queryKey: getListAdminLedgerQueryKey(ledgerParams), enabled: !!access.data?.allowed } });
  const update = useUpdateAdminUserStatus();
  const funding = useCreateAdminFunding();
  const updateTransactionStatus = useUpdateAdminTransactionStatus();
  const upsertExchangeRate = useUpsertBankExchangeRate();
  if (access.isLoading) return <PageSkeleton />;
  if (access.isError || !access.data?.allowed) return <Failure title="Operations access is restricted" text="This area is only available to authorized DUTSTAR operations staff." retry={() => access.refetch()} />;
  const setStatus = (userId: string, accountStatus: 'active' | 'suspended') => {
    setStatusError('');
    update.mutate({ userId, data: { accountStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
      },
      onError: error => setStatusError(error instanceof Error ? error.message : 'The account status could not be updated.'),
    });
  };
  const submitFunding = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fundTarget) return;
    setFundingError('');
    setFundingSuccess(null);
    funding.mutate({
      userId: fundTarget.id,
      data: {
        direction: fundDirection,
        currency: fundCurrency,
        amount: fundAmount,
        senderName: fundSenderName.trim(),
        description: fundDescription.trim(),
        transactionPin: fundTransactionPin,
        idempotencyKey: crypto.randomUUID(),
      },
    }, {
      onSuccess: transaction => {
        setFundingSuccess(transaction);
        setFundAmount('');
        setFundSenderName('');
        setFundDescription('');
        setFundTransactionPin('');
        queryClient.invalidateQueries({ queryKey: getListAdminLedgerQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() });
      },
      onError: error => setFundingError(error instanceof Error ? error.message : 'The balance adjustment could not be recorded.'),
    });
  };
  const saveTransactionStatus = async (
    status: BankTransaction['status'],
    transactionPin: string,
  ) => {
    if (!statusTarget) return;
    await updateTransactionStatus.mutateAsync({
      transactionId: statusTarget.id,
      data: { status, transactionPin, confirmed: true },
    });
    setStatusTarget(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListAdminLedgerQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListAdminLedgerRequestsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() }),
    ]);
  };
  const submitExchangeRate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRateMessage('');
    upsertExchangeRate.mutate({
      data: {
        sourceCurrency: rateSource,
        destinationCurrency: rateDestination,
        rate: rateValue.trim(),
        transactionPin: ratePin,
      },
    }, {
      onSuccess: () => {
        setRateMessage(`Saved ${rateSource} → ${rateDestination} rate.`);
        setRateValue('');
        setRatePin('');
        void queryClient.invalidateQueries({ queryKey: getListBankExchangeRatesQueryKey() });
      },
      onError: error => setRateMessage(error instanceof Error ? error.message : 'The internal rate could not be saved.'),
    });
  };
  return (
    <>
      <PageHeading eyebrow="Restricted operations" title="Operations overview" subtitle="Review customer accounts, requests and recorded balance activity." />
      {summary.isError && <InlineError text="Summary totals are unavailable." retry={() => summary.refetch()} />}
      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Registered users" value={summary.data?.registeredUsers} />
        <Metric label="Active accounts" value={summary.data?.activeAccounts} />
        <Metric label="Pending operations" value={summary.data?.pendingOperations} />
        <Metric label="Wallet transactions" value={summary.data?.ledgerTransactions} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#d9e7e8] bg-[#eff7f7] px-4 py-3 text-[11px] text-[#48767b]"><ShieldCheck size={15} /> DUTSTAR wallet records only · no outside funds are held or sent.</div>
      <section className="mt-6 rounded-[20px] border border-[#dfe7ec] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Internal conversion rates</p><h2 className="mt-1 text-[15px] font-bold text-[#29425c]">Manage calculator rates</h2><p className="mt-1 max-w-2xl text-[10px] leading-5 text-[#718296]">Rates are entered by DUTSTAR administrators and are not live market quotes. Each request stores the rate and timestamp used for its estimate.</p></div>
        </div>
        <form onSubmit={submitExchangeRate} className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="From"><select data-testid="select-rate-source" value={rateSource} onChange={event => setRateSource(event.target.value as Currency)} className={inputClass}>{currencies.map(currency => <option key={currency} value={currency}>{currency}</option>)}</select></Field>
          <Field label="To"><select data-testid="select-rate-destination" value={rateDestination} onChange={event => setRateDestination(event.target.value as Currency)} className={inputClass}>{currencies.map(currency => <option key={currency} value={currency}>{currency}</option>)}</select></Field>
          <Field label="Rate (1 from = amount to)"><input data-testid="input-exchange-rate" required inputMode="decimal" pattern="[0-9]+(\\.[0-9]{1,10})?" min="0.0000000001" max="999999999999" step="0.0000000001" value={rateValue} onChange={event => setRateValue(event.target.value)} placeholder="e.g. 0.92" className={inputClass} /></Field>
          <Field label="Your 6-digit transaction PIN"><input data-testid="input-exchange-rate-pin" required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={ratePin} onChange={event => setRatePin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field>
          <button data-testid="button-save-exchange-rate" disabled={upsertExchangeRate.isPending || rateSource === rateDestination || !rateValue || ratePin.length !== 6} className="h-11 self-end rounded-xl bg-[#142f51] px-4 text-[10px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{upsertExchangeRate.isPending ? 'Saving…' : 'Save rate'}</button>
        </form>
        {rateMessage && <p role="status" className="mt-3 rounded-lg border border-[#dfe8ec] bg-[#f7f9fa] px-3 py-2 text-[10px] text-[#516b80]">{rateMessage}</p>}
        {exchangeRates.isLoading ? <div className="mt-5"><ListSkeleton /></div> : exchangeRates.isError ? <InlineError text="Conversion rates are unavailable." retry={() => exchangeRates.refetch()} /> : exchangeRates.data?.length ? <div className="mt-5 overflow-x-auto rounded-xl border border-[#e7edf0]"><table className="w-full min-w-[440px] text-left"><thead className="bg-[#f7f9fa] text-[9px] uppercase tracking-[.13em] text-[#8291a0]"><tr><th className="px-4 py-3">Pair</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3">Updated</th></tr></thead><tbody>{exchangeRates.data.map(rate => <tr key={`${rate.sourceCurrency}-${rate.destinationCurrency}`} data-testid={`row-rate-${rate.sourceCurrency}-${rate.destinationCurrency}`} className="border-t border-[#edf0f2] text-[10px] text-[#445a71]"><td className="px-4 py-3 font-semibold">{rate.sourceCurrency} → {rate.destinationCurrency}</td><td className="px-4 py-3 font-mono">{rate.rate}</td><td className="px-4 py-3">{formatDateTime(rate.updatedAt)}</td></tr>)}</tbody></table></div> : <div className="mt-5 rounded-xl bg-[#f7f9fa] px-4 py-3 text-[10px] text-[#75879a]">No rates are configured. Add a currency pair to enable the conversion calculator.</div>}
      </section>
      {statusError && <p role="alert" className="mt-3 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{statusError}</p>}
      {fundTarget && <section className="mt-6 rounded-[20px] border border-[#dfe7ec] bg-white p-5 sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Admin balance adjustment</p><h2 className="mt-1 text-[15px] font-bold text-[#29425c]">Adjust a user wallet</h2><p className="mt-1 text-[11px] text-[#7e8d9c]">{[fundTarget.firstName, fundTarget.lastName].filter(Boolean).join(' ') || 'DUTSTAR member'} · {fundTarget.email}</p></div>
          <button type="button" aria-label="Close funding form" onClick={() => { setFundTarget(null); setFundingError(''); setFundingSuccess(null); setFundSenderName(''); setFundDescription(''); setFundTransactionPin(''); }} className="rounded-lg p-2 text-[#6d8092] hover:bg-[#f1f5f7]"><X size={16} /></button>
        </div>
        <p className="mb-5 rounded-lg border border-[#d9e8e9] bg-[#f2f8f8] px-4 py-3 text-[10px] leading-4 text-[#4e777a]">This records a wallet credit or debit in DUTSTAR and writes an audit entry. It does not move outside funds. Maximum per entry: 1,000,000.00.</p>
        <form onSubmit={submitFunding} className="grid gap-4 sm:grid-cols-2">
          <Field label="Adjustment direction"><select value={fundDirection} onChange={event => setFundDirection(event.target.value as typeof fundDirection)} className={inputClass}><option value="credit">Credit wallet</option><option value="debit">Debit wallet</option></select></Field>
          <Field label="Currency"><select value={fundCurrency} onChange={event => setFundCurrency(event.target.value as Currency)} className={inputClass}>{currencies.map(item => <option key={item} value={item}>{item} · {currencyNames[item]}</option>)}</select></Field>
          <Field label="Amount"><input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" min="0.01" max="1000000" value={fundAmount} onChange={event => setFundAmount(event.target.value)} placeholder="0.00" className={inputClass} /></Field>
          <Field label="Counterparty / adjustment label"><input required maxLength={120} value={fundSenderName} onChange={event => setFundSenderName(event.target.value)} placeholder="DUTSTAR operations" className={inputClass} /></Field>
          <Field label="Transaction description"><input required maxLength={240} value={fundDescription} onChange={event => setFundDescription(event.target.value)} placeholder="Reason shown in transaction activity" className={inputClass} /></Field>
          <div className="sm:col-span-2"><Field label="Your 6-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={fundTransactionPin} onChange={event => setFundTransactionPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field></div>
          {fundingError && <p role="alert" className="sm:col-span-2 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{fundingError}</p>}
          {fundingSuccess && <p role="status" className="sm:col-span-2 rounded-lg border border-[#cfe5db] bg-[#f1f8f4] px-4 py-3 text-[11px] text-[#417461]">Balance adjustment recorded · {fundingSuccess.reference}</p>}
          <div className="sm:col-span-2"><button disabled={funding.isPending || fundTransactionPin.length !== 6 || !fundAmount || !fundSenderName.trim() || !fundDescription.trim()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#142f51] px-5 text-[11px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{funding.isPending ? 'Recording adjustment…' : 'Save balance adjustment'} <ArrowRight size={14} /></button></div>
        </form>
      </section>}
      <AdminLedgerRequestQueue />
      <section className="mt-7 overflow-hidden rounded-[20px] border border-[#e1e8ee] bg-white">
          <div className="flex flex-col gap-3 border-b border-[#edf0f3] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><div><h2 className="text-[14px] font-bold text-[#28405c]">Registered users</h2><p className="mt-1 text-[10px] text-[#8592a1]">Account status decisions are recorded automatically.</p></div><label className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8996a4]" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, email, or Customer ID" className="h-10 w-full rounded-lg border border-[#e0e7ec] bg-white pl-9 pr-3 text-[11px] outline-none sm:w-[240px]" /></label></div>
         {users.isLoading ? <ListSkeleton /> : users.isError ? <InlineError text="User records are unavailable." retry={() => users.refetch()} /> : users.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="bg-[#f7f9fa] text-[9px] uppercase tracking-[.13em] text-[#8291a0]"><tr><th className="px-6 py-3">Member</th><th className="px-4 py-3">Region</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Wallets</th><th className="px-6 py-3 text-right">Actions</th></tr></thead><tbody>{users.data.map(user => <tr key={user.id} className="border-t border-[#edf0f2] text-[11px] text-[#445a71]"><td className="px-6 py-4"><b className="block text-[#2d435c]">{[user.firstName, user.lastName].filter(Boolean).join(' ') || 'DUTSTAR member'}</b><span className="mt-1 block text-[10px] text-[#8a97a5]">{user.email}</span><span className="mt-1 block font-mono text-[10px] font-semibold tracking-[.08em] text-[#52717e]">Customer ID: {user.customerId ?? '—'}</span></td><td className="px-4 py-4">{user.country || '—'}</td><td className="px-4 py-4">{humanize(user.accountStatus)}</td><td className="px-4 py-4">{user.walletCount}</td><td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><Link href={`/admin/users/${encodeURIComponent(user.id)}`} className="rounded-lg border border-[#dfe6eb] px-3 py-2 text-[10px] font-bold text-[#3f5c75] hover:bg-[#f4f7f8]">Manage</Link><button disabled={user.accountStatus !== 'active'} onClick={() => { setFundTarget(user); setFundingError(''); setFundingSuccess(null); }} className="rounded-lg bg-[#eff7f7] px-3 py-2 text-[10px] font-bold text-[#36777c] hover:bg-[#e2f1f1] disabled:cursor-not-allowed disabled:opacity-40">Fund</button><button disabled={update.isPending} onClick={() => setStatus(user.id, user.accountStatus === 'active' ? 'suspended' : 'active')} className="rounded-lg border border-[#dfe6eb] px-3 py-2 text-[10px] font-bold text-[#3f5c75] hover:bg-[#f4f7f8] disabled:opacity-50">{user.accountStatus === 'active' ? 'Suspend' : 'Reactivate'}</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No users found" text="Try another email, name, or Customer ID." />}
      </section>
      <section className="mt-6 overflow-hidden rounded-[20px] border border-[#e1e8ee] bg-white">
        <div className="border-b border-[#edf0f3] px-5 py-4 sm:px-7"><h2 className="text-[14px] font-bold text-[#28405c]">Transaction review</h2><p className="mt-1 text-[10px] text-[#8592a1]">Review account activity and transaction status. Corrections preserve the original record and create separate audited entries.</p></div>
        {ledger.isLoading ? <ListSkeleton /> : ledger.isError ? <InlineError text="Transaction records are unavailable." retry={() => ledger.refetch()} /> : ledger.data?.length ? <TransactionList transactions={ledger.data} onStatusOverride={transaction => setStatusTarget(transaction)} statusPending={updateTransactionStatus.isPending} /> : <EmptyState title="No transactions to review" text="There are no recorded transactions to review." />}
      </section>
      {statusTarget && <TransactionStatusDialog
        transaction={statusTarget}
        pending={updateTransactionStatus.isPending}
        onClose={() => setStatusTarget(null)}
        onSave={saveTransactionStatus}
      />}
    </>
  );
}

export function AdminUserManagementPage() {
  const [, routeParams] = useRoute('/admin/users/:userId');
  const userId = routeParams?.userId ?? '';
  const queryClient = useQueryClient();
  const access = useGetAdminAccess({
    query: { queryKey: getGetAdminAccessQueryKey(), retry: false },
  });
  const detail = useGetAdminUserDetail(userId, {
    query: {
      queryKey: getGetAdminUserDetailQueryKey(userId),
      enabled: !!userId && !!access.data?.allowed,
    },
  });
  const user = detail.data?.user;
  const updateStatus = useUpdateAdminUserStatus();
  const createFunding = useCreateAdminFunding();
  const updateTransactionStatus = useUpdateAdminTransactionStatus();
  const resetTransactionPin = useResetAdminUserTransactionPin();

  const [currency, setCurrency] = useState<Currency>('USD');
  const [adjustmentDirection, setAdjustmentDirection] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [senderName, setSenderName] = useState('DUTSTAR operations');
  const [fundingDescription, setFundingDescription] = useState('');
  const [fundingPin, setFundingPin] = useState('');
  const [fundingError, setFundingError] = useState('');
  const [fundingReference, setFundingReference] = useState('');
  const [pageMessage, setPageMessage] = useState('');
  const [pageError, setPageError] = useState('');
  const [statusTarget, setStatusTarget] = useState<BankTransaction | null>(null);

  const refreshUserData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getGetAdminUserDetailQueryKey(userId),
      }),
      queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListAdminLedgerQueryKey() }),
    ]);
  };

  const changeAccountStatus = async () => {
    if (!user) return;
    const nextStatus = user.accountStatus === 'active' ? 'suspended' : 'active';
    setPageError('');
    try {
      await updateStatus.mutateAsync({
        userId,
        data: { accountStatus: nextStatus },
      });
      await refreshUserData();
      setPageMessage(`Account ${nextStatus === 'active' ? 'reactivated' : 'suspended'}.`);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Account status could not be updated.');
    }
  };

  const submitFunding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setFundingError('');
    setFundingReference('');
    try {
      const transaction = await createFunding.mutateAsync({
        userId,
        data: {
          direction: adjustmentDirection,
          currency,
          amount,
          senderName: senderName.trim(),
          description: fundingDescription.trim(),
          transactionPin: fundingPin,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      setFundingReference(transaction.reference);
      setAmount('');
      setFundingDescription('');
      setFundingPin('');
      await refreshUserData();
    } catch (error) {
      setFundingError(error instanceof Error ? error.message : 'The balance adjustment could not be recorded.');
    }
  };

  const resetMemberTransactionPin = async () => {
    if (!user) return;
    if (!window.confirm('Reset this member’s PIN? They will need to create a new PIN before making another transaction.')) return;
    setPageError('');
    try {
      await resetTransactionPin.mutateAsync({
        userId,
        data: {},
      });
      await refreshUserData();
      setPageMessage('Transaction PIN reset. The member must create a new PIN before their next transaction.');
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'The transaction PIN could not be reset.');
    }
  };

  const saveUserTransactionStatus = async (
    status: BankTransaction['status'],
    transactionPin: string,
  ) => {
    if (!statusTarget) return;
    await updateTransactionStatus.mutateAsync({
      transactionId: statusTarget.id,
      data: { status, transactionPin, confirmed: true },
    });
    setStatusTarget(null);
    await refreshUserData();
    setPageMessage(`Transaction ${statusTarget.reference} status was updated.`);
  };


  if (access.isLoading) return <PageSkeleton />;
  if (access.isError || !access.data?.allowed) {
    return (
      <Failure
        title="Operations access is restricted"
        text="This area is only available to authorized DUTSTAR operations staff."
        retry={() => access.refetch()}
      />
    );
  }
  if (detail.isLoading) return <PageSkeleton />;
  if (detail.isError || !detail.data) {
    return (
      <Failure
        title="Member record is unavailable"
        text="The user may no longer exist or the record could not be loaded."
        retry={() => detail.refetch()}
      />
    );
  }

  const profile = detail.data.user;
  const memberName =
    [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
    'DUTSTAR member';

  return (
    <>
      <Link href="/admin" className="mb-5 inline-flex items-center gap-2 text-[11px] font-bold text-[#4b687f] hover:text-[#2c7e84]">
        <ArrowLeft size={14} /> All users
      </Link>
      <PageHeading
        eyebrow="Restricted operations · Member management"
        title={memberName}
        subtitle="Review this member’s profile, wallet balances, activity, and account status."
      />
      {pageMessage && <p role="status" className="mt-4 rounded-lg border border-[#cfe5db] bg-[#f1f8f4] px-4 py-3 text-[11px] text-[#417461]">{pageMessage}</p>}
      {pageError && <p role="alert" className="mt-4 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{pageError}</p>}

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-[20px] border border-[#e1e8ee] bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#71869a]">Member profile</p>
                <h2 className="mt-2 text-[17px] font-bold text-[#29425c]">{memberName}</h2>
                <p className="mt-1 text-[11px] text-[#687d92]">{profile.email}</p>
              </div>
              <button
                type="button"
                disabled={updateStatus.isPending}
                onClick={changeAccountStatus}
                className={`rounded-lg px-4 py-2.5 text-[10px] font-bold ${profile.accountStatus === 'active' ? 'border border-[#ead8d5] text-[#a24940] hover:bg-[#fff7f5]' : 'bg-[#eff7f7] text-[#36777c] hover:bg-[#e2f1f1]'} disabled:opacity-50`}
              >
                {profile.accountStatus === 'active' ? 'Suspend account' : 'Reactivate account'}
              </button>
            </div>
            <dl className="mt-6 grid gap-4 border-t border-[#edf0f2] pt-5 sm:grid-cols-2">
              <div><dt className="text-[9px] font-bold uppercase tracking-[.12em] text-[#8492a0]">Email</dt><dd className="mt-1 break-all text-[11px] font-semibold text-[#40566e]">{profile.email}</dd></div>
              <div><dt className="text-[9px] font-bold uppercase tracking-[.12em] text-[#8492a0]">Phone</dt><dd className="mt-1 text-[11px] font-semibold text-[#40566e]">{detail.data.phone || 'Not provided'}</dd></div>
              <div><dt className="text-[9px] font-bold uppercase tracking-[.12em] text-[#8492a0]">Country / region</dt><dd className="mt-1 text-[11px] font-semibold text-[#40566e]">{profile.country || 'Not provided'}</dd></div>
              <div><dt className="text-[9px] font-bold uppercase tracking-[.12em] text-[#8492a0]">Date of birth</dt><dd className="mt-1 text-[11px] font-semibold text-[#40566e]">{detail.data.dateOfBirth || 'Not provided'}</dd></div>
              <div><dt className="text-[9px] font-bold uppercase tracking-[.12em] text-[#8492a0]">Member since</dt><dd className="mt-1 text-[11px] font-semibold text-[#40566e]">{formatDate(profile.createdAt)}</dd></div>
            </dl>
            <div className="mt-5 grid gap-3 border-t border-[#edf0f2] pt-5 sm:grid-cols-2">
              <div className="rounded-xl bg-[#f7f9fa] p-4"><StatusLine label="Account" value={humanize(profile.accountStatus)} positive={profile.accountStatus === 'active'} /></div>
              <div className="rounded-xl bg-[#f7f9fa] p-4"><StatusLine label="Private Vault" value={humanize(profile.vaultSubscriptionStatus)} positive={profile.vaultSubscriptionStatus === 'active'} /></div>
            </div>
          </section>

          <section className="rounded-[20px] border border-[#e1e8ee] bg-white p-5 sm:p-7">
            <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#71869a]">Wallets</p><h2 className="mt-1 text-[14px] font-bold text-[#28405c]">Wallet balances</h2></div><span className="text-[10px] text-[#8492a0]">{detail.data.wallets.length} wallet{detail.data.wallets.length === 1 ? '' : 's'}</span></div>
            {detail.data.wallets.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{detail.data.wallets.map(wallet => <WalletCard key={wallet.id} wallet={wallet} />)}</div> : <EmptyState title="No wallets yet" text="Wallets are created with the account. Approved account adjustments update their balances." />}
          </section>

          <section className="overflow-hidden rounded-[20px] border border-[#e1e8ee] bg-white">
            <div className="border-b border-[#edf0f3] px-5 py-4 sm:px-7"><h2 className="text-[14px] font-bold text-[#28405c]">Recent activity</h2><p className="mt-1 text-[10px] text-[#8592a1]">Latest 50 transactions. Posted records remain intact; corrections create separate audited entries.</p></div>
            {detail.data.transactions.length ? <TransactionList transactions={detail.data.transactions} onStatusOverride={transaction => setStatusTarget(transaction)} statusPending={updateTransactionStatus.isPending} /> : <EmptyState title="No activity yet" text="This member has no recorded transactions." />}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[20px] border border-[#e1e8ee] bg-white p-5 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">DUTSTAR account</p>
            <h2 className="mt-1 text-[14px] font-bold text-[#29425c]">Fund this user</h2>
            <p className="mt-2 text-[10px] leading-4 text-[#7e8d9c]">Records a wallet credit or debit with an audit entry. No outside funds are moved.</p>
            <form onSubmit={submitFunding} className="mt-4 space-y-3">
              <Field label="Adjustment direction"><select value={adjustmentDirection} onChange={event => setAdjustmentDirection(event.target.value as typeof adjustmentDirection)} className={inputClass}><option value="credit">Credit wallet</option><option value="debit">Debit wallet</option></select></Field>
              <Field label="Currency"><select value={currency} onChange={event => setCurrency(event.target.value as Currency)} className={inputClass}>{currencies.map(code => <option key={code} value={code}>{code} · {currencyNames[code]}</option>)}</select></Field>
              <Field label="Amount"><input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" min="0.01" max="1000000" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" className={inputClass} /></Field>
              <Field label="Counterparty / adjustment label"><input required maxLength={120} value={senderName} onChange={event => setSenderName(event.target.value)} className={inputClass} /></Field>
              <Field label="Description"><input required maxLength={240} value={fundingDescription} onChange={event => setFundingDescription(event.target.value)} placeholder="Shown in activity" className={inputClass} /></Field>
              <Field label="Your 6-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={fundingPin} onChange={event => setFundingPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field>
              {fundingError && <p role="alert" className="rounded-lg bg-[#fff1ef] px-3 py-2 text-[10px] text-[#a24940]">{fundingError}</p>}
              {fundingReference && <p role="status" className="rounded-lg bg-[#f1f8f4] px-3 py-2 text-[10px] text-[#417461]">Balance adjustment recorded · {fundingReference}</p>}
              <button disabled={profile.accountStatus !== 'active' || createFunding.isPending || fundingPin.length !== 6 || !amount || !senderName.trim() || !fundingDescription.trim()} className="h-10 w-full rounded-xl bg-[#142f51] px-4 text-[10px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{createFunding.isPending ? 'Recording…' : 'Save balance adjustment'}</button>
              {profile.accountStatus !== 'active' && <p className="text-[9px] text-[#9b8050]">Reactivate the account before adjusting its balance.</p>}
            </form>
          </section>

          <section className="rounded-[20px] border border-[#e1e8ee] bg-white p-5 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#71869a]">Transaction security</p>
            <h2 className="mt-1 text-[14px] font-bold text-[#29425c]">Member PIN</h2>
            <p className="mt-2 text-[10px] leading-4 text-[#7e8d9c]">Status: <b>{detail.data.transactionPinConfigured ? 'PIN is set' : 'PIN is not set'}</b>. Administrators cannot view or choose the member’s PIN; a reset requires the member to create a new one.</p>
            <button type="button" disabled={!detail.data.transactionPinConfigured || resetTransactionPin.isPending} onClick={resetMemberTransactionPin} className="mt-4 rounded-lg border border-[#ead8d5] px-3 py-2.5 text-[10px] font-bold text-[#a24940] hover:bg-[#fff7f5] disabled:cursor-not-allowed disabled:opacity-50">{resetTransactionPin.isPending ? 'Resetting…' : 'Reset member PIN'}</button>
          </section>
        </aside>
      </div>
      {statusTarget && <TransactionStatusDialog
        transaction={statusTarget}
        pending={updateTransactionStatus.isPending}
        onClose={() => setStatusTarget(null)}
        onSave={saveUserTransactionStatus}
      />}
    </>
  );
}

const disclosureCopy: Record<string, { eyebrow: string; title: string; intro: string; sections: [string, string][] }> = {
  '/fees': { eyebrow: 'Fees and rates', title: 'Understand transfer requests and rates.', intro: 'DUTSTAR does not process external deposits, payouts, or card payments.', sections: [['Rate quotes', 'DUTSTAR uses Frankfurter reference rates, with Grey as a fallback source. Availability depends on currency-pair support; quotes can change and are not confirmation of a payment.'], ['Fees', 'DUTSTAR records account requests and does not charge an outside transaction fee through a payment provider.'], ['Currency balances', 'Currency wallets are recorded separately. The rate and converted amount shown on a transfer receipt match the quote used when DUTSTAR recorded that request.']] },
  '/contact': { eyebrow: 'Contact', title: 'Contact DUTSTAR support securely.', intro: 'Sign in to open a private support conversation about your DUTSTAR account. Never send passwords, verification codes, or full payment credentials.', sections: [['Account help', 'Use the private support inbox for account questions and include a transaction reference when asking about a recorded DUTSTAR activity.'], ['Private conversations', 'Messages are visible only to you and authorized DUTSTAR support administrators.'], ['External payment limits', 'DUTSTAR support cannot complete, trace, or reverse payments made outside this product.']] },
};

export function DisclosurePage({ path }: { path: string }) {
  const { t } = useLanguage();
  const data = disclosureCopy[path];
  if (!data) return null;
  return (
    <div className="public-viewport-scroll bg-[#f5f8fa]">
       <header className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-6 sm:px-6"><Link href="/" aria-label={t('DUTSTAR Bank home')} className="flex shrink-0 items-center"><img src={`${import.meta.env.BASE_URL}dutstar-mark.svg`} alt={t('DUTSTAR Bank — Your world. Our priority.')} className="h-auto w-[128px] sm:w-[156px]" /></Link><div className="flex items-center gap-2"><AppLanguageSelector /><Link href="/" className="text-[12px] font-semibold text-[#456077] hover:text-[#347e83]">{t('Back to home')}</Link></div></header>
      <main className="mx-auto max-w-[1020px] px-6 pb-20 pt-10 sm:pt-16">
         <p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#4b8b90]">{t(data.eyebrow)}</p>
         <h1 className="bank-display mt-4 max-w-[760px] text-[clamp(2.6rem,7vw,5.2rem)] font-semibold leading-[1.02] text-[#16304f]">{t(data.title)}</h1>
         <p className="mt-6 max-w-[670px] text-[15px] leading-7 text-[#66788c]">{t(data.intro)}</p>
         {path === '/contact' && <Link href="/support" className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg bg-[#173b62] px-4 text-[11px] font-bold text-white hover:bg-[#245472]">{t('Open secure support inbox')}</Link>}
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {data.sections.map(([title, copy], index) => <article key={title} className="rounded-[20px] border border-[#e0e8ed] bg-white p-6 sm:p-7"><span className="font-mono text-[10px] font-bold tracking-[.14em] text-[#70a0a1]">0{index + 1}</span><h2 className="mt-4 text-[17px] font-bold text-[#27405a]">{t(title)}</h2><p className="mt-3 text-[12px] leading-6 text-[#76869a]">{t(copy)}</p></article>)}
        </div>
         <div className="mt-8 rounded-xl border border-[#d9e7e8] bg-[#edf6f6] p-5 text-[11px] leading-5 text-[#4c7579]"><b className="text-[#35676b]">{t('Important:')}</b> {t('DUTSTAR Bank is a product name for a software platform. It is not a representation that DUTSTAR is a licensed bank or financial institution.')}</div>
      </main>
       <footer className="border-t border-[#e2e8ed] bg-white px-6 py-7 text-center text-[10px] text-[#8794a3]">{t('DUTSTAR · Account activity software · no outside funds are held or sent')}</footer>
    </div>
  );
}

function PageHeading({ eyebrow, title, subtitle, titleClassName }: { eyebrow: string; title: string; subtitle?: string; titleClassName?: string }) {
  const { t } = useLanguage();
  return <div className="min-w-0 max-w-full"><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#548d92]">{t(eyebrow)}</p><h1 className={`bank-display mt-2 max-w-full break-words font-semibold text-[#1a334f] ${titleClassName ?? 'text-[clamp(2rem,4vw,3rem)] leading-[1.08]'}`}>{t(title)}</h1>{subtitle && <p className="mt-2 max-w-[760px] break-words text-[12px] leading-5 text-[#76879a]">{t(subtitle)}</p>}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const { t } = useLanguage();
  return <label className="block text-[11px] font-semibold text-[#435971]">{t(label)}<span className="mt-2 block">{children}</span></label>;
}

function WalletCard({ wallet }: { wallet: Wallet }) {
  const { t } = useLanguage();
  const accents: Record<string, string> = { USD: '#41878d', EUR: '#6881a3', GBP: '#a58b4e', NGN: '#598a70', CAD: '#a16964', AUD: '#6d7ea4' };
  return (
    <article data-testid={`wallet-card-${wallet.currency.toLowerCase()}`} className="rounded-[18px] border border-[#e1e8ed] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(27,51,78,.06)] sm:p-5">
      <div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eff5f6] text-[11px] font-bold" style={{ color: accents[wallet.currency] }}>{wallet.currency}</span><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold capitalize ${wallet.status === 'active' ? 'bg-[#eef7f3] text-[#4b826d]' : 'bg-[#fff4e7] text-[#a0793b]'}`}>{t(humanize(wallet.status))}</span></div>
      <p className="mt-4 text-[10px] text-[#8291a0]">{t(currencyNames[wallet.currency])} · {t('available')}</p>
      <p className="bank-display mt-1 break-words text-[clamp(1.35rem,5vw,1.7rem)] font-semibold tracking-[-.04em] text-[#1c3551]">{formatMoney(Number(wallet.available), wallet.currency)}</p>
      <div className="mt-4 border-t border-[#edf0f2] pt-3">
        <WalletAmount label="Pending" amount={wallet.pending} currency={wallet.currency} />
        <WalletAmount label="Reserved" amount={wallet.reserved} currency={wallet.currency} />
      </div>
    </article>
  );
}

function WalletAmount({ label, amount, currency }: { label: string; amount: string; currency: string }) {
  const { t } = useLanguage();
  return <div className="flex items-center justify-between py-1 text-[10px]"><span className="text-[#8794a2]">{t(label)}</span><span className="font-semibold text-[#576b80]">{formatMoney(Number(amount), currency)}</span></div>;
}

function WalletMini({ wallet }: { wallet: Wallet }) {
  const { t } = useLanguage();
  return <div className="flex items-center justify-between rounded-xl bg-[#f6f8fa] px-3.5 py-3"><span><b className="block text-[11px] text-[#3b5168]">{wallet.currency}</b><small className="mt-1 block text-[9px] text-[#8b98a5]">{t(currencyNames[wallet.currency])}</small></span><span className="text-[11px] font-semibold text-[#3e566e]">{formatMoney(Number(wallet.available), wallet.currency)}</span></div>;
}

function transactionDisplayType(transaction: BankTransaction) {
  switch (transaction.type) {
    case 'simulation_credit':
      return 'Opening balance';
    case 'admin_funding':
      return 'Balance adjustment credit';
    case 'admin_debit':
      return 'Balance adjustment debit';
    case 'transfer_in':
      return 'Member transfer';
    case 'transfer_out':
      return 'Member transfer sent';
    case 'external_transfer':
      return transaction.status === 'pending' ? 'DUTSTAR transfer request' : 'Recorded transfer';
    case 'external_transfer_in':
      return 'Prior account record';
    default:
      return humanize(transaction.type);
  }
}
function TransactionList({
  transactions,
  onStatusOverride,
  statusPending = false,
  showReceipt = true,
}: {
  transactions: BankTransaction[];
  onStatusOverride?: (transaction: BankTransaction) => void;
  statusPending?: boolean;
  showReceipt?: boolean;
}) {
  const { t } = useLanguage();
  const [receipt, setReceipt] = useState<BankTransaction | null>(null);
  const [historyTarget, setHistoryTarget] = useState<BankTransaction | null>(null);
  return <>
    <div>{transactions.map(transaction => {
      const isIncoming = transaction.type === 'transfer_in' || transaction.type === 'external_transfer_in' || transaction.type === 'simulation_credit' || transaction.type === 'admin_funding';
      const isPendingTransferRecord = transaction.type === 'external_transfer' && transaction.status === 'pending';
      const canPrintReceipt = transaction.status === 'completed';
      return <div key={transaction.id} className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-[#edf0f2] px-4 py-4 last:border-0 sm:flex-nowrap sm:gap-4 sm:px-7">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isIncoming ? 'bg-[#edf7f3] text-[#4d8c72]' : isPendingTransferRecord ? 'bg-[#fbf7eb] text-[#a0793b]' : 'bg-[#f0f4f7] text-[#658097]'}`}>{isPendingTransferRecord ? <ArrowLeftRight size={16} /> : isIncoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#334a63]">{transaction.description || t(transactionDisplayType(transaction))}</p><p className="mt-1 truncate text-[9px] text-[#8996a4]">{transaction.counterparty || t('DUTSTAR account')} · {customerTransactionDate(transaction.transactionDate, transaction.createdAt)} · {t('DUTSTAR record')}</p></div>
        <div className="shrink-0 text-right"><p className={`text-[11px] font-bold ${isIncoming ? 'text-[#417f69]' : isPendingTransferRecord ? 'text-[#a0793b]' : 'text-[#3c5269]'}`}>{isPendingTransferRecord ? `${t('Request')} · ` : isIncoming ? '+' : '−'}{formatMoney(Number(transaction.amount), transaction.currency)}</p><p className={`mt-1 text-[9px] capitalize ${transaction.status === 'completed' ? 'text-[#4f8c75]' : 'text-[#9b8050]'}`}>{t(humanize(transaction.status))}</p></div>
          {((canPrintReceipt && showReceipt) || onStatusOverride) && <div className="flex w-full flex-wrap justify-end gap-2 sm:ml-auto sm:w-auto sm:flex-nowrap">
           {canPrintReceipt && showReceipt && <button type="button" onClick={() => setReceipt(transaction)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#dfe7eb] px-2.5 py-2 text-[9px] font-bold text-[#4a667e] hover:bg-[#f5f8f9]" aria-label={t('View receipt {reference}', { reference: transaction.reference })}><FileText size={13} /><span className="hidden sm:inline">{t('Receipt')}</span></button>}
           {onStatusOverride && <button type="button" onClick={() => setHistoryTarget(transaction)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#dfe7eb] px-2.5 py-2 text-[9px] font-bold text-[#4a667e] hover:bg-[#f5f8f9]" aria-label={t('View status history for {reference}', { reference: transaction.reference })}><History size={13} /><span className="hidden sm:inline">{t('History')}</span></button>}
          {onStatusOverride && transaction.type !== 'deposit_request' && transaction.type !== 'withdrawal_request' && <button type="button" disabled={statusPending} onClick={() => onStatusOverride(transaction)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#dfe7eb] px-2.5 py-2 text-[9px] font-bold text-[#4a667e] hover:bg-[#f5f8f9] disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Override status for ${transaction.reference}`}><RefreshCw size={13} /><span className="hidden sm:inline">Status</span></button>}
        </div>}
      </div>;
    })}</div>
    {receipt && <ReceiptDialog transaction={receipt} onClose={() => setReceipt(null)} />}
    {historyTarget && <TransactionStatusHistoryDialog transaction={historyTarget} onClose={() => setHistoryTarget(null)} />}
  </>;
}

function TransactionStatusHistoryDialog({
  transaction,
  onClose,
}: {
  transaction: BankTransaction;
  onClose: () => void;
}) {
  const history = useListAdminTransactionStatusHistory(transaction.id, {
    query: {
      queryKey: getListAdminTransactionStatusHistoryQueryKey(transaction.id),
      retry: false,
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#14263e]/55 p-4"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="transaction-status-history-title" className="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-[22px] border border-[#dfe7ec] bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Administrator audit record</p>
            <h2 id="transaction-status-history-title" className="mt-1 text-[16px] font-bold text-[#29425c]">Status change history</h2>
            <p className="mt-1 break-all text-[10px] text-[#7e8d9c]">{transaction.reference}</p>
          </div>
          <button type="button" aria-label="Close status history" onClick={onClose} className="rounded-lg p-2 text-[#6d8092] hover:bg-[#f1f5f7]"><X size={16} /></button>
        </div>
        <p className="mt-4 rounded-lg border border-[#e5e9ed] bg-[#f7f9fa] px-4 py-3 text-[10px] leading-4 text-[#64798e]">This is a read-only audit history. Viewing it does not change the transaction or wallet balances.</p>
        <div className="mt-5">
          {history.isLoading ? <ListSkeleton /> : history.isError ? <InlineError text="Status history is unavailable." retry={() => history.refetch()} /> : history.data?.length ? (
            <ol className="space-y-3">
              {history.data.map((entry, index) => (
                <li key={`${entry.timestamp}-${entry.actorEmail}-${index}`} className="rounded-xl border border-[#e5ebef] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-[#344b64]">{humanize(entry.previousStatus)} <ArrowRight size={12} className="mx-1 inline text-[#73939a]" /> {humanize(entry.newStatus)}</p>
                    <time className="text-[9px] text-[#8291a0]" dateTime={entry.timestamp}>{formatDateTime(entry.timestamp)}</time>
                  </div>
                  <p className="mt-2 text-[10px] text-[#5a7086]">Changed by <b className="text-[#344b64]">{entry.actorName}</b> · {entry.actorEmail}</p>
                  <p className="mt-3 whitespace-pre-wrap text-[10px] leading-5 text-[#61758a]"><b className="text-[#40566e]">Reason:</b> {entry.reason}</p>
                  <p className="mt-3 text-[9px] text-[#8492a0]">Affected member{entry.affectedMembers.length === 1 ? '' : 's'}: {entry.affectedMembers.map(member => `${member.name} (${member.email})`).join(', ')}</p>
                </li>
              ))}
            </ol>
          ) : <EmptyState title="No status changes recorded" text="This transaction has not had an administrator status override." />}
        </div>
        <div className="mt-5 flex justify-end border-t border-[#edf0f2] pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-[#dfe6eb] px-4 py-3 text-[10px] font-bold text-[#546b80] hover:bg-[#f5f8f9]">Close</button>
        </div>
      </section>
    </div>
  );
}

function TransactionStatusDialog({
  transaction,
  pending,
  onClose,
  onSave,
}: {
  transaction: BankTransaction;
  pending: boolean;
  onClose: () => void;
  onSave: (status: BankTransaction['status'], transactionPin: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<BankTransaction['status']>(transaction.status);
  const [transactionPin, setTransactionPin] = useState('');
  const [error, setError] = useState('');
  const allowedStatuses: BankTransaction['status'][] =
    transaction.type === 'deposit_request' || transaction.type === 'withdrawal_request'
      ? []
      : transaction.status === 'pending'
      ? ['failed', 'rejected']
      : transaction.status === 'failed'
        ? ['pending']
        : [];

  useEffect(() => {
    setStatus(transaction.status);
    setTransactionPin('');
    setError('');
  }, [transaction.id, transaction.status]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      await onSave(status, transactionPin);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The transaction status could not be updated.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14263e]/55 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="transaction-status-title" className="w-full max-w-lg rounded-[22px] border border-[#dfe7ec] bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Admin transaction control</p><h2 id="transaction-status-title" className="mt-1 text-[16px] font-bold text-[#29425c]">Correct internal processing status</h2><p className="mt-1 break-all text-[10px] text-[#7e8d9c]">{transaction.reference}</p></div>
          <button type="button" aria-label="Close status override" onClick={onClose} className="rounded-lg p-2 text-[#6d8092] hover:bg-[#f1f5f7]"><X size={16} /></button>
        </div>
        <p className="mt-4 rounded-lg border border-[#e5e9ed] bg-[#f7f9fa] px-4 py-3 text-[10px] leading-4 text-[#64798e]">This status-only correction never changes wallet balances or their underlying records. The server checks the authoritative transaction; posted operations must use a separate audited reversal. Pending withdrawals must be handled in their review queue. Deposits are not manually reviewed.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="New status">
            <select value={status} onChange={event => setStatus(event.target.value as BankTransaction['status'])} className={inputClass}>
              <option value={transaction.status} disabled>{transaction.status.replaceAll('_', ' ')} (current)</option>
              {allowedStatuses.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Your 6-digit transaction PIN">
            <input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={transactionPin} onChange={event => setTransactionPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} />
          </Field>
          <label className="flex items-start gap-2 rounded-lg bg-[#f5f7f8] p-3 text-[10px] leading-4 text-[#64798e]"><input required type="checkbox" className="mt-0.5 accent-[#315f73]" />I reviewed the internal status and confirm this correction.</label>
          {error && <p role="alert" className="rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#dfe6eb] px-4 py-3 text-[10px] font-bold text-[#546b80] hover:bg-[#f5f8f9]">Cancel</button>
            <button disabled={pending || !allowedStatuses.includes(status) || transactionPin.length !== 6} className="rounded-xl bg-[#142f51] px-4 py-3 text-[10px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Saving status…' : 'Confirm status correction'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ReceiptDialog({ transaction, onClose }: { transaction: ReceiptTransaction; onClose: () => void }) {
  return <TransferReceiptModal transaction={transaction} onClose={onClose} title={transactionDisplayType(transaction)} />;
}

function StatusLine({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-[11px] text-[#8793a1]">{label}</span><span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${positive ? 'text-[#4c836e]' : 'text-[#927944]'}`}><span className={`h-1.5 w-1.5 rounded-full ${positive ? 'bg-[#71ad8d]' : 'bg-[#d0ad5d]'}`} />{value}</span></div>;
}

function ActionTile({ href, icon, label, testId }: { href: string; icon: ReactNode; label: string; testId?: string }) {
  return <Link href={href} data-testid={testId} className="flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-[#e5ebef] bg-[#fbfcfd] px-1.5 py-2 text-center text-[9px] font-bold text-[#3d556d] transition hover:border-[#bbd7d8] hover:bg-[#f3f9f9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#43888e]"><span className="grid h-6 w-6 place-items-center rounded-md bg-[#edf5f6] text-[#478b90]">{icon}</span><span className="w-full truncate">{label}</span></Link>;
}

function FeatureBlock({ number, title, copy }: { number: string; title: string; copy: string }) {
  return <article className="border-t border-[#dfe6eb] pt-4"><span className="font-mono text-[10px] text-[#61959a]">{number} /</span><h3 className="mt-2 text-[14px] font-bold text-[#2c435c]">{title}</h3><p className="mt-2 text-[11px] leading-5 text-[#76879a]">{copy}</p></article>;
}

function Metric({ label, value }: { label: string; value?: number }) {
  return <div className="rounded-[18px] border border-[#e1e8ee] bg-white p-5"><p className="text-[10px] text-[#8290a0]">{label}</p><p className="bank-display mt-2 text-[30px] font-semibold text-[#223b56]">{value === undefined ? '—' : value.toLocaleString()}</p></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="px-6 py-12 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#eef5f6] text-[#5b9397]"><Sparkles size={18} /></span><h3 className="mt-4 text-[13px] font-bold text-[#38506a]">{title}</h3><p className="mx-auto mt-1 max-w-[330px] text-[11px] leading-5 text-[#8693a1]">{text}</p></div>;
}

function PageSkeleton() {
  return <GlobusLoader label="Loading your DUTSTAR account" />;
}

function ListSkeleton() {
  return <div className="animate-pulse space-y-4 p-6">{[0, 1, 2, 3].map(item => <div key={item} className="flex items-center gap-4"><span className="h-9 w-9 rounded-xl bg-[#e7edf1]" /><span className="flex-1"><span className="block h-3 w-40 max-w-full rounded bg-[#e4ebef]" /><span className="mt-2 block h-2 w-28 rounded bg-[#edf1f3]" /></span><span className="h-3 w-16 rounded bg-[#e4ebef]" /></div>)}</div>;
}

function Failure({ title, text, retry }: { title: string; text?: string; retry: () => void }) {
  return <div className="mt-7 rounded-[20px] border border-[#eadfda] bg-white px-6 py-12 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#fbf1ed] text-[#a56756]"><CircleHelp size={18} /></span><h2 className="mt-4 text-[14px] font-bold text-[#3c4d5e]">{title}</h2><p className="mt-2 text-[11px] text-[#8994a0]">{text ?? 'Please check your connection and try again.'}</p><button onClick={retry} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#dfe6ea] px-4 py-2.5 text-[10px] font-bold text-[#435b72] hover:bg-[#f4f7f9]"><RefreshCw size={13} /> Try again</button></div>;
}

function InlineError({ text, retry }: { text: string; retry: () => void }) {
  return <div className="flex items-center justify-between gap-4 px-5 py-5 text-[11px] text-[#a05c50]"><span>{text}</span><button onClick={retry} className="inline-flex shrink-0 items-center gap-1.5 font-bold"><RefreshCw size={12} />Retry</button></div>;
}

function previewConversionAmount(amount: string, rate: string): string | null {
  const amountMatch = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(amount);
  const rateMatch = /^(\d{1,12})(?:\.(\d{1,10}))?$/.exec(rate);
  if (!amountMatch || !rateMatch) return null;
  const minor = BigInt(amountMatch[1]) * 100n + BigInt((amountMatch[2] ?? '').padEnd(2, '0'));
  const scale = 10n ** 10n;
  const rateScaled = BigInt(rateMatch[1]) * scale + BigInt((rateMatch[2] ?? '').padEnd(10, '0'));
  const converted = (minor * rateScaled + scale / 2n) / scale;
  return `${converted / 100n}.${(converted % 100n).toString().padStart(2, '0')}`;
}

function getReceiptConversion(transaction: ReceiptTransaction): ReceiptConversion | null {
  if (transaction.conversion) return transaction.conversion;
  if (transaction.type !== 'external_transfer' || !transaction.description) return null;
  const match = /(?:^| · )(\d+(?:\.\d{1,2})?) ([A-Z]{3}) converted to (\d+(?:\.\d{1,2})?) ([A-Z]{3}) at (\d+(?:\.\d{1,10})?)(?:$| · )/.exec(transaction.description);
  if (!match) return null;
  return {
    sourceAmount: match[1],
    sourceCurrency: match[2],
    destinationAmount: match[3],
    destinationCurrency: match[4],
    exchangeRate: match[5],
  };
}

function formatExchangeRate(rate: string): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(rate.trim());
  if (!match) return rate;

  const integer = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (match[2] ?? '').replace(/0+$/, '');
  return fraction ? `${integer}.${fraction}` : integer;
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function humanize(value?: string | null) {
  return value ? value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase()) : 'Not available';
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

const inputClass = 'h-11 w-full rounded-xl border border-[#dfe6eb] bg-white px-3.5 text-[12px] font-normal text-[#344b64] outline-none transition placeholder:text-[#a0acb7] focus:border-[#77aeb0] focus:ring-2 focus:ring-[#77aeb0]/15';
