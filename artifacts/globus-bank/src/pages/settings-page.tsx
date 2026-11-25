import { Link } from 'wouter';
import { useEffect, useState } from 'react';
import { useClerk, useUser } from '@clerk/react';
import {
  ArrowRight, Bell, Check, ChevronRight, Globe2, HelpCircle, KeyRound,
  LockKeyhole, LogOut, Monitor, ShieldCheck, Smartphone, UserRound,
} from 'lucide-react';
import { AppLanguageSelector } from '@/components/app-language-selector';
import { InstallAppButton } from '@/components/pwa-install-prompt';
import { useLanguage } from '@/lib/i18n';

type SettingsCategory = 'account' | 'security' | 'preferences' | 'notifications' | 'help';
type NotificationPreferences = {
  email: boolean;
  sms: boolean;
  inApp: boolean;
  security: boolean;
  transactions: boolean;
  productUpdates: boolean;
};

const notificationDefaults: NotificationPreferences = {
  email: true,
  sms: true,
  inApp: true,
  security: true,
  transactions: true,
  productUpdates: false,
};
const notificationStorageKey = 'globus-member-notification-preferences';

export function SettingsPage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('account');
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(notificationDefaults);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const email = user?.primaryEmailAddress?.emailAddress ?? 'Email not available';
  const displayName = user?.fullName || user?.username || 'Globus member';
  const initials = (user?.firstName?.[0] ?? email[0] ?? 'G').toUpperCase();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(notificationStorageKey);
      if (stored) setNotificationPreferences({ ...notificationDefaults, ...JSON.parse(stored) });
    } catch {
      // Keep safe defaults if browser storage is unavailable or invalid.
    }
    setPreferencesLoaded(true);
  }, []);

  const updateNotification = (key: keyof NotificationPreferences, value: boolean) => {
    setNotificationPreferences(current => {
      const next = { ...current, [key]: value };
      try { window.localStorage.setItem(notificationStorageKey, JSON.stringify(next)); } catch {
        // State remains active for this session if storage is unavailable.
      }
      return next;
    });
  };

  const categories = [
    { id: 'account', label: 'Account', detail: 'Profile and account details', icon: UserRound },
    { id: 'security', label: 'Security & access', detail: 'Password and Private Vault', icon: ShieldCheck },
    { id: 'preferences', label: 'Preferences', detail: 'Language and display', icon: Monitor },
    { id: 'notifications', label: 'Notifications', detail: 'Delivery and alert choices', icon: Bell },
    { id: 'help', label: 'Help & support', detail: 'Get assistance', icon: HelpCircle },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[1120px] pb-12">
      <header className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#438187]">{t('ACCOUNT')}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#19334f] sm:text-3xl">{t('Settings')}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#718196]">{t('Manage your profile, account security and app preferences.')}</p>
      </header>

      <section className="mb-5 rounded-2xl border border-[#dfe7ed] bg-white p-4 shadow-[0_6px_22px_rgba(20,47,81,.04)] sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e7f0f2] text-lg font-bold text-[#214a61]">
            {user?.imageUrl ? <img src={user.imageUrl} alt="" className="h-full w-full object-cover" /> : initials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-[#203a55]">{displayName}</h2>
            <p className="mt-1 truncate text-xs text-[#7b8a9b]">{email}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#438187]">{t('GLOBUS BANK MEMBER')}</p>
          </div>
          <Link href="/profile" className="inline-flex items-center gap-2 rounded-lg border border-[#dce6ec] px-3.5 py-2.5 text-xs font-semibold text-[#315b70] transition hover:bg-[#f4f8fa]">{t('View profile')} <ArrowRight size={14} /></Link>
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[245px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[#dfe7ed] bg-white p-2.5 shadow-[0_5px_18px_rgba(20,47,81,.035)]">
          <p className="px-3 pb-2 pt-1 text-[9px] font-bold uppercase tracking-[.16em] text-[#8393a2]">Settings navigation</p>
          <nav aria-label="Settings categories" className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
            {categories.map(item => {
              const Icon = item.icon;
              const selected = activeCategory === item.id;
              return (
                <button key={item.id} type="button" onClick={() => setActiveCategory(item.id)} aria-current={selected ? 'page' : undefined}
                  className={`flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-3 text-left transition ${selected ? 'bg-[#e8f3ef] text-[#245e5b] ring-1 ring-inset ring-[#d5e8df]' : 'text-[#526b7b] hover:bg-[#f5f8fa]'}`}>
                  <Icon size={17} className="shrink-0" />
                  <span className="min-w-0 flex-1"><span className="block text-[10px] font-bold">{t(item.label)}</span><span className="mt-0.5 hidden truncate text-[8px] opacity-75 sm:block">{t(item.detail)}</span></span>
                  <ChevronRight size={13} className="hidden shrink-0 lg:block" />
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 space-y-4">
          {activeCategory === 'account' && <>
            <SettingsPanel title="Personal information" description="Review your identity and customer profile." icon={UserRound}>
              <SettingsLink href="/profile" icon={UserRound} title="Personal information" description="Review your name, contact details and customer profile." />
              <SettingsLink href="/dashboard" icon={Globe2} title="Account overview" description="Return to your account balances and activity." />
            </SettingsPanel>
            <SettingsPanel title="Account profile" description="Your signed-in Globus Bank identity." icon={Globe2}>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <ProfileValue label="Full name" value={displayName} />
                <ProfileValue label="Email address" value={email} />
                <ProfileValue label="Membership" value="GLOBUS BANK MEMBER" />
                <ProfileValue label="Identity provider" value="Clerk secure sign-in" />
              </div>
            </SettingsPanel>
          </>}

          {activeCategory === 'security' && <>
            <SettingsPanel title="Security & access" description="Keep your account and Private Vault protected." icon={ShieldCheck}>
              <SettingsLink href="/sign-in/email" icon={KeyRound} title="Account password" description="Open the secure account password recovery flow." />
              <SettingsLink href="/private-vault/reset-passcode" icon={LockKeyhole} title="Private Vault PIN" description="Update or reset your Vault PIN after Clerk email OTP and account identity verification." />
            </SettingsPanel>
            <div className="rounded-xl border border-[#e2e9ee] bg-[#f7fafb] p-4 text-xs leading-5 text-[#718196]">
              Your sign-in credentials and identity verification are handled through the secure authentication provider. Private Vault PIN changes use the dedicated verified reset flow.
            </div>
          </>}

          {activeCategory === 'preferences' && <>
            <SettingsPanel title="App preferences" description="Personalize how Globus Bank appears and works on this device." icon={Monitor}>
              <div className="flex flex-wrap items-center gap-3 border-b border-[#edf1f4] px-4 py-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef5f5] text-[#397a80]"><Globe2 size={17} /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#29445e]">{t('Language')}</p><p className="mt-1 text-xs text-[#8290a0]">{t('Set your preferred display language.')}</p></div>
                <AppLanguageSelector />
              </div>
              <div className="flex flex-wrap items-center gap-3 px-4 py-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef5f5] text-[#397a80]"><Smartphone size={17} /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#29445e]">{t('Mobile app')}</p><p className="mt-1 text-xs text-[#8290a0]">{t('Install Globus Bank on your device.')}</p></div>
                <InstallAppButton className="rounded-lg border border-[#dce6ec] bg-white px-3 py-2 text-xs font-semibold text-[#315b70] hover:bg-[#f4f8fa]" />
              </div>
            </SettingsPanel>
          </>}

          {activeCategory === 'notifications' && <>
            <SettingsPanel title="Notification preferences" description="Choose the updates you want to see and the channels available on this device." icon={Bell}>
              <div className="grid gap-4 p-4 xl:grid-cols-2">
                <section className="min-w-0 space-y-2.5">
                  <div className="border-b border-[#edf1f4] pb-2"><h3 className="text-[10px] font-bold uppercase tracking-[.13em] text-[#52757b]">Delivery channels</h3><p className="mt-1 text-[10px] text-[#8290a0]">Where optional notices may appear</p></div>
                  <PreferenceToggle title="Email notifications" description="Account updates and optional notices by email." checked={notificationPreferences.email} disabled={!preferencesLoaded} onChange={v => updateNotification('email',v)} />
                  <PreferenceToggle title="SMS notifications" description="Optional service notices by text message." checked={notificationPreferences.sms} disabled={!preferencesLoaded} onChange={v => updateNotification('sms',v)} />
                  <PreferenceToggle title="In-app notifications" description="Show optional updates inside your Globus workspace." checked={notificationPreferences.inApp} disabled={!preferencesLoaded} onChange={v => updateNotification('inApp',v)} />
                </section>
                <section className="min-w-0 space-y-2.5">
                  <div className="border-b border-[#edf1f4] pb-2"><h3 className="text-[10px] font-bold uppercase tracking-[.13em] text-[#52757b]">Notification types</h3><p className="mt-1 text-[10px] text-[#8290a0]">Choose the optional categories you prefer</p></div>
                  <PreferenceToggle title="Security notices" description="Sign-in and account-security information." checked={notificationPreferences.security} disabled={!preferencesLoaded} onChange={v => updateNotification('security',v)} />
                  <PreferenceToggle title="Transaction updates" description="Non-mandatory transaction and activity updates." checked={notificationPreferences.transactions} disabled={!preferencesLoaded} onChange={v => updateNotification('transactions',v)} />
                  <PreferenceToggle title="Product and service updates" description="New features and general service announcements." checked={notificationPreferences.productUpdates} disabled={!preferencesLoaded} onChange={v => updateNotification('productUpdates',v)} />
                </section>
              </div>
              <div className="flex items-center gap-2 border-t border-[#edf1f4] bg-[#f8fafb] px-4 py-3 text-[10px] text-[#718196]"><Check size={14} className="shrink-0 text-[#3d8a72]" /> Preferences are saved on this device automatically.</div>
            </SettingsPanel>
            <p className="rounded-xl border border-[#e3eaf0] bg-[#f7fafb] p-3 text-[10px] leading-5 text-[#718196]">These controls store local display preferences only. They do not change server-side email or SMS delivery, mandatory security alerts, payment confirmations, or regulatory notices.</p>
          </>}

          {activeCategory === 'help' && <>
            <SettingsPanel title="Help & support" description="Get help with your Globus Bank account." icon={HelpCircle}>
              <SettingsLink href="/support" icon={HelpCircle} title="Contact support" description="Send a message to the Globus support team." />
              <SettingsLink href="/notifications" icon={Bell} title="Notification centre" description="Review account updates and recent alerts." />
            </SettingsPanel>
          </>}
        </main>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-[#f0deda] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <div><h2 className="text-sm font-semibold text-[#7b3e3a]">{t('Sign out')}</h2><p className="mt-1 text-xs text-[#8994a1]">{t('End your current session on this device.')}</p></div>
          <button type="button" onClick={() => void signOut({ redirectUrl: import.meta.env.BASE_URL })} className="inline-flex items-center gap-2 rounded-lg border border-[#eed9d5] px-4 py-2.5 text-xs font-semibold text-[#9b514a] transition hover:bg-[#fff7f5]"><LogOut size={15} /> {t('Sign out')}</button>
        </div>
      </section>
    </div>
  );
}

function SettingsPanel({ title, description, icon: Icon, children }: { title: string; description: string; icon: typeof ShieldCheck; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#dfe7ed] bg-white shadow-[0_6px_22px_rgba(20,47,81,.035)]">
      <header className="flex items-center gap-3 border-b border-[#edf1f4] px-4 py-4 sm:px-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef5f5] text-[#397a80]"><Icon size={17} /></span>
        <div><h2 className="text-sm font-semibold text-[#29445e]">{title}</h2><p className="mt-1 text-[11px] text-[#8290a0]">{description}</p></div>
      </header>
      {children}
    </section>
  );
}

function SettingsLink({ href, icon: Icon, title, description }: { href: string; icon: typeof ShieldCheck; title: string; description: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 border-b border-[#edf1f4] px-4 py-4 last:border-b-0 transition hover:bg-[#f8fafb]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f2f6f8] text-[#547187]"><Icon size={17} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#29445e]">{title}</span><span className="mt-1 block text-xs leading-5 text-[#8290a0]">{description}</span></span>
      <ChevronRight size={16} className="shrink-0 text-[#9aa8b4] transition group-hover:translate-x-0.5 group-hover:text-[#397a80]" />
    </Link>
  );
}

function ProfileValue({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#8290a0]">{label}</p><p className="mt-1 break-words text-xs font-semibold text-[#29445e]">{value}</p></div>;
}

function PreferenceToggle({ title, description, checked, disabled, onChange }: { title: string; description: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#e1e8ee] bg-white p-3">
      <div className="min-w-0"><p className="text-[11px] font-semibold text-[#29445e]">{title}</p><p className="mt-1 text-[9px] leading-4 text-[#8290a0]">{description}</p></div>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? 'bg-[#39877b]' : 'bg-[#cbd5dc]'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} /></button>
    </div>
  );
}
