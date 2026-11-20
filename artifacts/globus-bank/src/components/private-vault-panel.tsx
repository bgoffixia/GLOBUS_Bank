import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Bell, FileText, LayoutDashboard, LockKeyhole, Menu, ReceiptText, ShieldCheck, UserRound, WalletCards, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/react';
import {
  getGetBankVaultBillingQueryKey,
  getGetBankVaultEmailPreferencesQueryKey,
  getGetBankVaultReceiptPreferenceQueryKey,
  getGetBankVaultStatusQueryKey,
  getGetBankPushConfigQueryKey,
  getGetBankPushPreferencesQueryKey,
  getListBankTransactionsQueryKey,
  getListBankVaultTransactionNotesQueryKey,
  getListBankVaultWalletControlsQueryKey,
  useDeleteBankPushSubscription,
  useDeleteBankVaultTransactionNote,
  useGetBankPushConfig,
  useGetBankPushPreferences,
  useGetBankVaultBilling,
  useGetBankVaultEmailPreferences,
  useGetBankVaultReceiptPreference,
  useGetBankVaultStatus,
  useEmailBankVaultPaystackRenewalManagementLink,
  useInitializeBankVaultPaystackPayment,
  useInitializeBankVaultPasscode,
  useListBankTransactions,
  useListBankVaultTransactionNotes,
  useListBankVaultWalletControls,
  useSaveBankPushSubscription,
  useUnlockBankVault,
  useUpdateBankPushPreferences,
  useUpdateBankVaultEmailPreferences,
  useUpdateBankVaultReceiptPreference,
  useUpdateBankVaultPasscode,
  useUpdateBankVaultTransactionNote,
  useUpdateBankVaultWalletControl,
  useVerifyBankVaultPaystackPayment,
} from '@workspace/api-client-react';
import type { BankTransaction, BankVaultEmailPreferences, BankVaultWalletControl } from '@workspace/api-client-react';
import { fetchWebpushrSubscriberId, loadWebpushr } from '../lib/webpushr-client';
import { RECEIPT_LAYOUTS, type ReceiptTemplateId } from '../lib/receipt-layouts';
import { customerTransactionDate } from '../lib/transaction-date';
import { TransferReceiptModal, TransferReceiptPreview, type ReceiptTransaction } from './transfer/transfer-receipt';
import { canLoadVaultPrivateData, isVaultSessionActive, isVaultSessionRejected } from '../lib/vault-error-state';
import { VaultFundingForm } from './vault-funding-form';
import { buildReceiptLayoutPreview, canSaveReceiptPreference, shouldClearSavedReceiptSelection } from '../lib/vault-receipt-preview';

const fieldClass = 'h-9 w-full rounded-lg border border-[#dfe6eb] bg-white px-3 text-[11px] text-[#344b64] outline-none focus:border-[#77aeb0] focus:ring-2 focus:ring-[#77aeb0]/15';
type VaultPlanCode = '1m' | '3m' | '1y';
type SubscriptionStep = 'closed' | 'plans' | 'payment';
const vaultPathBySectionId: Record<string, string> = {
  'vault-overview': '/private-vault',
  'vault-subscription-card': '/private-vault/subscription',
  'vault-subscription-access': '/private-vault/subscription',
  'vault-workspace-funding': '/private-vault/funding',
  'vault-activity': '/private-vault/activity',
  'vault-receipts': '/private-vault/receipts',
  'vault-workspace-wallets': '/private-vault/wallet-controls',
  'vault-account-controls': '/private-vault/wallet-controls',
  'vault-security': '/private-vault/security',
  'vault-browser-alerts': '/private-vault/alerts',
  'vault-personal-notes': '/private-vault/notes',
  'vault-email-preferences': '/private-vault/email-preferences',
};
const vaultNavigationIdByPath: Record<string, string> = {
  '/private-vault': 'vault-overview',
  '/private-vault/subscription': 'vault-subscription-card',
  '/private-vault/funding': 'vault-workspace-funding',
  '/private-vault/activity': 'vault-activity',
  '/private-vault/receipts': 'vault-receipts',
  '/private-vault/wallet-controls': 'vault-account-controls',
  '/private-vault/security': 'vault-security',
  '/private-vault/alerts': 'vault-browser-alerts',
  '/private-vault/notes': 'vault-personal-notes',
  '/private-vault/email-preferences': 'vault-email-preferences',
};

function ngnMinor(value: string) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value) / 100);
}

function bannerForeground(hex: string) {
  const parts = hex.replace('#', '').match(/.{2}/g)?.map(value => Number.parseInt(value, 16));
  if (!parts || parts.length !== 3 || parts.some(Number.isNaN)) return '#ffffff';
  const luminance = (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) / 255;
  return luminance > 0.62 ? '#17314f' : '#ffffff';
}

export function PrivateVaultPanel() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const status = useGetBankVaultStatus({ query: { queryKey: getGetBankVaultStatusQueryKey(), retry: false, refetchInterval: 60_000 } });
  const initialize = useInitializeBankVaultPasscode();
  const unlock = useUnlockBankVault();
  const [sessionToken, setSessionToken] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [passcode, setPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyWallet, setBusyWallet] = useState('');
  const [bannerTheme, setBannerTheme] = useState<BankVaultEmailPreferences['bannerTheme']>('navy');
  const [bannerHeadline, setBannerHeadline] = useState('A Globus transfer notice');
  const [bannerBackgroundColor, setBannerBackgroundColor] = useState('#12385d');
  const [includeSupportLink, setIncludeSupportLink] = useState(false);
  const [supportUrl, setSupportUrl] = useState('');
  const [supportLabel, setSupportLabel] = useState('Contact support');
  const [senderLocalPart, setSenderLocalPart] = useState('');
  const [transactionEmailAlertsEnabled, setTransactionEmailAlertsEnabled] = useState(false);
  const [preferredReceiptTemplate, setPreferredReceiptTemplate] = useState<ReceiptTemplateId>('standard');
  const [browserPushMessage, setBrowserPushMessage] = useState('');
  const [browserPushError, setBrowserPushError] = useState('');
  const subscriptionStorageKey = user?.id ? `globus-push-subscription-id:${user.id}` : '';
  const [savedPushSubscriptionId, setSavedPushSubscriptionId] = useState('');
  const browserPushSupported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const [privateNoteDraft, setPrivateNoteDraft] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<VaultPlanCode>('1m');
  const [autoRenew, setAutoRenew] = useState(false);
  const [subscriptionStep, setSubscriptionStep] = useState<SubscriptionStep>('closed');
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<ReceiptTransaction | null>(null);
  const [receiptPreviewIsIllustrative, setReceiptPreviewIsIllustrative] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const activeNavigation = vaultNavigationIdByPath[location] ?? 'vault-overview';
  const paymentCallbackHandled = useRef('');
  const lastSubscriptionStatus = useRef<string | undefined>(undefined);
  const receiptPreferenceWasAuthorized = useRef(false);
  const openSelectedReceiptPreview = () => {
    const preview = buildReceiptLayoutPreview(
      privateVaultDataEnabled ? transactions.data?.[0] : undefined,
      preferredReceiptTemplate,
    );
    setReceiptPreview(preview.transaction);
    setReceiptPreviewIsIllustrative(preview.illustrativeOnly);
  };
  const vaultNavigation = [
    { id: 'vault-overview', label: 'Overview', icon: LayoutDashboard, requiresUnlock: false },
    { id: 'vault-subscription-card', label: 'Subscription', icon: ShieldCheck, requiresUnlock: true },
    { id: 'vault-workspace-funding', label: 'Funding', icon: WalletCards, requiresUnlock: true },
    { id: 'vault-activity', label: 'Activity', icon: FileText, requiresUnlock: true },
    { id: 'vault-receipts', label: 'Receipt style', icon: ReceiptText, requiresUnlock: false },
    { id: 'vault-account-controls', label: 'Wallet controls', icon: WalletCards, requiresUnlock: true },
    { id: 'vault-security', label: 'Security', icon: LockKeyhole, requiresUnlock: true },
    { id: 'vault-browser-alerts', label: 'Browser alerts', icon: Bell, requiresUnlock: true },
    { id: 'vault-personal-notes', label: 'Personal notes', icon: FileText, requiresUnlock: true },
    { id: 'vault-email-preferences', label: 'Email preferences', icon: ReceiptText, requiresUnlock: true },
  ] as const;
  const vaultSessionActive = isVaultSessionActive(sessionToken, expiresAt);
  const privateVaultDataEnabled = vaultSessionActive && canLoadVaultPrivateData(
    sessionToken,
    status.data?.accessActive,
  );
  const billing = useGetBankVaultBilling({
    query: {
      queryKey: getGetBankVaultBillingQueryKey(),
      enabled: vaultSessionActive,
      retry: false,
    },
    request: vaultSessionActive ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const initializePaystackPayment = useInitializeBankVaultPaystackPayment({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const verifyPaystackPayment = useVerifyBankVaultPaystackPayment({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const emailRenewalManagementLink = useEmailBankVaultPaystackRenewalManagementLink({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const browserPushConfig = useGetBankPushConfig({
    query: { queryKey: getGetBankPushConfigQueryKey(), retry: false },
  });
  const browserPushPreferences = useGetBankPushPreferences({
    query: {
      queryKey: getGetBankPushPreferencesQueryKey(),
      enabled: vaultSessionActive,
      retry: false,
    },
  });
  const savePushSubscription = useSaveBankPushSubscription();
  const deletePushSubscription = useDeleteBankPushSubscription();
  const updateBrowserPushPreferences = useUpdateBankPushPreferences({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  useEffect(() => () => {
    void queryClient.cancelQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
    void queryClient.cancelQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
  void queryClient.cancelQueries({ queryKey: getGetBankVaultReceiptPreferenceQueryKey() });
    void queryClient.cancelQueries({ queryKey: getGetBankVaultBillingQueryKey() });
    void queryClient.cancelQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
    queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
    queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
  queryClient.removeQueries({ queryKey: getGetBankVaultReceiptPreferenceQueryKey() });
    queryClient.removeQueries({ queryKey: getGetBankVaultBillingQueryKey() });
    queryClient.removeQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
  }, [queryClient]);

  const controls = useListBankVaultWalletControls({
    query: {
      queryKey: getListBankVaultWalletControlsQueryKey(),
      enabled: privateVaultDataEnabled,
      retry: false,
    },
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const emailPreferences = useGetBankVaultEmailPreferences({
    query: {
      queryKey: getGetBankVaultEmailPreferencesQueryKey(),
      enabled: privateVaultDataEnabled,
      retry: false,
    },
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const receiptPreference = useGetBankVaultReceiptPreference({
    query: {
      queryKey: getGetBankVaultReceiptPreferenceQueryKey(),
      enabled: privateVaultDataEnabled,
      retry: false,
    },
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const saveReceiptPreference = useUpdateBankVaultReceiptPreference({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const saveEmailPreferences = useUpdateBankVaultEmailPreferences({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const updatePasscode = useUpdateBankVaultPasscode({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const updateControl = useUpdateBankVaultWalletControl({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const transactions = useListBankTransactions(
    { limit: 100 },
    {
      query: {
        queryKey: getListBankTransactionsQueryKey({ limit: 100 }),
        enabled: privateVaultDataEnabled,
        staleTime: 30_000,
      },
    },
  );
  const transactionNotes = useListBankVaultTransactionNotes({
    query: {
      queryKey: getListBankVaultTransactionNotesQueryKey(),
      enabled: privateVaultDataEnabled,
      retry: false,
    },
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const saveTransactionNote = useUpdateBankVaultTransactionNote({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const deleteTransactionNote = useDeleteBankVaultTransactionNote({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  useEffect(() => {
    if (!subscriptionStorageKey) {
      setSavedPushSubscriptionId('');
      return;
    }
    setSavedPushSubscriptionId(localStorage.getItem(subscriptionStorageKey) ?? '');
  }, [subscriptionStorageKey]);
  useEffect(() => {
    if (!emailPreferences.data) return;
    setTransactionEmailAlertsEnabled(emailPreferences.data.transactionEmailAlertsEnabled);
    setBannerTheme(emailPreferences.data.bannerTheme);
    setBannerHeadline(emailPreferences.data.bannerHeadline);
    setBannerBackgroundColor(emailPreferences.data.bannerBackgroundColor);
    setIncludeSupportLink(emailPreferences.data.includeSupportLink);
    setSupportUrl(emailPreferences.data.supportUrl ?? '');
    setSupportLabel(emailPreferences.data.supportLabel);
    setSenderLocalPart(emailPreferences.data.senderLocalPart ?? '');
  }, [emailPreferences.data]);
  useEffect(() => {
    if (!mobileNavigationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavigationOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileNavigationOpen]);
  useEffect(() => {
    if (!receiptPreference.data) return;
    setPreferredReceiptTemplate(receiptPreference.data.preferredReceiptTemplate);
  }, [receiptPreference.data]);
  useEffect(() => {
    const hasPreferenceAccess = canSaveReceiptPreference(sessionToken, !!status.data?.accessActive);
    if (shouldClearSavedReceiptSelection(
      receiptPreferenceWasAuthorized.current,
      sessionToken,
      !!status.data?.accessActive,
    )) {
      setPreferredReceiptTemplate('standard');
    }
    receiptPreferenceWasAuthorized.current = hasPreferenceAccess;
  }, [sessionToken, status.data?.accessActive]);
  useEffect(() => {
    if (!selectedTransactionId && transactions.data?.length) {
      setSelectedTransactionId(transactions.data[0].id);
    }
  }, [selectedTransactionId, transactions.data]);
  const selectedTransactionNote = transactionNotes.data?.find(
    item => item.transactionId === selectedTransactionId,
  );
  useEffect(() => {
    setPrivateNoteDraft(selectedTransactionNote?.note ?? '');
  }, [selectedTransactionId, selectedTransactionNote?.note]);
  useEffect(() => {
    if (sessionToken) return;
    void queryClient.cancelQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
    queryClient.removeQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
    setSelectedTransactionId('');
    setPrivateNoteDraft('');
  }, [queryClient, sessionToken]);
  useEffect(() => {
    if (!sessionToken || !expiresAt) return;
    const remaining = Date.parse(expiresAt) - Date.now();
    if (remaining <= 0) {
      queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultReceiptPreferenceQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultBillingQueryKey() });
      queryClient.removeQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
      queryClient.removeQueries({ queryKey: getListBankTransactionsQueryKey({ limit: 100 }) });
      setSessionToken('');
      setExpiresAt('');
      setReceiptPreview(null);
      setReceiptPreviewIsIllustrative(false);
      setSelectedTransactionId('');
      setPrivateNoteDraft('');
      setSubscriptionStep('closed');
      return;
    }
    const timeout = window.setTimeout(() => {
      void queryClient.cancelQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      void queryClient.cancelQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      void queryClient.cancelQueries({ queryKey: getGetBankVaultReceiptPreferenceQueryKey() });
      void queryClient.cancelQueries({ queryKey: getGetBankVaultBillingQueryKey() });
      void queryClient.cancelQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
      void queryClient.cancelQueries({ queryKey: getListBankTransactionsQueryKey({ limit: 100 }) });
      queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultReceiptPreferenceQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultBillingQueryKey() });
      queryClient.removeQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
      queryClient.removeQueries({ queryKey: getListBankTransactionsQueryKey({ limit: 100 }) });
      setSessionToken('');
      setExpiresAt('');
      setReceiptPreview(null);
      setReceiptPreviewIsIllustrative(false);
      setSelectedTransactionId('');
      setPrivateNoteDraft('');
      setMobileNavigationOpen(false);
      setSubscriptionStep('closed');
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [expiresAt, queryClient, sessionToken]);
  useEffect(() => {
    if (status.data?.accessActive !== false) return;
    const privateQueryKeys = [
      getListBankVaultWalletControlsQueryKey(),
      getGetBankVaultEmailPreferencesQueryKey(),
      getGetBankVaultReceiptPreferenceQueryKey(),
      getListBankVaultTransactionNotesQueryKey(),
    ];
    for (const queryKey of privateQueryKeys) {
      void queryClient.cancelQueries({ queryKey });
      queryClient.removeQueries({ queryKey });
    }
    void queryClient.cancelQueries({ queryKey: getListBankTransactionsQueryKey({ limit: 100 }) });
    queryClient.removeQueries({ queryKey: getListBankTransactionsQueryKey({ limit: 100 }) });
    setSelectedTransactionId('');
    setPrivateNoteDraft('');
    setReceiptPreview(null);
    setReceiptPreviewIsIllustrative(false);
  }, [queryClient, status.data?.accessActive]);

  const submitPasscode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      if (!status.data?.configured) {
        await initialize.mutateAsync({ data: { passcode } });
        await queryClient.invalidateQueries({ queryKey: getGetBankVaultStatusQueryKey() });
        setPasscode('');
        setMessage('Vault passcode set. Unlock to view plans and Vault settings.');
      } else {
        const result = await unlock.mutateAsync({ data: { passcode } });
        setSessionToken(result.sessionToken);
        setExpiresAt(result.expiresAt);
        setPasscode('');
        await queryClient.invalidateQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetBankVaultBillingQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetBankVaultReceiptPreferenceQueryKey() });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The vault request could not be completed.');
    }
  };
  const navigateToSection = (sectionId: string) => {
    const path = vaultPathBySectionId[sectionId];
    if (!path) return;
    setLocation(path);
    setMobileNavigationOpen(false);
  };
  const changeVaultPasscode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await updatePasscode.mutateAsync({ data: { newPasscode } });
      setNewPasscode('');
      setSessionToken('');
      setExpiresAt('');
      setSubscriptionStep('closed');
      void queryClient.cancelQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      void queryClient.cancelQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      void queryClient.cancelQueries({ queryKey: getGetBankVaultReceiptPreferenceQueryKey() });
      void queryClient.cancelQueries({ queryKey: getGetBankVaultBillingQueryKey() });
      queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultReceiptPreferenceQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultBillingQueryKey() });
      queryClient.removeQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
      queryClient.removeQueries({ queryKey: getListBankTransactionsQueryKey({ limit: 100 }) });
      setReceiptPreview(null);
      setReceiptPreviewIsIllustrative(false);
      setSelectedTransactionId('');
      setPrivateNoteDraft('');
      setMessage('Vault passcode updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vault passcode could not be updated.');
    }
  };
  const lockVault = () => {
    void queryClient.cancelQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
    void queryClient.cancelQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
    void queryClient.cancelQueries({ queryKey: getGetBankVaultReceiptPreferenceQueryKey() });
    void queryClient.cancelQueries({ queryKey: getGetBankVaultBillingQueryKey() });
    void queryClient.cancelQueries({ queryKey: getListBankTransactionsQueryKey({ limit: 100 }) });
    queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
    queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
    queryClient.removeQueries({ queryKey: getGetBankVaultReceiptPreferenceQueryKey() });
    queryClient.removeQueries({ queryKey: getGetBankVaultBillingQueryKey() });
    queryClient.removeQueries({ queryKey: getListBankTransactionsQueryKey({ limit: 100 }) });
    queryClient.removeQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
    setSessionToken('');
    setExpiresAt('');
    setPasscode('');
    setNewPasscode('');
    setSelectedTransactionId('');
    setPrivateNoteDraft('');
    setReceiptPreview(null);
    setReceiptPreviewIsIllustrative(false);
    setMobileNavigationOpen(false);
    setSubscriptionStep('closed');
  };
  useEffect(() => {
    if (!sessionToken) return;
    const rejected = [
      controls.error,
      emailPreferences.error,
      receiptPreference.error,
      transactionNotes.error,
    ].some(isVaultSessionRejected);
    if (!rejected) return;

    void queryClient.cancelQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
    void queryClient.cancelQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
    void queryClient.cancelQueries({ queryKey: getGetBankVaultReceiptPreferenceQueryKey() });
    void queryClient.cancelQueries({ queryKey: getGetBankVaultBillingQueryKey() });
    void queryClient.cancelQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
    void queryClient.cancelQueries({ queryKey: getListBankTransactionsQueryKey({ limit: 100 }) });
    queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
    queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
    queryClient.removeQueries({ queryKey: getGetBankVaultReceiptPreferenceQueryKey() });
    queryClient.removeQueries({ queryKey: getGetBankVaultBillingQueryKey() });
    queryClient.removeQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
    queryClient.removeQueries({ queryKey: getListBankTransactionsQueryKey({ limit: 100 }) });
    setSessionToken('');
    setExpiresAt('');
    setSubscriptionStep('closed');
    setReceiptPreview(null);
    setReceiptPreviewIsIllustrative(false);
    setSelectedTransactionId('');
    setPrivateNoteDraft('');
    setMobileNavigationOpen(false);
    setMessage('');
    setError('Your Vault session expired or access changed. Unlock it again to continue.');
    void queryClient.invalidateQueries({ queryKey: getGetBankVaultStatusQueryKey() });
  }, [
    controls.error,
    emailPreferences.error,
    receiptPreference.error,
    queryClient,
    sessionToken,
    transactionNotes.error,
  ]);
  const startPaystackCheckout = async () => {
    setError('');
    setMessage('');
    try {
      const checkout = await initializePaystackPayment.mutateAsync({
        data: { planCode: selectedPlan, autoRenew },
      });
      window.location.assign(checkout.authorizationUrl);
    } catch (err) {
      await queryClient.invalidateQueries({ queryKey: getGetBankVaultStatusQueryKey() });
      setError(err instanceof Error ? err.message : 'Paystack checkout could not be started.');
    }
  };
  const requestRenewalManagementLink = async () => {
    setError('');
    setMessage('');
    try {
      await emailRenewalManagementLink.mutateAsync();
      setMessage('Paystack sent a subscription management link to your account email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The renewal management link could not be sent.');
    }
  };
  const checkPaystackPayment = async (reference = status.data?.paymentReference) => {
    if (!reference) {
      setError('There is no Paystack payment to verify.');
      return;
    }
    setError('');
    setMessage('');
    setIsVerifyingPayment(true);
    try {
      const updated = await verifyPaystackPayment.mutateAsync({
        data: { reference },
      });
      queryClient.setQueryData(getGetBankVaultStatusQueryKey(), updated);
      await queryClient.invalidateQueries({ queryKey: getGetBankVaultStatusQueryKey() });
      setSubscriptionStep('closed');
      setMessage('Paystack confirmed your payment. Private Vault access is active.');
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (err) {
      await queryClient.invalidateQueries({ queryKey: getGetBankVaultStatusQueryKey() });
      setError(err instanceof Error ? err.message : 'Paystack payment could not be verified yet.');
    } finally {
      setIsVerifyingPayment(false);
    }
  };
  const billingBusy =
    initializePaystackPayment.isPending ||
    emailRenewalManagementLink.isPending ||
    isVerifyingPayment;
  const callbackReference = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('reference') ?? ''
    : '';
  useEffect(() => {
    if (
      !sessionToken ||
      !callbackReference ||
      !status.data?.paymentReference ||
      callbackReference !== status.data.paymentReference ||
      paymentCallbackHandled.current === callbackReference
    ) return;
    paymentCallbackHandled.current = callbackReference;
    void checkPaystackPayment(callbackReference);
  }, [sessionToken, callbackReference, status.data?.paymentReference]);
  const submitEmailPreferences = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!status.data?.accessActive) {
      setError('Active Private Vault access is required to change settings.');
      return;
    }
    try {
      await saveEmailPreferences.mutateAsync({
        data: {
          transactionEmailAlertsEnabled,
          bannerTheme,
          bannerHeadline: bannerHeadline.trim(),
          bannerBackgroundColor,
          includeSupportLink,
          supportUrl: supportUrl.trim() || null,
          supportLabel: supportLabel.trim(),
          senderLocalPart: senderLocalPart.trim().toLowerCase() || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
       setMessage('Transfer email banner and sender preferences saved for future alerts.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The email preferences could not be saved.');
    }
  };
  const submitReceiptPreference = async () => {
    setError('');
    setMessage('');
    if (!canSaveReceiptPreference(sessionToken, !!status.data?.accessActive)) {
      setError('Active Private Vault access is required to save a receipt layout.');
      return;
    }
    try {
      const saved = await saveReceiptPreference.mutateAsync({
        data: { preferredReceiptTemplate },
      });
      queryClient.setQueryData(getGetBankVaultReceiptPreferenceQueryKey(), saved);
      setMessage('Receipt layout saved for future transfers. Existing receipts keep their saved design.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The receipt layout could not be saved.');
    }
  };
  const savePrivateTransactionNote = async () => {
    if (
      !sessionToken ||
      !vaultAccessActive ||
      !selectedTransactionId ||
      !privateNoteDraft.trim()
    ) return;
    setError('');
    setMessage('');
    try {
      await saveTransactionNote.mutateAsync({
        transactionId: selectedTransactionId,
        data: { note: privateNoteDraft.trim() },
      });
      await queryClient.invalidateQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
      setMessage('Private note saved. It does not change the transaction or receipt.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The private note could not be saved.');
    }
  };
  const removePrivateTransactionNote = async () => {
    if (!sessionToken || !vaultAccessActive || !selectedTransactionId || !selectedTransactionNote) return;
    setError('');
    setMessage('');
    try {
      await deleteTransactionNote.mutateAsync({ transactionId: selectedTransactionId });
      await queryClient.invalidateQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
      setPrivateNoteDraft('');
      setMessage('Private note deleted. The transaction record is unchanged.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The private note could not be deleted.');
    }
  };
  const enableBrowserAlerts = async () => {
    setBrowserPushError('');
    setBrowserPushMessage('');
    if (!browserPushSupported) {
      setBrowserPushError('Browser notifications are not supported on this device.');
      return;
    }
    if (!browserPushConfig.data?.configured || !browserPushConfig.data.siteKey) {
      setBrowserPushError('Browser alerts are not available right now.');
      return;
    }
    try {
      let permission = Notification.permission;
      if (permission === 'default') permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setBrowserPushError('Allow notifications in your browser settings, then try again.');
        return;
      }
      const api = await loadWebpushr(browserPushConfig.data.siteKey);
      const subscriberId = await fetchWebpushrSubscriberId(api);
      if (!subscriberId) {
        setBrowserPushMessage('Finish the browser permission prompt, then select Enable alerts again.');
        return;
      }
      const result = await savePushSubscription.mutateAsync({ data: { subscriberId } });
      setSavedPushSubscriptionId(result.id ?? '');
      if (result.id && subscriptionStorageKey) {
        localStorage.setItem(subscriptionStorageKey, result.id);
      }
      setBrowserPushMessage('Browser alerts are enabled on this device.');
      await queryClient.invalidateQueries({ queryKey: getGetBankPushConfigQueryKey() });
    } catch (err) {
      setBrowserPushError(err instanceof Error ? err.message : 'Browser alerts could not be enabled.');
    }
  };
  const disableBrowserAlerts = async () => {
    setBrowserPushError('');
    setBrowserPushMessage('');
    if (!savedPushSubscriptionId) {
      setBrowserPushError('This device alert link could not be found. Enable alerts on this device first.');
      return;
    }
    try {
      await deletePushSubscription.mutateAsync({ subscriptionId: savedPushSubscriptionId });
      setSavedPushSubscriptionId('');
      if (subscriptionStorageKey) localStorage.removeItem(subscriptionStorageKey);
      setBrowserPushMessage('Globus alerts are disconnected for this device.');
      await queryClient.invalidateQueries({ queryKey: getGetBankPushConfigQueryKey() });
    } catch (err) {
      setBrowserPushError(err instanceof Error ? err.message : 'Browser alerts could not be disabled.');
    }
  };
  const updateBrowserAlertCategory = async (
    key: 'transferEnabled' | 'walletEnabled' | 'securityEnabled',
    enabled: boolean,
  ) => {
    setBrowserPushError('');
    setBrowserPushMessage('');
    if (!vaultAccessActive) {
      setBrowserPushError('Active Private Vault access is required to change alert settings.');
      return;
    }
    try {
      const preferences = await updateBrowserPushPreferences.mutateAsync({
        data: { [key]: enabled },
      });
      queryClient.setQueryData(getGetBankPushPreferencesQueryKey(), preferences);
      setBrowserPushMessage('Alert choices saved for all linked devices.');
    } catch (err) {
      setBrowserPushError(err instanceof Error ? err.message : 'Alert choices could not be saved.');
    }
  };
  const changeControl = async (control: BankVaultWalletControl, input: Partial<BankVaultWalletControl>) => {
    if (!sessionToken || !status.data?.accessActive || busyWallet) return;
    setBusyWallet(control.walletId);
    setError('');
    setMessage('');
    try {
      await updateControl.mutateAsync({ walletId: control.walletId, data: input });
      await queryClient.invalidateQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      setMessage(`${control.currency} wallet policy updated. It applies to future requests only.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wallet policy could not be updated.');
    } finally {
      setBusyWallet('');
    }
  };

  const loading = initialize.isPending || unlock.isPending || updatePasscode.isPending;
  const vaultAccessActive = !!status.data?.accessActive;
  const paidSubscriptionActive = !!status.data?.subscriptionActive;
  const checkoutPending = status.data?.paymentStatus === 'pending';
  const vaultHeader = (
    <header className="sticky top-0 z-30 flex min-h-[68px] items-center justify-between gap-2 border-b border-[#e1e8eb] bg-white/95 px-3 py-3 backdrop-blur sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        {vaultSessionActive && <button type="button" aria-label="Open Vault workspace navigation" aria-expanded={mobileNavigationOpen} aria-controls="vault-workspace-mobile-navigation" onClick={() => setMobileNavigationOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#dfe7eb] bg-white text-[#29465d] hover:bg-[#f4f8f9] lg:hidden" data-testid="button-vault-navigation"><Menu size={17} /></button>}
        <div className="min-w-0">
          <p className="text-[8px] font-bold uppercase tracking-[.16em] text-[#56878a]">Globus Bank · Customer workspace</p>
          <h1 className="truncate text-[14px] font-bold text-[#233c54] sm:text-[16px]">Private Vault</h1>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <span className="hidden max-w-[180px] truncate pr-1 text-right text-[9px] font-medium text-[#708397] sm:block">{user?.firstName ? `Welcome, ${user.firstName}` : 'Secure account workspace'}</span>
        <Link href="/dashboard" aria-label="Return to dashboard" data-testid="link-vault-dashboard" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#d6e8e9] bg-white px-2 text-[9px] font-bold text-[#377d83] hover:bg-[#eff8f8] sm:px-3 sm:text-[10px]">
          <LayoutDashboard size={14} /><span className="hidden sm:inline">Dashboard</span>
        </Link>
        <Link href="/profile" aria-label="Open profile" data-testid="link-vault-profile" className="grid h-9 w-9 place-items-center rounded-lg border border-[#d6e8e9] bg-white text-[#377d83] hover:bg-[#eff8f8]">
          <UserRound size={15} />
        </Link>
      </div>
    </header>
  );
  const servicePages = [
    { path: '/private-vault', label: 'Overview', page: 'overview' },
    { path: '/private-vault/subscription', label: 'Subscription', page: 'subscription' },
    { path: '/private-vault/funding', label: 'Funding', page: 'funding' },
    { path: '/private-vault/activity', label: 'Activity', page: 'activity' },
    { path: '/private-vault/receipts', label: 'Receipts', page: 'receipts' },
    { path: '/private-vault/wallet-controls', label: 'Wallet controls', page: 'wallet-controls' },
    { path: '/private-vault/security', label: 'Security', page: 'security' },
    { path: '/private-vault/alerts', label: 'Alerts', page: 'alerts' },
    { path: '/private-vault/notes', label: 'Notes', page: 'notes' },
    { path: '/private-vault/email-preferences', label: 'Email preferences', page: 'email-preferences' },
  ];
  const serviceNavigation = (
    <nav aria-label="Private Vault pages" data-testid="vault-page-navigation" className="vault-page-navigation flex min-w-0 gap-1 overflow-x-auto border-b border-[#e1e8eb] bg-[#f8faf9] px-3 py-2 sm:px-5">
      {servicePages.map(page => (
        <Link key={page.path} href={page.path} aria-current={location === page.path ? 'page' : undefined} data-testid={`link-vault-page-${page.page}`} className={`shrink-0 rounded-full border px-3 py-2 text-[9px] font-bold transition ${location === page.path ? 'border-[#54898b] bg-[#eaf4f2] text-[#315f63]' : 'border-transparent text-[#708397] hover:border-[#dce6e7] hover:bg-white hover:text-[#35536a]'}`}>
          {page.label}
        </Link>
      ))}
    </nav>
  );

  if (!vaultSessionActive) {
    return (
      <section className="min-h-dvh min-w-0 bg-[#f5f8fa]" data-testid="private-vault-panel">
        {vaultHeader}
        {serviceNavigation}
        <main className="mx-auto flex min-h-[calc(100dvh-68px)] w-full max-w-[760px] items-center justify-center px-4 py-8 sm:px-6">
          <section className="w-full rounded-[20px] border border-[#dce5e8] bg-white p-5 shadow-[0_14px_40px_rgba(21,48,71,.08)] sm:p-8" data-testid="vault-unlock-gate">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eef6f6] text-[#43888e]"><LockKeyhole size={20} /></span>
            <h2 className="mt-4 text-[18px] font-bold tracking-[-.02em] text-[#233c54] sm:text-[20px]">
              {status.data?.configured ? 'Unlock your Private Vault' : 'Set up your Private Vault'}
            </h2>
            {status.isLoading && <div className="mt-5 h-12 animate-pulse rounded-lg bg-[#f0f4f6]" aria-label="Checking Vault passcode setup" />}
            {status.isError && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#eadfda] bg-[#fff8f6] px-3 py-3 text-[10px] text-[#a24940]" role="alert">
                <span>Vault status is unavailable.</span>
                <button type="button" data-testid="button-retry-vault-status" onClick={() => void status.refetch()} className="font-bold underline">Try again</button>
              </div>
            )}
            {!status.isLoading && !status.isError && status.data?.configured === false && (
              <form onSubmit={submitPasscode} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end" data-testid="form-vault-setup">
                <label className="min-w-0 flex-1 text-[10px] font-bold text-[#5c7085]">Create your Vault passcode
                  <input required pattern="[0-9]{4}" inputMode="numeric" autoComplete="new-password" maxLength={4} value={passcode} onChange={event => setPasscode(event.target.value.replace(/\D/g, '').slice(0, 4))} className={`${fieldClass} mt-1`} data-testid="input-vault-passcode" />
                </label>
                <button type="submit" disabled={loading || passcode.length !== 4} data-testid="button-vault-setup" className="h-9 rounded-lg bg-[#173858] px-4 text-[10px] font-bold text-white disabled:opacity-50">{initialize.isPending ? 'Setting up…' : 'Set up Vault'}</button>
              </form>
            )}
            {!status.isLoading && !status.isError && status.data?.configured === true && (
              <form onSubmit={submitPasscode} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end" data-testid="form-vault-unlock">
                <label className="min-w-0 flex-1 text-[10px] font-bold text-[#5c7085]">
                  <input aria-label="Vault passcode" required pattern="[0-9]{4}" inputMode="numeric" autoComplete="current-password" maxLength={4} value={passcode} onChange={event => setPasscode(event.target.value.replace(/\D/g, '').slice(0, 4))} className={`${fieldClass} mt-1`} data-testid="input-vault-unlock-passcode" />
                </label>
                <button type="submit" disabled={loading || passcode.length !== 4} data-testid="button-vault-unlock" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#173858] px-4 text-[10px] font-bold text-white disabled:opacity-50"><LockKeyhole size={13} />{unlock.isPending ? 'Unlocking…' : 'Unlock Vault'}</button>
              </form>
            )}
            {error && <p role="alert" data-testid="status-vault-unlock-error" className="mt-3 rounded-lg bg-[#fff1ef] px-3 py-2 text-[10px] text-[#a24940]">{error}</p>}
            {message && <p role="status" className="mt-3 rounded-lg bg-[#eef7f1] px-3 py-2 text-[10px] text-[#41755f]">{message}</p>}
          </section>
        </main>
      </section>
    );
  }

  return (
    <>
    <section className="min-h-dvh min-w-0 w-full bg-[#f5f8fa]" data-testid="private-vault-panel">
      {vaultHeader}
      {serviceNavigation}
      <div className="grid min-h-[calc(100dvh-68px)] min-w-0 lg:grid-cols-[204px_minmax(0,1fr)]">
        <aside className="sticky top-[68px] hidden h-[calc(100dvh-68px)] min-h-[440px] flex-col bg-[#173b4b] px-3 py-4 text-white lg:flex">
          <p className="px-2 pb-3 text-[8px] font-bold uppercase tracking-[.16em] text-[#a9c8c0]">Vault workspace</p>
          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Vault workspace navigation">
            {vaultNavigation.map(item => {
              const Icon = item.icon;
              const disabled = !sessionToken && item.requiresUnlock;
              return <button key={item.id} type="button" disabled={disabled} aria-current={activeNavigation === item.id ? 'page' : undefined} title={disabled ? 'Unlock your Vault to open this section' : undefined} onClick={() => navigateToSection(item.id)} className={`flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[9px] font-semibold transition ${activeNavigation === item.id ? 'bg-white/12 text-[#f1dc98]' : 'text-[#d5e2e1] hover:bg-white/[.07]'} disabled:cursor-not-allowed disabled:opacity-45`}><Icon size={14} />{item.label}{disabled && <LockKeyhole size={11} className="ml-auto" />}</button>;
            })}
          </nav>
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[.05] p-2.5 text-[8px] leading-4 text-[#c5d6d2]">
            Wallet policies apply to future requests. Existing ledger activity and receipt details remain unchanged.
          </div>
        </aside>
        <div className="min-w-0 space-y-3 p-3 sm:p-4 vault-page-content" data-vault-page={location.split('/').filter(Boolean).at(-1) ?? 'private-vault'}>
      <section data-vault-view="subscription" className="overflow-hidden rounded-xl border border-[#dce5e8] bg-[#fffefa] shadow-[0_8px_24px_rgba(21,48,71,.05)]" data-testid="vault-subscription-card">
        <div className="flex flex-col gap-3 border-l-[3px] border-[#b99a58] bg-[linear-gradient(115deg,#fffefa,#f5f8f6)] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="text-[8px] font-bold uppercase tracking-[.16em] text-[#8a784c]">Private Vault access</p>
            <h3 className="mt-1 text-[15px] font-bold tracking-[-.025em] text-[#233c54]">
              {status.isLoading ? 'Checking your access' : vaultAccessActive ? 'Your Vault is protected and ready' : 'A private space for your account'}
            </h3>
            <p className="mt-1 max-w-2xl text-[10px] leading-5 text-[#708195]">
              {status.isLoading ? 'Loading subscription details…' : status.isError ? 'Subscription details are temporarily unavailable.' :
                status.data?.accessSource === 'admin_grant' ? 'Access is provided by a Globus administrator grant.' :
                  status.data?.subscriptionActive ? `${status.data.planCode ?? 'Vault'} plan active${status.data.expiresAt ? ` · renews or ends ${new Date(status.data.expiresAt).toLocaleDateString()}` : ''}.` :
                    checkoutPending ? 'Payment is awaiting Paystack verification. Unlock your Vault to confirm payment.' :
                      'Manage your plan, renewals, and secure account tools from one workspace.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {status.data?.autoRenew && sessionToken && <button type="button" disabled={!status.data.renewalManagementReady || billingBusy} onClick={() => void requestRenewalManagementLink()} className="h-9 rounded-lg border border-[#d8e2df] bg-white px-3 text-[9px] font-bold text-[#456b6b] disabled:opacity-50" data-testid="button-vault-renewal-management">
              {emailRenewalManagementLink.isPending ? 'Sending link…' : 'Manage renewal'}
            </button>}
            {!vaultAccessActive && <button type="button" disabled={status.isLoading || status.isError} onClick={() => {
              if (!sessionToken) {
                setMessage('Unlock your Vault first to choose or manage a subscription.');
                navigateToSection('vault-overview');
              } else if (checkoutPending) {
                void checkPaystackPayment();
              } else {
                setError('');
                setMessage('');
                setSubscriptionStep('plans');
                  setLocation('/private-vault/subscription');
              }
            }} data-testid="button-vault-subscription-primary" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#173858] px-4 text-[9px] font-bold text-white transition hover:bg-[#214b70] disabled:opacity-50">
              {sessionToken ? checkoutPending ? 'Verify payment' : 'Choose a plan' : 'Unlock to manage'} <ArrowRight size={13} />
            </button>}
            {vaultAccessActive && <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d7e7dc] bg-[#f1f8f2] px-3 py-2 text-[9px] font-bold text-[#49765f]"><ShieldCheck size={13} /> Access active</span>}
          </div>
        </div>
      </section>
      <div id="vault-overview" data-vault-view="overview" className="scroll-mt-24">
      {status.isLoading ? <div className="h-10 animate-pulse rounded-lg bg-[#f0f4f6]" /> :
        status.isError ? <div className="mt-4 flex items-center justify-between rounded-lg border border-[#eadfda] bg-[#fff8f6] px-3 py-2 text-[10px] text-[#a24940]"><span>Vault status is unavailable.</span><button type="button" data-testid="button-retry-vault-status" onClick={() => void status.refetch()} className="font-bold underline">Try again</button></div> :
          !status.data?.configured ? (
            <form onSubmit={submitPasscode} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end" data-testid="form-vault-setup">
              <label className="min-w-0 flex-1 text-[9px] font-bold text-[#5c7085]">Create your Vault passcode
                <input required pattern="[0-9]{4}" inputMode="numeric" autoComplete="new-password" maxLength={4} value={passcode} onChange={event => setPasscode(event.target.value.replace(/\D/g, '').slice(0, 4))} className={`${fieldClass} mt-1`} data-testid="input-vault-passcode" />
              </label>
              <button type="submit" disabled={loading || passcode.length !== 4} data-testid="button-vault-setup" className="h-9 rounded-lg bg-[#173858] px-4 text-[10px] font-bold text-white disabled:opacity-50">{initialize.isPending ? 'Setting up…' : 'Set up vault'}</button>
            </form>
          ) : !sessionToken ? (
            <form onSubmit={submitPasscode} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end" data-testid="form-vault-unlock">
                <label className="min-w-0 flex-1 text-[9px] font-bold text-[#5c7085]">
                <input aria-label="Vault passcode" required pattern="[0-9]{4}" inputMode="numeric" autoComplete="current-password" maxLength={4} value={passcode} onChange={event => setPasscode(event.target.value.replace(/\D/g, '').slice(0, 4))} className={`${fieldClass} mt-1`} data-testid="input-vault-unlock-passcode" />
              </label>
              <button type="submit" disabled={loading || passcode.length !== 4} data-testid="button-vault-unlock" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#173858] px-4 text-[10px] font-bold text-white disabled:opacity-50"><LockKeyhole size={13} />{unlock.isPending ? 'Unlocking…' : 'Unlock vault'}</button>
            </form>
          ) : (
            <div id="vault-workspace-layout" className="mt-4 min-w-0 space-y-3" data-testid="vault-workspace-layout">
      <section id="vault-workspace-overview" data-vault-view="overview" className="scroll-mt-4 space-y-3">
              <div data-vault-view="overview" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d9e8e9] bg-[#f3f8f8] px-3 py-2">
                <p className="text-[10px] font-semibold text-[#426e70]" data-testid="status-vault-unlocked">
                  {status.data?.accessSource === 'admin_grant'
                    ? 'Vault unlocked · Admin-granted access'
                    : paidSubscriptionActive
                      ? 'Vault unlocked · paid subscription active'
                      : 'Vault unlocked · read-only'}
                  {expiresAt ? ` · session ends ${new Date(expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
                  {status.data?.subscriptionActive && status.data?.expiresAt ? ` · plan ends ${new Date(status.data.expiresAt).toLocaleDateString()}` : ''}
                </p>
                <button type="button" disabled={updatePasscode.isPending || updateControl.isPending || billingBusy} data-testid="button-vault-lock" onClick={lockVault} className="rounded-md border border-[#d4e1e4] bg-white px-3 py-1.5 text-[9px] font-bold text-[#466577] disabled:opacity-50">Lock vault</button>
              </div>
              <div data-vault-view="overview" className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="vault-overview-actions" aria-label="Vault overview actions">
                {([
                  ['vault-workspace-funding', 'Add funds', WalletCards],
                  ['vault-activity', 'Activity', FileText],
                  ['vault-receipts', 'Receipt style', ReceiptText],
                  ['vault-workspace-wallets', 'Wallet controls', ShieldCheck],
                ] as const).map(([target, label, Icon]) => (
                  <button key={target} type="button" onClick={() => navigateToSection(target)} data-testid={`button-vault-overview-${target}`} className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[#d9e4e7] bg-white px-2 py-2 text-[9px] font-bold text-[#42687a] transition hover:border-[#a9c8c9] hover:bg-[#f4f9f9] sm:text-[10px]">
                    <Icon size={13} className="shrink-0" /><span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
              <div id="vault-workspace-funding" data-vault-view="funding" className="scroll-mt-4">
                <VaultFundingForm vaultAccessActive={!!status.data?.accessActive} />
              </div>
              {status.data?.autoRenew && <div data-vault-view="subscription" className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d9e8e9] bg-white px-3 py-2" data-testid="vault-auto-renew-status">
                <p className="text-[9px] leading-4 text-[#426e70]">Paystack automatic renewal is on. You can request a management link to update or cancel it.</p>
                <button type="button" disabled={!status.data.renewalManagementReady || billingBusy} onClick={() => void requestRenewalManagementLink()} className="h-8 rounded-lg border border-[#b9d2d0] px-3 text-[9px] font-bold text-[#397b80] disabled:opacity-50">
                  {emailRenewalManagementLink.isPending ? 'Sending…' : 'Email management link'}
                </button>
              </div>}

              {!paidSubscriptionActive && subscriptionStep !== 'closed' && <section data-vault-view="subscription" className="mt-3 rounded-xl border border-[#e8e1cc] bg-[#fbf8ef] p-4" data-testid="vault-subscription-access">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8a784c]">Vault subscription · {status.data?.subscriptionStatus || 'inactive'}</p>
                    <p className="mt-1 text-[10px] leading-5 text-[#786e55]">
                      {status.data?.accessSource === 'admin_grant'
                        ? 'Your current Vault access is an administrator grant, not a paid subscription. You can choose a paid plan if you want subscription-based access.'
                        : checkoutPending
                        ? 'Paystack checkout is in progress. Complete payment, then verify it here to activate your plan.'
                        : status.data?.subscriptionStatus === 'rejected'
                          ? 'Your previous request was declined. You can choose a plan and pay securely.'
                          : status.data?.subscriptionStatus === 'expired'
                            ? 'Your subscription has expired. Choose a plan to renew Vault access.'
                            : 'Choose a plan and complete checkout. Vault access unlocks after payment is verified.'}
                    </p>
                  </div>
                </div>

                {checkoutPending && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e8dfc5] bg-white/75 p-3">
                  <div className="min-w-0 text-[9px] leading-4 text-[#786e55]">
                    <p className="font-bold">Payment reference</p>
                    <p className="truncate font-mono">{status.data?.paymentReference}</p>
                  </div>
                  <button type="button" disabled={isVerifyingPayment} onClick={() => void checkPaystackPayment()} data-testid="button-vault-verify-payment" className="h-8 rounded-lg bg-[#173858] px-3 text-[9px] font-bold text-white disabled:opacity-50">{isVerifyingPayment ? 'Checking…' : 'Verify payment'}</button>
                </div>}
                {checkoutPending ? null : billing.isLoading ? <div className="mt-3 h-12 animate-pulse rounded-lg bg-white/70" /> :
                  billing.isError ? <div className="mt-3 flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-[9px] text-[#a24940]"><span>Subscription payment options could not be loaded.</span><button type="button" onClick={() => void billing.refetch()} className="font-bold underline">Retry</button></div> :
                    billing.data && <>
                      {!billing.data.configured && <p className="mt-3 rounded-lg border border-[#e8dfc5] bg-white/75 p-3 text-[9px] leading-4 text-[#786e55]">Paystack checkout is currently unavailable. Try again later; Vault access can only activate after Paystack confirms payment.</p>}

                      {subscriptionStep === 'plans' && <div className="mt-4" data-testid="vault-subscription-plans">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-[10px] font-bold text-[#6c6249]">Choose your access plan</h3>
                          <button type="button" onClick={() => setSubscriptionStep('closed')} className="text-[9px] font-semibold text-[#75816c]">Cancel</button>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {billing.data.plans.map(plan => <button key={plan.code} type="button" disabled={!billing.data.configured} onClick={() => { setSelectedPlan(plan.code as VaultPlanCode); setAutoRenew(false); setMessage(''); setError(''); setSubscriptionStep('payment'); }} data-testid={`button-vault-plan-${plan.code}`} className="rounded-lg border border-[#e5dec9] bg-white/80 p-3 text-left transition hover:border-[#43888e] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                            <span className="block text-[9px] font-semibold text-[#7d7358]">{plan.label}</span>
                            <strong className="mt-1 block text-[12px] text-[#334f5b]">{ngnMinor(plan.priceMinor)}</strong>
                            <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold text-[#397b80]">Choose plan <ArrowRight size={11} /></span>
                          </button>)}
                        </div>
                      </div>}

                       {subscriptionStep === 'payment' && billing.data.provider === 'paystack' && (() => {
                        const plan = billing.data.plans.find(item => item.code === selectedPlan);
                        if (!plan) return null;
                          return <div className="mt-4 space-y-3" data-testid="vault-subscription-payment">
                             <button type="button" onClick={() => setSubscriptionStep('plans')} className="inline-flex items-center gap-1.5 text-[9px] font-bold text-[#397b80]"><ArrowLeft size={12} /> Back to plans</button>
                             <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e8dfc5] bg-white/80 p-3">
                               <div><p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#8a784c]">Paystack checkout</p><p className="mt-1 text-[11px] font-bold text-[#334f5b]">{plan.label}</p></div>
                               <strong className="text-[13px] text-[#334f5b]">{ngnMinor(plan.priceMinor)}</strong>
                             </div>
                              {(selectedPlan === '1m' || selectedPlan === '1y') && billing.data.recurringEnabled && <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#dbe7e8] bg-[#f4f9f8] p-3 text-[9px] leading-4 text-[#476a70]" data-testid="vault-auto-renew-choice">
                                <input type="checkbox" checked={autoRenew} onChange={event => setAutoRenew(event.currentTarget.checked)} className="mt-0.5 accent-[#367b7b]" />
                                <span><strong className="block text-[#315d63]">Automatically renew this plan</strong>{selectedPlan === '1m' ? 'Paystack will charge the same amount monthly until you cancel.' : 'Paystack will charge the same amount annually until you cancel.'} You can request a management link from this page.</span>
                              </label>}
                              {(selectedPlan === '1m' || selectedPlan === '1y') && !billing.data.recurringEnabled && <p className="rounded-lg border border-[#e8dfc5] bg-[#fffdf8] p-3 text-[9px] leading-4 text-[#786e55]">Automatic renewal will appear here after Globus configures the Paystack webhook. This checkout is currently one-time.</p>}
                              {selectedPlan === '3m' && <p className="rounded-lg border border-[#e8dfc5] bg-[#fffdf8] p-3 text-[9px] leading-4 text-[#786e55]">This three-month option is one-time only; Paystack does not list a quarterly renewal interval.</p>}
                             <p className="text-[9px] leading-4 text-[#786e55]">Payment is initialized and verified on the Globus server. Vault access activates only after Paystack confirms the exact plan amount and currency.</p>
                             <button type="button" disabled={billingBusy || !billing.data.configured} onClick={() => void startPaystackCheckout()} data-testid="button-vault-paystack-checkout" className="h-9 rounded-lg bg-[#173858] px-4 text-[10px] font-bold text-white disabled:opacity-50">{initializePaystackPayment.isPending ? 'Preparing checkout…' : 'Continue to Paystack'}</button>
                          </div>;
                      })()}
                    </>}
              </section>}
              </section>

              <div id="vault-account-controls" data-vault-view="wallet-controls" className="mt-3 scroll-mt-24 grid gap-3 lg:grid-cols-[.75fr_1.25fr]">
                {vaultAccessActive ? <form onSubmit={changeVaultPasscode} data-vault-view="security" className="rounded-xl border border-[#e7ecef] p-3" data-testid="form-vault-change-passcode">
                  <h3 className="text-[10px] font-bold text-[#344b64]">Change passcode</h3>
                  <label className="mt-2 block text-[9px] font-semibold text-[#667a8d]">New four-digit passcode
                    <input required pattern="[0-9]{4}" inputMode="numeric" autoComplete="new-password" maxLength={4} value={newPasscode} onChange={event => setNewPasscode(event.target.value.replace(/\D/g, '').slice(0, 4))} className={`${fieldClass} mt-1`} data-testid="input-vault-new-passcode" />
                  </label>
                  <button type="submit" disabled={loading || newPasscode.length !== 4} data-testid="button-vault-change-passcode" className="mt-2 h-8 rounded-lg border border-[#dfe6eb] px-3 text-[9px] font-bold text-[#405a73] disabled:opacity-50">{updatePasscode.isPending ? 'Updating…' : 'Update passcode'}</button>
                </form> : <div data-vault-view="security" className="rounded-xl border border-[#e7ecef] bg-[#f8fafb] p-3"><h3 className="text-[10px] font-bold text-[#344b64]">Vault settings are read-only</h3><p className="mt-1 text-[9px] leading-4 text-[#8190a0]">Active Private Vault access is required to change the passcode or wallet and email settings.</p></div>}
                <div id="vault-workspace-wallets" data-vault-view="wallet-policies" className="scroll-mt-4 rounded-xl border border-[#e7ecef] p-3">
                  <div className="flex items-center justify-between gap-2"><h3 className="text-[10px] font-bold text-[#344b64]">Wallet policies</h3><button type="button" disabled={!vaultAccessActive} onClick={() => void controls.refetch()} data-testid="button-refresh-wallet-controls" className="text-[9px] font-bold text-[#397b80] disabled:cursor-not-allowed disabled:opacity-50">Refresh</button></div>
                  <p className="mt-1 text-[9px] leading-4 text-[#8190a0]">Policy choices apply to future requests only. Existing transactions keep their recorded status.</p>
                  <p className="mt-1 text-[9px] leading-4 text-[#8190a0]">Add funds above; withdrawal requests remain on their dedicated page. Subscription, wallet, and account restrictions still apply.</p>
                  {!vaultAccessActive ? <p role="status" className="mt-2 rounded-lg border border-dashed border-[#dfe6eb] p-3 text-center text-[9px] text-[#8492a1]">Activate Private Vault access to view wallet policies.</p> :
                    controls.isLoading ? <div className="mt-2 h-10 animate-pulse rounded-lg bg-[#f0f4f6]" /> : controls.isError ? <p role="alert" className="mt-2 text-[9px] text-[#a24940]">Wallet policies could not be loaded. Refresh to try again.</p> : controls.data?.length ? (
                    <div className="mt-2 space-y-2">{controls.data.map(control => <article key={control.walletId} data-testid={`vault-wallet-control-${control.walletId}`} className="rounded-lg bg-[#f8fafb] p-2.5">
                      <div className="flex items-center justify-between gap-2"><strong className="text-[10px] text-[#324962]">{control.currency} wallet</strong><label className="flex items-center gap-1.5 text-[8px] text-[#64798d]"><input type="checkbox" checked={control.transfersEnabled} disabled={!vaultAccessActive || busyWallet === control.walletId} onChange={event => void changeControl(control, { transfersEnabled: event.target.checked })} data-testid={`toggle-vault-transfers-${control.walletId}`} />Transfers</label></div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-1.5 text-[8px] text-[#64798d]"><input type="checkbox" checked={control.depositsEnabled} disabled={!vaultAccessActive || busyWallet === control.walletId} onChange={event => void changeControl(control, { depositsEnabled: event.target.checked })} data-testid={`toggle-vault-deposits-${control.walletId}`} />Deposits</label>
                        <label className="flex items-center gap-1.5 text-[8px] text-[#64798d]"><input type="checkbox" checked={control.withdrawalsEnabled} disabled={!vaultAccessActive || busyWallet === control.walletId} onChange={event => void changeControl(control, { withdrawalsEnabled: event.target.checked })} data-testid={`toggle-vault-withdrawals-${control.walletId}`} />Withdrawals</label>
                      </div>
                      <label className="mt-2 flex items-center gap-2 text-[8px] font-semibold text-[#64798d]">Future transfer requests
                        <select value={control.futureTransferMode} disabled={!vaultAccessActive || busyWallet === control.walletId} onChange={event => void changeControl(control, { futureTransferMode: event.target.value as BankVaultWalletControl['futureTransferMode'] })} className="h-7 flex-1 rounded-md border border-[#dfe6eb] bg-white px-2 text-[9px]" data-testid={`select-vault-future-transfer-mode-${control.walletId}`}>
                          <option value="successful">Successful</option><option value="pending">Pending</option><option value="failed">Failed</option>
                        </select>
                      </label>
                      {busyWallet === control.walletId && <p role="status" className="mt-1 text-[8px] text-[#55868b]">Saving wallet policy…</p>}
                    </article>)}</div>
                  ) : <p className="mt-2 rounded-lg border border-dashed border-[#dfe6eb] p-3 text-center text-[9px] text-[#8492a1]">No wallet controls are available.</p>}
                </div>
              </div>
              <details id="vault-browser-alerts" open={location === '/private-vault/alerts'} data-vault-view="alerts" className="mt-3 scroll-mt-24 rounded-xl border border-[#e7ecef] bg-[#fbfcfd] p-3" data-testid="vault-browser-alert-settings">
                <summary className="cursor-pointer text-[10px] font-bold text-[#344b64]">Browser alerts</summary>
                <p className="mt-2 text-[9px] leading-4 text-[#8190a0]">Choose which account alerts can reach linked devices. In-app notifications remain available in the notification center.</p>
                {browserPushConfig.isError && <p role="alert" className="mt-2 text-[9px] text-[#a24940]">Browser alert setup is unavailable. Try again later.</p>}
                {browserPushPreferences.isLoading ? <div className="mt-2 h-8 animate-pulse rounded-lg bg-[#f0f4f6]" /> :
                  browserPushPreferences.isError ? <p role="alert" className="mt-2 text-[9px] text-[#a24940]">Alert choices could not be loaded.</p> :
                    <fieldset disabled={!vaultAccessActive || updateBrowserPushPreferences.isPending} className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                      <legend className="sr-only">Push alert categories</legend>
                      {([
                        ['transferEnabled', 'Transfers'],
                        ['walletEnabled', 'Wallet activity'],
                        ['securityEnabled', 'Security'],
                      ] as const).map(([key, label]) => <label key={key} className="flex min-w-0 items-center gap-2 rounded-lg border border-[#e4eaee] bg-white px-3 py-2 text-[9px] font-medium text-[#62788c]">
                        <input type="checkbox" checked={browserPushPreferences.data?.[key] ?? false} onChange={event => void updateBrowserAlertCategory(key, event.currentTarget.checked)} data-testid={`vault-toggle-push-${key}`} className="accent-[#438481]" />
                        <span>{label}</span>
                      </label>)}
                    </fieldset>}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span data-testid="status-vault-browser-push" className="text-[8px] text-[#8794a2]">
                    {browserPushConfig.isLoading ? 'Checking availability…' : !browserPushSupported ? 'Not supported on this device' : browserPushConfig.data?.configured ? savedPushSubscriptionId ? 'This device is linked' : 'Available to enable on this device' : 'Not configured'}
                  </span>
                  {savedPushSubscriptionId ? <button type="button" disabled={!vaultAccessActive || deletePushSubscription.isPending} onClick={() => void disableBrowserAlerts()} data-testid="button-vault-disable-browser-push" className="h-8 rounded-lg border border-[#dfe6eb] bg-white px-3 text-[9px] font-bold text-[#52697e] disabled:opacity-50">{deletePushSubscription.isPending ? 'Disabling…' : 'Disable alerts on this device'}</button> :
                    <button type="button" disabled={!vaultAccessActive || !browserPushSupported || !browserPushConfig.data?.configured || savePushSubscription.isPending} onClick={() => void enableBrowserAlerts()} data-testid="button-vault-enable-browser-push" className="h-8 rounded-lg bg-[#173858] px-3 text-[9px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{savePushSubscription.isPending ? 'Linking…' : 'Enable alerts on this device'}</button>}
                </div>
                {browserPushError && <p role="alert" data-testid="status-vault-browser-push-error" className="mt-2 rounded-md bg-[#fff1ef] px-2 py-1.5 text-[8px] text-[#a24940]">{browserPushError}</p>}
                {browserPushMessage && <p role="status" data-testid="status-vault-browser-push-message" className="mt-2 rounded-md bg-[#eef7f1] px-2 py-1.5 text-[8px] text-[#41755f]">{browserPushMessage}</p>}
              </details>
              <details id="vault-personal-notes" open={location === '/private-vault/notes'} data-vault-view="notes" className="mt-3 scroll-mt-24 rounded-xl border border-[#e7ecef] bg-[#fbfcfd] p-3" data-testid="vault-personal-transaction-notes">
                <summary className="cursor-pointer text-[10px] font-bold text-[#344b64]">Personal transaction notes</summary>
                <p className="mt-2 text-[9px] leading-4 text-[#8190a0]">These notes are private to your Vault. They never change balances, official transaction details, receipts, or notifications.</p>
                {!vaultAccessActive && <p className="mt-2 text-[9px] font-semibold text-[#8a784c]">Activate Private Vault access to load personal notes.</p>}
                {!vaultAccessActive ? null : transactions.isLoading || transactionNotes.isLoading ? <div className="mt-2 h-10 animate-pulse rounded-lg bg-[#f0f4f6]" /> :
                  transactions.isError || transactionNotes.isError ? <div className="mt-2 rounded-lg border border-[#eadfda] bg-[#fff8f6] p-3 text-[9px] text-[#a24940]"><p>Transaction notes could not be loaded.</p><button type="button" onClick={() => { void transactions.refetch(); void transactionNotes.refetch(); }} className="mt-1 font-bold underline">Try again</button></div> :
                    !transactions.data?.length ? <p className="mt-2 rounded-lg border border-dashed border-[#dfe6eb] p-3 text-center text-[9px] text-[#8492a1]">Your transactions will appear here when available.</p> :
                      <div className="mt-3 grid gap-2">
                        <label className="text-[9px] font-semibold text-[#5c7085]">Choose a transaction
                          <select value={selectedTransactionId} onChange={event => setSelectedTransactionId(event.target.value)} className={`${fieldClass} mt-1`} data-testid="select-private-note-transaction">
                            {transactions.data.map((transaction: BankTransaction) => <option key={transaction.id} value={transaction.id}>
                              {`${customerTransactionDate(transaction.transactionDate, transaction.createdAt)} · ${transaction.currency} ${transaction.amount} · ${transaction.reference}`}
                            </option>)}
                          </select>
                        </label>
                        {selectedTransactionId && <>
                          <label className="text-[9px] font-semibold text-[#5c7085]">Your private note
                            <textarea disabled={!vaultAccessActive} maxLength={500} rows={3} value={privateNoteDraft} onChange={event => setPrivateNoteDraft(event.target.value)} placeholder="Add a reminder for yourself" className="mt-1 w-full resize-y rounded-lg border border-[#dfe6eb] bg-white px-3 py-2 text-[10px] leading-4 text-[#344b64] outline-none focus:border-[#77aeb0] disabled:bg-[#f3f5f5]" data-testid="input-private-transaction-note" />
                            <span className="mt-1 block text-right text-[8px] font-normal text-[#8794a2]">{privateNoteDraft.length}/500</span>
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {vaultAccessActive && <button type="button" disabled={saveTransactionNote.isPending || deleteTransactionNote.isPending || !privateNoteDraft.trim()} onClick={() => void savePrivateTransactionNote()} data-testid="button-save-private-transaction-note" className="h-8 rounded-lg bg-[#173858] px-3 text-[9px] font-bold text-white disabled:opacity-50">{saveTransactionNote.isPending ? 'Saving…' : 'Save private note'}</button>}
                            {vaultAccessActive && selectedTransactionNote && <button type="button" disabled={saveTransactionNote.isPending || deleteTransactionNote.isPending} onClick={() => void removePrivateTransactionNote()} data-testid="button-delete-private-transaction-note" className="h-8 rounded-lg border border-[#dfe6eb] bg-white px-3 text-[9px] font-bold text-[#6b7888] disabled:opacity-50">{deleteTransactionNote.isPending ? 'Deleting…' : 'Delete note'}</button>}
                          </div>
                        </>}
                      </div>}
              </details>
              <details id="vault-email-preferences" open={location === '/private-vault/email-preferences'} data-vault-view="email-preferences" className="mt-3 scroll-mt-24 rounded-xl border border-[#e7ecef] bg-[#fbfcfd] p-3" data-testid="vault-email-banner-settings">
                <summary className="cursor-pointer text-[10px] font-bold text-[#344b64]">Transaction email banner</summary>
                <p className="mt-2 text-[9px] leading-4 text-[#8190a0]">Choose whether to email recipients, then customize the banner and optional support footer link.</p>
                {!vaultAccessActive ? <p role="status" className="mt-2 text-[9px] font-semibold text-[#8a784c]">Activate Private Vault access to load these settings.</p> :
                  emailPreferences.isLoading ? <div className="mt-2 h-8 animate-pulse rounded-lg bg-[#f0f4f6]" /> : emailPreferences.isError ? <p role="alert" className="mt-2 text-[9px] text-[#a24940]">Email alert settings could not be loaded.</p> : <form onSubmit={submitEmailPreferences} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex items-start gap-2 rounded-lg border border-[#e4eaee] bg-white px-3 py-2 text-[9px] leading-4 text-[#64798d] sm:col-span-2">
                    <input disabled={!vaultAccessActive} type="checkbox" checked={transactionEmailAlertsEnabled} onChange={event => setTransactionEmailAlertsEnabled(event.currentTarget.checked)} className="mt-0.5 accent-[#438481]" data-testid="toggle-vault-transaction-email-alerts" />
                    <span><strong className="text-[#344b64]">Send recipient transaction email alerts.</strong> When off, the recipient email field is hidden from the transfer form and no recipient email is stored or sent.</span>
                  </label>
                  <label className="text-[9px] font-semibold text-[#5c7085]">Banner color
                    <select disabled={!vaultAccessActive} value={bannerTheme} onChange={event => setBannerTheme(event.target.value as BankVaultEmailPreferences['bannerTheme'])} className={`${fieldClass} mt-1 disabled:bg-[#f3f5f5]`} data-testid="select-vault-email-banner-theme">
                      <option value="navy">Globus navy</option><option value="teal">Globus teal</option><option value="gold">Globus gold</option>
                    </select>
                  </label>
                  <label className="text-[9px] font-semibold text-[#5c7085]">Banner headline
                    <input disabled={!vaultAccessActive} required maxLength={60} value={bannerHeadline} onChange={event => setBannerHeadline(event.target.value)} className={`${fieldClass} mt-1 disabled:bg-[#f3f5f5]`} data-testid="input-vault-email-banner-headline" />
                  </label>
                  <label className="text-[9px] font-semibold text-[#5c7085] sm:col-span-2">Customer sender address
                    <span className="mt-1 flex h-9 items-center overflow-hidden rounded-lg border border-[#dfe6eb] bg-white focus-within:border-[#77aeb0]">
                      <input disabled={!vaultAccessActive} maxLength={64} pattern="[A-Za-z0-9](?:[A-Za-z0-9._-]{0,62}[A-Za-z0-9])?" value={senderLocalPart} onChange={event => setSenderLocalPart(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="choose-a-prefix" className="h-full min-w-0 flex-1 bg-transparent px-3 text-[10px] text-[#344b64] outline-none disabled:bg-[#f3f5f5]" data-testid="input-vault-email-sender-prefix" />
                      <span className="shrink-0 pr-3 text-[9px] font-medium text-[#8190a0]">@{emailPreferences.data?.senderDomain ?? 'globus.website'}</span>
                    </span>
                    <span className="mt-1 block text-[8px] font-normal leading-4 text-[#8794a2]">Recipients see “{emailPreferences.data?.senderDisplayName ?? 'GLOBUS BANK'}”. The domain and display name are fixed; this sender identity applies only to transfer alerts.</span>
                  </label>
                  <label className="text-[9px] font-semibold text-[#5c7085]">Custom banner background
                    <span className="mt-1 flex h-9 items-center gap-2 rounded-lg border border-[#dfe6eb] bg-white px-2">
                      <input disabled={!vaultAccessActive} type="color" value={bannerBackgroundColor} onChange={event => setBannerBackgroundColor(event.target.value)} className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed" aria-label="Choose email banner background color" data-testid="input-vault-email-banner-background-color" />
                      <span className="font-mono text-[9px] font-normal uppercase text-[#687d90]">{bannerBackgroundColor}</span>
                    </span>
                  </label>
                  <div aria-label="Email banner preview" data-testid="preview-vault-email-banner" className="overflow-hidden rounded-lg border border-[#e2e8eb] sm:col-span-2">
                    <div className="px-4 py-3" style={{ backgroundColor: bannerBackgroundColor, color: bannerForeground(bannerBackgroundColor) }}>
                      <p className="text-[10px] font-extrabold tracking-[.12em]">GLOBUS <span className="text-[#d6b45e]">BANK</span></p>
                      <p className="mt-1 text-[10px] font-semibold">{bannerHeadline || 'A Globus transfer notice'}</p>
                    </div>
                    <div className="bg-white px-4 py-2 text-[9px] text-[#526b7e]">Transfer update · transaction details</div>
                    {includeSupportLink && supportUrl.trim() && <div className="border-t border-[#e7ecee] bg-white px-4 py-2 text-center text-[9px] font-bold text-[#356e75]">{supportLabel.trim() || 'Contact support'}</div>}
                  </div>
                  <label className="text-[9px] font-semibold text-[#5c7085]">Footer link label
                    <input disabled={!vaultAccessActive} required maxLength={40} value={supportLabel} onChange={event => setSupportLabel(event.target.value)} placeholder="Contact support" className={`${fieldClass} mt-1 disabled:bg-[#f3f5f5]`} data-testid="input-vault-email-support-label" />
                    <span className="mt-1 block text-[8px] font-normal text-[#8794a2]">This text appears as the clickable footer link when enabled.</span>
                  </label>
                  <label className="text-[9px] font-semibold text-[#5c7085] sm:col-span-2">Support contact URL
                    <input disabled={!vaultAccessActive} type="url" maxLength={500} value={supportUrl} onChange={event => setSupportUrl(event.target.value)} placeholder="https://support.example.com" className={`${fieldClass} mt-1 disabled:bg-[#f3f5f5]`} data-testid="input-vault-email-support-url" />
                    <span className="mt-1 block text-[8px] font-normal text-[#8794a2]">Use an HTTPS link. It appears with your footer label only when enabled below.</span>
                  </label>
                  <label className="flex items-start gap-2 text-[9px] leading-4 text-[#64798d] sm:col-span-2">
                    <input disabled={!vaultAccessActive} type="checkbox" checked={includeSupportLink} onChange={event => setIncludeSupportLink(event.target.checked)} className="mt-0.5 accent-[#438481]" data-testid="toggle-vault-email-support-link" />
                    <span>Include my support contact link in future recipient alert email footers.</span>
                  </label>
                  {vaultAccessActive && <button type="submit" disabled={saveEmailPreferences.isPending || !bannerHeadline.trim() || !supportLabel.trim() || (includeSupportLink && !supportUrl.trim())} data-testid="button-save-vault-email-banner" className="h-8 justify-self-start rounded-lg bg-[#173858] px-3 text-[9px] font-bold text-white disabled:opacity-50 sm:col-span-2">{saveEmailPreferences.isPending ? 'Saving…' : 'Save email design'}</button>}
                </form>}
              </details>
            </div>
          )}
      </div>
      <section id="vault-activity" data-vault-view="activity" className="scroll-mt-24 rounded-xl border border-[#e1e8ee] bg-white p-3 sm:p-4" data-testid="vault-transaction-history">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#56878a]">Account activity</p><h3 className="mt-1 text-[12px] font-bold text-[#29425c]">Transactions & receipts</h3><p className="mt-1 text-[9px] text-[#77889a]">Open a customer receipt using your saved layout.</p></div>
          {sessionToken && transactions.data?.[0] && <button type="button" onClick={() => setReceiptPreview(transactions.data![0])} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dfe7eb] px-3 text-[9px] font-bold text-[#42687a] hover:bg-[#f5f8f9]" data-testid="button-preview-latest-receipt"><ReceiptText size={13} /> Latest receipt</button>}
        </div>
        {!sessionToken ? <div className="mt-3 rounded-lg border border-dashed border-[#dfe6eb] bg-[#f8fafb] px-3 py-4 text-center text-[9px] text-[#7c8c9b]"><LockKeyhole size={15} className="mx-auto mb-1 text-[#6a8a91]" />Unlock your Vault to view private transaction history.</div> :
          transactions.isLoading ? <div className="mt-3 h-12 animate-pulse rounded-lg bg-[#f0f4f6]" /> :
            transactions.isError ? <div className="mt-3 flex items-center justify-between rounded-lg border border-[#eadfda] bg-[#fff8f6] px-3 py-2 text-[9px] text-[#a24940]"><span>Transaction history could not be loaded.</span><button type="button" onClick={() => void transactions.refetch()} className="font-bold underline">Try again</button></div> :
              !transactions.data?.length ? <p className="mt-3 rounded-lg border border-dashed border-[#dfe6eb] p-4 text-center text-[9px] text-[#8492a1]">Your transactions will appear here when available.</p> :
                <div className="mt-3 divide-y divide-[#edf0f2]">
                  {transactions.data.slice(0, 12).map(transaction => <div key={transaction.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2.5" data-testid={`vault-transaction-${transaction.id}`}>
                    <div className="min-w-0"><p className="truncate text-[9px] font-semibold text-[#364e66]">{transaction.description || transaction.type.replaceAll('_', ' ')}</p><p className="mt-0.5 truncate font-mono text-[8px] text-[#8794a2]">{transaction.reference} · {customerTransactionDate(transaction.transactionDate, transaction.createdAt)}</p></div>
                    <div className="flex shrink-0 items-center gap-2"><span className="text-[9px] font-bold text-[#3d596c]">{transaction.currency} {transaction.amount}</span><button type="button" onClick={() => setReceiptPreview(transaction)} className="inline-flex h-7 items-center gap-1 rounded-md border border-[#dfe7eb] px-2 text-[8px] font-bold text-[#42687a] hover:bg-[#f5f8f9]" aria-label={`Open receipt ${transaction.reference}`} data-testid={`button-vault-receipt-${transaction.id}`}><ReceiptText size={11} />Receipt</button></div>
                  </div>)}
                </div>}
      </section>
      <section id="vault-receipts" data-vault-view="receipts" className="scroll-mt-24 rounded-xl border border-[#dce6e8] bg-white p-3 sm:p-4" data-testid="vault-receipt-preferences">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#56878a]">Receipt preferences</p><h3 className="mt-1 text-[12px] font-bold text-[#29425c]">Choose your transaction receipt</h3><p className="mt-1 max-w-xl text-[9px] leading-4 text-[#77889a]">Compare all eleven layouts before you decide. Your choice is a local preview until saved; existing receipts keep their recorded design.</p></div>
          <span className="rounded-full bg-[#eef6f6] px-2.5 py-1 text-[8px] font-bold text-[#4a7c7e]">All customer receipts</span>
        </div>
        {!transactions.data?.length && <p role="note" data-testid="status-receipt-illustrative-notice" className="mt-3 rounded-lg border border-[#dfe8e5] bg-[#f5f8f5] px-3 py-2 text-[9px] leading-4 text-[#60786e]">Illustrative sample data is shown in previews until a transaction can be safely loaded from your unlocked Vault. It is not saved or used for account activity.</p>}
        {!vaultAccessActive && <p role="status" className="mt-3 rounded-lg border border-[#e8e1cc] bg-[#fbf8ef] px-3 py-2 text-[9px] text-[#806f43]">Active Private Vault access is required to update your preferred receipt design.</p>}
        {receiptPreference.isLoading && <div className="mt-3 h-10 animate-pulse rounded-lg bg-[#f0f4f6]" />}
        {receiptPreference.isError && <div role="alert" className="mt-3 flex items-center justify-between rounded-lg border border-[#eadfda] bg-[#fff8f6] px-3 py-2 text-[9px] text-[#a24940]"><span>Receipt preferences could not be loaded.</span><button type="button" onClick={() => void receiptPreference.refetch()} className="font-bold underline">Try again</button></div>}
        <div role="radiogroup" aria-label="Preferred transaction receipt layout" className="vault-receipt-carousel mt-3 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {RECEIPT_LAYOUTS.map(layout => <article key={layout.id} className={`w-[min(88vw,430px)] shrink-0 snap-start rounded-xl border p-3 ${preferredReceiptTemplate === layout.id ? 'border-[#4d8b8d] bg-[#f2f8f7] ring-1 ring-[#4d8b8d]/15' : 'border-[#e2e9ec] bg-[#fbfcfd]'}`}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-[10px] font-bold text-[#354c63]">{layout.label}</p><p className="mt-0.5 text-[9px] leading-4 text-[#8090a0]">{layout.summary}</p></div>
              <button type="button" role="radio" aria-label={`Select ${layout.label}`} aria-checked={preferredReceiptTemplate === layout.id} aria-pressed={preferredReceiptTemplate === layout.id} onClick={() => setPreferredReceiptTemplate(layout.id)} className={`shrink-0 rounded-full border px-2.5 py-1.5 text-[8px] font-bold ${preferredReceiptTemplate === layout.id ? 'border-[#4d8b8d] bg-[#e3f0ed] text-[#315f63]' : 'border-[#dfe7e9] bg-white text-[#698091]'}`} data-testid={`button-receipt-layout-${layout.id}`}>{preferredReceiptTemplate === layout.id ? 'Selected' : 'Select'}</button>
            </div>
            <TransferReceiptPreview transaction={buildReceiptLayoutPreview(privateVaultDataEnabled ? transactions.data?.[0] : undefined, layout.id).transaction} />
            <button type="button" onClick={() => {
              setPreferredReceiptTemplate(layout.id);
              const preview = buildReceiptLayoutPreview(
                privateVaultDataEnabled ? transactions.data?.[0] : undefined,
                layout.id,
              );
              setReceiptPreview(preview.transaction);
              setReceiptPreviewIsIllustrative(preview.illustrativeOnly);
            }} data-testid={`button-open-full-receipt-${layout.id}`} className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#d8e4e6] bg-white px-3 text-[9px] font-bold text-[#42687a] hover:bg-[#f5f8f9]">
              <ReceiptText size={13} /> Open full receipt
            </button>
          </article>)}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0f2] pt-3">
          <p className="text-[8px] text-[#8391a0]">{privateVaultDataEnabled && receiptPreference.data ? `Saved layout: ${RECEIPT_LAYOUTS.find(layout => layout.id === receiptPreference.data?.preferredReceiptTemplate)?.label ?? 'Classic receipt'}` : 'Your selection is a local preview until saved with active Vault access.'}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={openSelectedReceiptPreview} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dfe7eb] bg-white px-3 text-[9px] font-bold text-[#42687a] hover:bg-[#f5f8f9]" data-testid="button-preview-selected-receipt"><ReceiptText size={12} /> Preview selected layout</button>
            <button type="button" disabled={!canSaveReceiptPreference(sessionToken, vaultAccessActive) || saveReceiptPreference.isPending || receiptPreference.isLoading || preferredReceiptTemplate === receiptPreference.data?.preferredReceiptTemplate} onClick={() => void submitReceiptPreference()} className="h-8 rounded-lg bg-[#173858] px-3 text-[9px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45" data-testid="button-save-receipt-preference">{saveReceiptPreference.isPending ? 'Saving…' : 'Save preferred layout'}</button>
          </div>
        </div>
      </section>
      {(error || updateControl.isError) && <p role="alert" data-testid="status-vault-error" className="mt-3 rounded-lg bg-[#fff1ef] px-3 py-2 text-[9px] text-[#a24940]">{error || 'A wallet policy could not be saved.'}</p>}
      {message && <p role="status" data-testid="status-vault-message" className="mt-3 rounded-lg bg-[#f0f8f4] px-3 py-2 text-[9px] text-[#41755f]">{message}</p>}
        </div>
      </div>
      {mobileNavigationOpen && <div className="fixed inset-0 z-[60] lg:hidden">
        <button type="button" aria-label="Close Vault navigation overlay" className="absolute inset-0 bg-[#0b1b2d]/55" onClick={() => setMobileNavigationOpen(false)} />
        <aside id="vault-workspace-mobile-navigation" role="dialog" aria-modal="true" aria-labelledby="vault-mobile-navigation-title" className="absolute inset-y-0 left-0 flex w-[min(290px,86vw)] flex-col bg-[#173b4b] p-4 text-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4"><div><p className="text-[8px] font-bold uppercase tracking-[.15em] text-[#a9c8c0]">Globus Bank</p><h3 id="vault-mobile-navigation-title" className="mt-1 text-[13px] font-bold">Vault workspace</h3></div><button type="button" aria-label="Close Vault navigation" onClick={() => setMobileNavigationOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-[#d5e2e1] hover:bg-white/10"><X size={16} /></button></div>
          <nav className="mt-4 space-y-1" aria-label="Vault workspace navigation">
            {vaultNavigation.map(item => {
              const Icon = item.icon;
              const disabled = !sessionToken && item.requiresUnlock;
              return <button key={item.id} type="button" disabled={disabled} aria-current={activeNavigation === item.id ? 'page' : undefined} onClick={() => navigateToSection(item.id)} className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[10px] font-semibold ${activeNavigation === item.id ? 'bg-white/12 text-[#f1dc98]' : 'text-[#d5e2e1] hover:bg-white/[.07]'} disabled:cursor-not-allowed disabled:opacity-45`}><Icon size={15} />{item.label}{disabled && <LockKeyhole size={11} className="ml-auto" />}</button>;
            })}
          </nav>
          <p className="mt-auto rounded-lg border border-white/10 bg-white/[.05] p-3 text-[8px] leading-4 text-[#c5d6d2]">Customer receipt facts are always taken from Globus account records.</p>
        </aside>
      </div>}
    </section>
    {receiptPreview && <TransferReceiptModal transaction={receiptPreview} onClose={() => { setReceiptPreview(null); setReceiptPreviewIsIllustrative(false); }} title={receiptPreviewIsIllustrative ? 'Illustrative sample · layout preview' : receiptPreview.type.replaceAll('_', ' ')} notice={receiptPreviewIsIllustrative ? 'Illustrative preview only. This sample is not a real transaction; exports and printing are disabled.' : undefined} illustrativeOnly={receiptPreviewIsIllustrative} />}
    </>
  );
}
