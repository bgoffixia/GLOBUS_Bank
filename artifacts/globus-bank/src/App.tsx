import { useEffect, useRef, type ReactNode } from 'react';
import { ClerkProvider, Show, useAuth, useClerk, useUser } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { BankShell } from '@/components/bank-shell';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthFrame, ClerkSignInForm, ClerkSignUpForm, EmailRecoverySignInForm, PendingSignupProfilePersistence } from '@/components/auth-pages';
import { PasswordResetLinkPage, RequiredPasswordResetPage } from '@/components/auth-pages';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { GlobusLoader } from '@/components/globus-loader';
import { NeonAuthStagingApp } from '@/components/neon-auth-staging';
import NotFound from '@/pages/not-found';
import {
  DashboardPage,
  DisclosurePage,
  HomePage,
  InternationalTransferPage,
  ProviderRequestPage,
  ProfilePage,
  PrivateVaultPage,
  TransactionsPage,
  WalletsPage,
  WalletDetailsPage,
} from '@/pages/bank-pages';
import { CurrencyCalculatorPage } from '@/pages/currency-calculator-page';
import { PersonalFinancePage } from '@/pages/personal-finance/personal-finance';
import { useLanguage } from '@/lib/i18n';
import { AdminWorkspace } from '@/pages/admin-workspace';
import { PrivateVaultPasscodeResetPage } from '@/pages/private-vault-passcode-reset-page';
import { SettingsPage } from '@/pages/settings-page';
import { CustomerSupportPage } from '@/components/support-messaging';
import { TransferInquiryPage } from '@/components/transfer-inquiry-page';
import {
  Redirect,
  Route,
  Switch,
  Link,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

// Use the explicitly configured key in preview and production. Host-based
// key discovery can reject isolated Pages preview hostnames and prevent the
// React application from mounting before the landing page is rendered.
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

const isNeonAuthStaging = import.meta.env.VITE_AUTH_PROVIDER === 'neon-staging';

if (!clerkPubKey && !isNeonAuthStaging) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/dutstar-mark.svg`,
  },
  variables: {
    colorPrimary: '#173b62',
    colorForeground: '#203851',
    colorMutedForeground: '#728296',
    colorDanger: '#b64d45',
    colorBackground: '#ffffff',
    colorInput: '#fbfcfd',
    colorInputForeground: '#30465f',
    colorNeutral: '#dfe6ec',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.8rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-transparent rounded-none w-full max-w-[440px] overflow-hidden border-0 shadow-none',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none !p-0',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    header: 'hidden',
    headerTitle: 'font-semibold tracking-tight text-[#18324f]',
    headerSubtitle: 'text-[#718196]',
    formFieldLabel: 'font-semibold text-[#435971]',
    footerActionLink: 'font-semibold text-[#357b83]',
    footerActionText: 'text-[#718196]',
    dividerText: 'text-[#8290a0]',
    identityPreviewEditButton: 'text-[#357b83]',
    formFieldSuccessText: 'text-[#397a62]',
    alertText: 'text-[#a24940]',
    logoBox: 'mb-3',
    logoImage: 'h-auto max-h-12 max-w-[180px]',
    socialButtonsBlock: 'hidden',
    dividerRow: 'hidden',
    socialButtonsBlockButton: 'hidden',
    formButtonPrimary: 'bg-[#173b62] hover:bg-[#214c76] text-white',
    formFieldInput: 'border-[#dfe6ec] bg-[#fbfcfd] text-[#30465f]',
    footerAction: 'text-[#718196]',
    dividerLine: 'bg-[#e4e9ed]',
    alert: 'border-[#efd8d3] bg-[#fff7f5]',
    otpCodeFieldInput: 'border-[#dfe6ec] text-[#30465f]',
    formFieldRow: 'gap-1',
    main: 'gap-5',
  },
};

function HomeRedirect() {
  // The public landing page must not wait for Clerk to finish initializing.
  // Clerk can be delayed by network/proxy checks; gating both branches with
  // <Show> leaves #root empty and makes the site look broken to visitors.
  const { isLoaded, isSignedIn } = useUser();
  if (isLoaded && isSignedIn) return <Redirect to="/dashboard" />;
  return <HomePage />;
}

function PasswordResetGate({ children }: { children: ReactNode }) {
  const { isLoaded, user } = useUser();
  if (!isLoaded) return <GlobusLoader fullScreen />;
  const resetAt = user?.publicMetadata?.globusPasswordResetRequiredAt;
  if (typeof resetAt === 'string' && Number.isFinite(Date.parse(resetAt))) {
    return <RequiredPasswordResetPage />;
  }
  return <>{children}</>;
}

function ProtectedPage({ children }: { children: ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <PasswordResetGate>
          <BankShell>{children}</BankShell>
        </PasswordResetGate>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ProtectedAdminPage() {
  return (
    <>
      <Show when="signed-in">
        <PasswordResetGate>
          <AdminWorkspace />
        </PasswordResetGate>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function SignInPage() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <AuthFrame mode="sign-in">
          <ClerkSignInForm />
        </AuthFrame>
      </Show>
    </>
  );
}

function EmailRecoveryPage() {
  return (
    <AuthFrame mode="sign-in">
      <EmailRecoverySignInForm />
    </AuthFrame>
  );
}

function SignUpPage() {
  return (
    <AuthFrame mode="sign-up">
      <ClerkSignUpForm />
    </AuthFrame>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const currentClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        currentClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, currentClient]);

  return null;
}

function ClerkApiTokenBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setAuthTokenGetter(null);
      return;
    }

    // The DUTSTAR Worker verifies Clerk session JWTs from the Authorization
    // header. Resolve a fresh token for every API request instead of relying
    // on browser cookies, which the Worker does not use for authentication.
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken, isLoaded, isSignedIn]);

  return null;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl || undefined}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: t('Welcome back'),
            subtitle: t('Sign in to access your DUTSTAR workspace'),
          },
        },
        signUp: {
          start: {
            title: t('Set up your account'),
            subtitle: t('Create a secure account to explore DUTSTAR'),
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <ClerkApiTokenBridge />
      <PendingSignupProfilePersistence />
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/home">
          <Show when="signed-in">
            <HomePage />
          </Show>
          <Show when="signed-out">
            <Redirect to="/sign-in" />
          </Show>
        </Route>
        <Route path="/sign-in/email" component={EmailRecoveryPage} />
        <Route path="/sign-in/recover" component={PasswordResetLinkPage} />
        <Route path="/private-vault/reset-passcode" component={PrivateVaultPasscodeResetPage} />
        <Route path="/transfer-inquiries/:token">{(params) => <TransferInquiryPage token={params.token} />}</Route>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/dashboard"><ProtectedPage><DashboardPage /></ProtectedPage></Route>
        <Route path="/financial-overview"><ProtectedPage><PersonalFinancePage /></ProtectedPage></Route>
        <Route path="/notifications"><ProtectedPage><DashboardPage /></ProtectedPage></Route>
        <Route path="/support"><ProtectedPage><CustomerSupportPage /></ProtectedPage></Route>
        <Route path="/wallets"><ProtectedPage><WalletsPage /></ProtectedPage></Route>
        <Route path="/wallets/:walletId"><ProtectedPage><WalletDetailsPage /></ProtectedPage></Route>
        <Route path="/transactions"><ProtectedPage><TransactionsPage /></ProtectedPage></Route>
        <Route path="/calculator"><ProtectedPage><CurrencyCalculatorPage /></ProtectedPage></Route>
        <Route path="/send"><Redirect to="/transfer" /></Route>
        <Route path="/transfer"><ProtectedPage><InternationalTransferPage /></ProtectedPage></Route>
        <Route path="/international-transfer"><ProtectedPage><InternationalTransferPage /></ProtectedPage></Route>
        <Route path="/add-money"><Redirect to="/private-vault" /></Route>
        <Route path="/vault"><Redirect to="/private-vault" /></Route>
        <Route path="/withdraw"><ProtectedPage><ProviderRequestPage type="withdrawal" /></ProtectedPage></Route>
        <Route path="/customer-id"><Redirect to="/profile" /></Route>
        <Route path="/receive"><Redirect to="/profile" /></Route>
        <Route path="/profile"><ProtectedPage><ProfilePage /></ProtectedPage></Route>
        <Route path="/settings"><ProtectedPage><SettingsPage /></ProtectedPage></Route>
        <Route path="/private-vault"><ProtectedPage><PrivateVaultPage /></ProtectedPage></Route>
        <Route path="/private-vault/subscription"><ProtectedPage><PrivateVaultPage /></ProtectedPage></Route>
        <Route path="/private-vault/funding"><ProtectedPage><PrivateVaultPage /></ProtectedPage></Route>
        <Route path="/private-vault/activity"><ProtectedPage><PrivateVaultPage /></ProtectedPage></Route>
        <Route path="/private-vault/receipts"><ProtectedPage><PrivateVaultPage /></ProtectedPage></Route>
        <Route path="/private-vault/wallet-controls"><ProtectedPage><PrivateVaultPage /></ProtectedPage></Route>
        <Route path="/private-vault/security"><ProtectedPage><PrivateVaultPage /></ProtectedPage></Route>
        <Route path="/private-vault/alerts"><ProtectedPage><PrivateVaultPage /></ProtectedPage></Route>
        <Route path="/private-vault/notes"><ProtectedPage><PrivateVaultPage /></ProtectedPage></Route>
        <Route path="/private-vault/email-preferences"><ProtectedPage><PrivateVaultPage /></ProtectedPage></Route>
        <Route path="/private-vault/support"><ProtectedPage><PrivateVaultPage /></ProtectedPage></Route>
        <Route path="/admin/vault-acces"><Redirect to="/admin/vault-access" /></Route>
        <Route path="/admin/vault-access"><ProtectedAdminPage /></Route>
        <Route path="/admin/support"><ProtectedAdminPage /></Route>
        <Route path="/admin/support-settings"><ProtectedAdminPage /></Route>
        <Route path="/admin/users/:userId"><ProtectedAdminPage /></Route>
        <Route path="/admin/users"><ProtectedAdminPage /></Route>
        <Route path="/admin/accounts"><ProtectedAdminPage /></Route>
        <Route path="/admin/transactions"><ProtectedAdminPage /></Route>
        <Route path="/admin/funding"><ProtectedAdminPage /></Route>
        <Route path="/admin/wallets"><ProtectedAdminPage /></Route>
        <Route path="/admin/restrictions"><ProtectedAdminPage /></Route>
        <Route path="/admin/audit"><ProtectedAdminPage /></Route>
        <Route path="/admin/settings"><ProtectedAdminPage /></Route>
        <Route path="/admin/logout"><ProtectedAdminPage /></Route>
        <Route path="/admin"><ProtectedAdminPage /></Route>
        <Route path="/fees"><DisclosurePage path="/fees" /></Route>
        <Route path="/contact"><DisclosurePage path="/contact" /></Route>
        <Route component={NotFound} />
      </Switch>
      <PwaInstallPrompt />
    </ClerkProvider>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  if (isNeonAuthStaging) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <RoutedErrorBoundary>
              <NeonAuthStagingApp />
            </RoutedErrorBoundary>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <RoutedErrorBoundary>
            <ClerkRoutes />
          </RoutedErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
