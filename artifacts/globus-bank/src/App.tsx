import { useEffect, useRef, type ReactNode } from 'react';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { BankShell } from '@/components/bank-shell';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthFrame, BankProfileCompletionPage, ClerkSignInForm, EmailRecoverySignInForm } from '@/components/auth-pages';
import { PasswordResetLinkPage, RequiredPasswordResetPage } from '@/components/auth-pages';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { GlobusLoader } from '@/components/globus-loader';
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
import { AdminWorkspace } from '@/pages/admin-workspace';
import {
  Redirect,
  Route,
  Switch,
  Link,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <HomePage />
      </Show>
    </>
  );
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
        <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 p-4">
          <SignIn
            routing="hash"
            signUpUrl={`${basePath}/sign-up`}
            forceRedirectUrl={`${basePath}/dashboard`}
          />
          <p className="text-sm text-muted-foreground">
            Prefer your Globus Customer ID? <Link href="/sign-in/customer-id" className="underline">Use Customer ID sign-in</Link>
          </p>
        </div>
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
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <SignUp
        routing="hash"
        signInUrl={`${basePath}/sign-in`}
        forceRedirectUrl={`${basePath}/complete-profile`}
      />
    </div>
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

function ClerkRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl || undefined}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
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
        <Route path="/sign-in/customer-id"><AuthFrame mode="sign-in"><ClerkSignInForm /></AuthFrame></Route>
        <Route path="/complete-profile"><Show when="signed-in"><BankProfileCompletionPage /></Show><Show when="signed-out"><Redirect to="/sign-in" /></Show></Route>
        <Route path="/sign-in/recover" component={PasswordResetLinkPage} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/dashboard"><ProtectedPage><DashboardPage /></ProtectedPage></Route>
        <Route path="/notifications"><ProtectedPage><DashboardPage /></ProtectedPage></Route>
        <Route path="/wallets"><ProtectedPage><WalletsPage /></ProtectedPage></Route>
        <Route path="/wallets/:walletId"><ProtectedPage><WalletDetailsPage /></ProtectedPage></Route>
        <Route path="/transactions"><ProtectedPage><TransactionsPage /></ProtectedPage></Route>
        <Route path="/calculator"><ProtectedPage><CurrencyCalculatorPage /></ProtectedPage></Route>
        <Route path="/send"><Redirect to="/transfer" /></Route>
        <Route path="/transfer"><ProtectedPage><InternationalTransferPage /></ProtectedPage></Route>
        <Route path="/international-transfer"><ProtectedPage><InternationalTransferPage /></ProtectedPage></Route>
        <Route path="/add-money"><ProtectedPage><ProviderRequestPage type="deposit" /></ProtectedPage></Route>
        <Route path="/withdraw"><ProtectedPage><ProviderRequestPage type="withdrawal" /></ProtectedPage></Route>
        <Route path="/customer-id"><Redirect to="/profile" /></Route>
        <Route path="/receive"><Redirect to="/profile" /></Route>
        <Route path="/profile"><ProtectedPage><ProfilePage /></ProtectedPage></Route>
        <Route path="/private-vault"><ProtectedPage><PrivateVaultPage /></ProtectedPage></Route>
        <Route path="/settings"><Redirect to="/profile" /></Route>
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
        <Route path="/help"><DisclosurePage path="/help" /></Route>
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
