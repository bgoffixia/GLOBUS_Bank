import {
  Bell,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  ReceiptText,
  WalletCards,
} from 'lucide-react';

const workspaceSections = [
  { id: 'vault-workspace-overview', label: 'Access overview', icon: LayoutDashboard },
  { id: 'vault-workspace-funding', label: 'Wallet funding', icon: WalletCards },
  { id: 'vault-workspace-wallets', label: 'Wallet policies', icon: WalletCards },
  { id: 'vault-workspace-security', label: 'Passcode & security', icon: LockKeyhole },
  { id: 'vault-workspace-alerts', label: 'Browser alerts', icon: Bell },
  { id: 'vault-workspace-notes', label: 'Private notes', icon: FileText },
  { id: 'vault-workspace-receipts', label: 'Transfer receipts', icon: ReceiptText },
  { id: 'vault-workspace-email', label: 'Email design', icon: Mail },
] as const;

export function VaultWorkspaceNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav
      aria-label="Vault workspace sections"
      data-testid="vault-workspace-navigation"
      className="space-y-1"
    >
      {workspaceSections.map(({ id, label, icon: Icon }) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={onNavigate}
          data-testid={`vault-workspace-link-${id}`}
          className="group flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-semibold text-[#5b7185] transition hover:bg-[#edf5f5] hover:text-[#317a7d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#77aeb0]"
        >
          <Icon size={14} className="shrink-0 text-[#57868a]" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span aria-hidden="true" className="text-[#9aa9b4] transition group-hover:translate-x-0.5">›</span>
        </a>
      ))}
    </nav>
  );
}
