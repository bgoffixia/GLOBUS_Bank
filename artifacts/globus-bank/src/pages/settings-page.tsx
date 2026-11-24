import { Link } from 'wouter';
import type { ReactNode } from 'react';
import { useClerk, useUser } from '@clerk/react';
import { ArrowRight, Bell, ChevronRight, Globe2, HelpCircle, KeyRound, LockKeyhole, LogOut, ShieldCheck, Smartphone, UserRound } from 'lucide-react';
import { AppLanguageSelector } from '@/components/app-language-selector';
import { InstallAppButton } from '@/components/pwa-install-prompt';
import { useLanguage } from '@/lib/i18n';

export function SettingsPage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { t } = useLanguage();
  const email = user?.primaryEmailAddress?.emailAddress ?? 'Email not available';
  const displayName = user?.fullName || user?.username || 'Globus member';
  const initials = (user?.firstName?.[0] ?? email[0] ?? 'G').toUpperCase();

  return (
    <div className="mx-auto w-full max-w-[1080px] pb-12">
      <div className="mb-7">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#438187]">{t('ACCOUNT')}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#19334f] sm:text-3xl">{t('Settings')}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#718196]">{t('Manage your profile, account security and app preferences.')}</p>
      </div>

      <section className="mb-6 rounded-2xl border border-[#e1e8ee] bg-white p-4 shadow-[0_8px_24px_rgba(20,47,81,.04)] sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e7f0f2] text-lg font-bold text-[#214a61]">
            {user?.imageUrl ? <img src={user.imageUrl} alt="" className="h-full w-full object-cover" /> : initials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-[#203a55]">{displayName}</h2>
            <p className="mt-1 truncate text-xs text-[#7b8a9b]">{email}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#438187]">{t('GLOBUS BANK MEMBER')}</p>
          </div>
          <Link href="/profile" className="inline-flex items-center gap-2 rounded-lg border border-[#dce6ec] px-3 py-2 text-xs font-semibold text-[#315b70] transition hover:bg-[#f4f8fa]">{t('View profile')} <ArrowRight size={14} /></Link>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <SettingsGroup title={t('Account')} description={t('Your personal and account information')} icon={UserRound}>
          <SettingsLink href="/profile" icon={UserRound} title={t('Personal information')} description={t('Review your name, contact details and customer profile.')} />
          <SettingsLink href="/dashboard" icon={Globe2} title={t('Account overview')} description={t('Return to your account balances and activity.')} />
        </SettingsGroup>
        <SettingsGroup title={t('Security & access')} description={t('Keep your account and private vault protected')} icon={ShieldCheck}>
          <SettingsLink href="/sign-in/email" icon={KeyRound} title={t('Account password')} description={t('Open the secure account password recovery flow.')} />
          <SettingsLink href="/private-vault/reset-passcode" icon={LockKeyhole} title={t('Private Vault PIN')} description={t('Reset your Vault PIN using your verified email address.')} />
        </SettingsGroup>
        <SettingsGroup title={t('Preferences')} description={t('Choose how you use Globus Bank')} icon={Globe2}>
          <div className="flex items-center gap-3 px-4 py-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef5f5] text-[#397a80]"><Globe2 size={17} /></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#29445e]">{t('Language')}</p><p className="mt-1 text-xs text-[#8290a0]">{t('Set your preferred display language.')}</p></div>
            <AppLanguageSelector />
          </div>
          <div className="flex items-center gap-3 border-t border-[#edf1f4] px-4 py-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef5f5] text-[#397a80]"><Smartphone size={17} /></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#29445e]">{t('Mobile app')}</p><p className="mt-1 text-xs text-[#8290a0]">{t('Install Globus Bank on your device.')}</p></div>
            <InstallAppButton className="rounded-lg border border-[#dce6ec] bg-white px-3 py-2 text-xs font-semibold text-[#315b70] hover:bg-[#f4f8fa]" />
          </div>
        </SettingsGroup>
        <SettingsGroup title={t('Notifications & help')} description={t('Stay informed and get assistance')} icon={Bell}>
          <SettingsLink href="/notifications" icon={Bell} title={t('Notifications')} description={t('View account updates and recent alerts.')} />
          <SettingsLink href="/support" icon={HelpCircle} title={t('Help & support')} description={t('Contact the Globus support team.')} />
        </SettingsGroup>
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

function SettingsGroup({ title, description, icon: Icon, children }: { title: string; description: string; icon: typeof ShieldCheck; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e1e8ee] bg-white shadow-[0_8px_24px_rgba(20,47,81,.035)]">
      <div className="flex items-center gap-3 border-b border-[#edf1f4] px-4 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef5f5] text-[#397a80]"><Icon size={17} /></span>
        <div><h2 className="text-sm font-semibold text-[#29445e]">{title}</h2><p className="mt-1 text-[11px] text-[#8290a0]">{description}</p></div>
      </div>
      <div>{children}</div>
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
