import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  ShieldCheck,
  KeyRound,
  KeySquare,
  TerminalSquare,
  FileLock2,
  LifeBuoy,
  FolderLock,
  Settings,
  Search,
  PlayCircle,
  LogOut,
  Users,
  ScrollText,
  Building2,
  ChevronsUpDown,
  Check,
  Mailbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/auth';
import { useAppMode } from '@/stores/app-mode';
import { useSearch } from '@/stores/search';
import { useOrgs } from '@/stores/org';
import { useOrg, type Capability } from '@/hooks/useOrg';
import { InviteAccept } from '@/components/InviteAccept';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { CredentialsPage } from '@/pages/CredentialsPage';
import { EnvFilesPage } from '@/pages/EnvFilesPage';
import { BackupCodesPage } from '@/pages/BackupCodesPage';
import { ApiKeysPage } from '@/pages/ApiKeysPage';
import { AccessKeysPage } from '@/pages/AccessKeysPage';
import { SshKeysPage } from '@/pages/SshKeysPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TeamPage } from '@/pages/TeamPage';
import { AuditPage } from '@/pages/AuditPage';
import { OrgSettingsPage } from '@/pages/OrgSettingsPage';

type PageId =
  | 'dashboard'
  | 'projects'
  | 'credentials'
  | 'env'
  | 'backup'
  | 'api-keys'
  | 'access-keys'
  | 'ssh-keys'
  | 'team'
  | 'audit'
  | 'organization'
  | 'settings';

interface NavItem {
  id: PageId;
  label: string;
  icon: typeof KeyRound;
  placeholder: string;
  /** Hides the entry unless the caller's role in the active org allows it. */
  capability?: Capability;
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, placeholder: 'Search vault…' },
  { id: 'projects', label: 'Projects', icon: FolderLock, placeholder: 'Search projects…' },
  { id: 'credentials', label: 'Credentials', icon: KeyRound, placeholder: 'Search credentials…' },
  { id: 'env', label: 'Env Files', icon: FileLock2, placeholder: 'Search env files…' },
  { id: 'backup', label: 'Backup Codes', icon: LifeBuoy, placeholder: 'Search platforms…' },
  { id: 'api-keys', label: 'API Keys', icon: ShieldCheck, placeholder: 'Search API keys…' },
  { id: 'access-keys', label: 'Access Keys', icon: KeySquare, placeholder: 'Search access keys…' },
  { id: 'ssh-keys', label: 'SSH Keys', icon: TerminalSquare, placeholder: 'Search SSH keys…' },
];

const TEAM_NAV: NavItem[] = [
  { id: 'team', label: 'Team', icon: Users, placeholder: 'Search members…' },
  {
    id: 'audit',
    label: 'Audit Log',
    icon: ScrollText,
    placeholder: 'Search audit…',
    capability: 'audit:read',
  },
  { id: 'organization', label: 'Organization', icon: Building2, placeholder: '' },
];

const PAGES: Partial<Record<PageId, React.ComponentType>> = {
  projects: ProjectsPage,
  credentials: CredentialsPage,
  env: EnvFilesPage,
  backup: BackupCodesPage,
  'api-keys': ApiKeysPage,
  'access-keys': AccessKeysPage,
  'ssh-keys': SshKeysPage,
  team: TeamPage,
  audit: AuditPage,
  organization: OrgSettingsPage,
  settings: SettingsPage,
};

/**
 * Switches the active organization. Each one has its own key, so switching also
 * changes which DEK the vault pages encrypt and decrypt with.
 */
function OrgSwitcher({ onRedeemInvite }: { onRedeemInvite: () => void }) {
  const orgs = useOrgs((s) => s.orgs);
  const activeOrgId = useOrgs((s) => s.activeOrgId);
  const lockedOrgIds = useOrgs((s) => s.lockedOrgIds);
  const setActiveOrg = useOrgs((s) => s.setActive);
  const [open, setOpen] = useState(false);

  const active = orgs.find((o) => o.id === activeOrgId);
  if (!active) return null;

  return (
    <div className="sidebar-org-switcher relative mb-3">
      <p className="sidebar-org-label telemetry-label mb-2 px-1">Active organization</p>
      <button
        onClick={() => setOpen((v) => !v)}
        className="sidebar-org-button shell-search no-drag flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2.5 text-left transition-transform hover:-translate-y-px"
        aria-expanded={open}
        aria-haspopup="menu"
        title={active.name}
      >
        <Building2 className="h-4 w-4 shrink-0" style={{ color: 'var(--color-accent)' }} />
        <span className="sidebar-org-name min-w-0 flex-1 truncate text-sm font-medium">{active.name}</span>
        <ChevronsUpDown className="sidebar-org-chevron h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-fg-muted)' }} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              role="menu"
              className="alloy-popover absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-[var(--radius-lg)] p-1"
            >
              {orgs.map((org) => {
                // A pending org cannot be opened yet, so it lists but does not
                // switch — selecting it would 403 on every vault request.
                const pending = org.status === 'pending_key';
                return (
                  <button
                    key={org.id}
                    disabled={pending}
                    title={pending ? 'Waiting for an admin to grant you the key' : undefined}
                    onClick={() => {
                      if (pending) return;
                      setActiveOrg(org.id);
                      setOpen(false);
                    }}
                    className="no-drag flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors enabled:hover:bg-black/5 disabled:cursor-default dark:enabled:hover:bg-white/5"
                    style={{ opacity: pending ? 0.6 : 1 }}
                  >
                    <span className="min-w-0 flex-1 truncate">{org.name}</span>
                    {pending && (
                      <span className="shrink-0 text-[10px]" style={{ color: 'var(--color-warning)' }}>
                        awaiting key
                      </span>
                    )}
                    {!pending && lockedOrgIds.includes(org.id) && (
                      <span className="text-[10px]" style={{ color: 'var(--color-warning)' }}>
                        locked
                      </span>
                    )}
                    {org.id === activeOrgId && (
                      <Check className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-brand-500)' }} />
                    )}
                  </button>
                );
              })}
              <button
                onClick={() => {
                  setOpen(false);
                  onRedeemInvite();
                }}
                className="no-drag mt-1 flex w-full items-center gap-2 border-t px-2.5 py-2 text-left text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}
              >
                <Mailbox className="h-3.5 w-3.5" />
                Join with an invite code
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppShell() {
  const [active, setActive] = useState<PageId>('dashboard');
  const email = useAuth((s) => s.email);
  const logout = useAuth((s) => s.logout);
  const sandbox = useAppMode((s) => s.sandbox);
  const exitSandbox = useAppMode((s) => s.exitSandbox);
  const Page = PAGES[active];
  const { query, setQuery, clear } = useSearch();
  const { can } = useOrg();
  const [redeeming, setRedeeming] = useState(false);

  // Someone who arrived from a join key has already handed us their invitation
  // token; opening the redeem dialog for them beats asking for it a second time
  // when it is sitting in memory.
  const pendingInviteToken = useAuth((s) => s.pendingInviteToken);
  useEffect(() => {
    if (pendingInviteToken) setRedeeming(true);
  }, [pendingInviteToken]);
  const placeholder = useMemo(
    () => [...NAV, ...TEAM_NAV].find((n) => n.id === active)?.placeholder ?? 'Search…',
    [active],
  );
  // Sandbox is a solo demo with no server or org behind it.
  const teamNav = sandbox
    ? []
    : TEAM_NAV.filter((item) => !item.capability || can(item.capability));

  // Reset the filter whenever the user switches pages.
  useEffect(() => {
    clear();
  }, [active, clear]);

  const showSearch =
    active !== 'settings' && active !== 'dashboard' && active !== 'organization' && active !== 'audit';

  return (
    <div className="shell-root flex h-screen w-screen flex-col overflow-hidden">
      {/* Custom titlebar (draggable) — gives the native desktop feel. */}
      <header
        className="shell-titlebar drag-region flex h-12 shrink-0 items-center px-4"
      >
        <div className="flex items-center gap-2">
          <img
            src="/cloak.png"
            alt=""
            className="h-5 w-5 dark:brightness-0 dark:invert"
          />
          <span className="text-sm font-semibold tracking-tight">Cloak</span>
          <span className="telemetry-label ml-2 hidden sm:inline">Secure desktop / online</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {sandbox ? (
            <span
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium"
              style={{ backgroundColor: 'var(--color-accent-soft)', borderColor: 'var(--color-border-soft)', color: 'var(--color-accent)' }}
            >
              <PlayCircle className="h-3 w-3" />
              Sandbox
            </span>
          ) : (
            email && (
              <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                {email}
              </span>
            )
          )}
          <button
            onClick={() => (sandbox ? exitSandbox() : logout())}
            title={sandbox ? 'Exit sandbox' : 'Log out'}
            className="no-drag flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--color-fg-muted)' }}
          >
            <LogOut className="h-3.5 w-3.5" />
            {sandbox ? 'Exit sandbox' : 'Log out'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="shell-sidebar flex w-60 shrink-0 flex-col gap-1 overflow-hidden p-3">
          {!sandbox && <OrgSwitcher onRedeemInvite={() => setRedeeming(true)} />}

          <nav className="flex flex-col gap-0.5">
            {NAV.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={active === item.id}
                onClick={() => setActive(item.id)}
              />
            ))}
          </nav>

          {teamNav.length > 0 && (
          <div className="mt-3 flex flex-col gap-0.5">
            <p className="sidebar-section-label telemetry-label px-3 pb-1">
              Organization
            </p>
            {teamNav.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={active === item.id}
                onClick={() => setActive(item.id)}
              />
            ))}
          </div>
          )}

          <div className="mt-auto">
            <NavButton
              item={{ id: 'settings', label: 'Settings', icon: Settings, placeholder: '' }}
              active={active === 'settings'}
              onClick={() => setActive('settings')}
            />
          </div>
        </aside>

        {/* Content */}
        <main className="shell-content flex min-w-0 flex-1 flex-col">
          {showSearch && (
            <div
              className="flex h-16 shrink-0 items-center gap-3 border-b px-6"
              style={{ borderColor: 'var(--color-border-soft)' }}
            >
              <div
                className="shell-search flex h-9 w-full max-w-md items-center gap-2 rounded-[var(--radius-md)] px-3"
              >
                <Search className="h-4 w-4" style={{ color: 'var(--color-fg-muted)' }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-transparent text-sm outline-none placeholder:opacity-60"
                  style={{ color: 'var(--color-fg)' }}
                />
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                {active === 'dashboard' ? <DashboardPage onNavigate={setActive} /> : Page && <Page />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <InviteAccept
        open={redeeming}
        initialToken={pendingInviteToken}
        onClose={() => {
          setRedeeming(false);
          useAuth.setState({ pendingInviteToken: null });
        }}
      />
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        'sidebar-nav-button no-drag relative flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors',
        active ? 'font-medium' : 'hover:bg-black/5 dark:hover:bg-white/5',
      )}
      style={active ? { color: 'var(--color-fg)' } : { color: 'var(--color-fg-muted)' }}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="nav-active-plate absolute inset-0 rounded-[var(--radius-md)]"
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
      )}
      <Icon className="relative h-4 w-4" strokeWidth={1.9} />
      <span className="sidebar-nav-label relative">{item.label}</span>
    </button>
  );
}
