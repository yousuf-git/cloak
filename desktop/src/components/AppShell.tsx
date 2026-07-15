import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ShieldCheck,
  KeyRound,
  FileLock2,
  LifeBuoy,
  FolderLock,
  Settings,
  Search,
  PlayCircle,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/auth';
import { useAppMode } from '@/stores/app-mode';
import { useSearch } from '@/stores/search';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { CredentialsPage } from '@/pages/CredentialsPage';
import { EnvFilesPage } from '@/pages/EnvFilesPage';
import { BackupCodesPage } from '@/pages/BackupCodesPage';
import { ApiKeysPage } from '@/pages/ApiKeysPage';
import { SettingsPage } from '@/pages/SettingsPage';

type PageId = 'projects' | 'credentials' | 'env' | 'backup' | 'api-keys' | 'settings';

interface NavItem {
  id: PageId;
  label: string;
  icon: typeof KeyRound;
  placeholder: string;
}

const NAV: NavItem[] = [
  { id: 'projects', label: 'Projects', icon: FolderLock, placeholder: 'Search projects…' },
  { id: 'credentials', label: 'Credentials', icon: KeyRound, placeholder: 'Search credentials…' },
  { id: 'env', label: 'Env Files', icon: FileLock2, placeholder: 'Search env files…' },
  { id: 'backup', label: 'Backup Codes', icon: LifeBuoy, placeholder: 'Search platforms…' },
  { id: 'api-keys', label: 'API Keys', icon: ShieldCheck, placeholder: 'Search API keys…' },
];

const PAGES: Record<PageId, React.ComponentType> = {
  projects: ProjectsPage,
  credentials: CredentialsPage,
  env: EnvFilesPage,
  backup: BackupCodesPage,
  'api-keys': ApiKeysPage,
  settings: SettingsPage,
};

export function AppShell() {
  const [active, setActive] = useState<PageId>('projects');
  const email = useAuth((s) => s.email);
  const logout = useAuth((s) => s.logout);
  const sandbox = useAppMode((s) => s.sandbox);
  const exitSandbox = useAppMode((s) => s.exitSandbox);
  const Page = PAGES[active];
  const { query, setQuery, clear } = useSearch();
  const placeholder = useMemo(
    () => NAV.find((n) => n.id === active)?.placeholder ?? 'Search…',
    [active],
  );

  // Reset the filter whenever the user switches pages.
  useEffect(() => {
    clear();
  }, [active, clear]);

  const showSearch = active !== 'settings';

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      {/* Custom titlebar (draggable) — gives the native desktop feel. */}
      <header
        className="drag-region flex h-11 shrink-0 items-center px-4"
        style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <img src="/cloak.png" alt="" className="h-5 w-5" />
          <span className="text-sm font-medium tracking-tight">Cloak</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {sandbox ? (
            <span
              className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-brand-500) 15%, transparent)', color: 'var(--color-brand-600)' }}
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
        <aside
          className="flex w-56 shrink-0 flex-col gap-1 p-3"
          style={{ backgroundColor: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}
        >
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

          <div className="mt-auto">
            <NavButton
              item={{ id: 'settings', label: 'Settings', icon: Settings, placeholder: '' }}
              active={active === 'settings'}
              onClick={() => setActive('settings')}
            />
          </div>
        </aside>

        {/* Content */}
        <main className="flex min-w-0 flex-1 flex-col">
          {showSearch && (
            <div
              className="flex h-14 shrink-0 items-center gap-3 px-6"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <div
                className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg px-3"
                style={{ backgroundColor: 'var(--color-surface-2)' }}
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

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                <Page />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
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
        'no-drag relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        active ? 'font-medium' : 'hover:bg-black/5 dark:hover:bg-white/5',
      )}
      style={active ? { color: 'var(--color-fg)' } : { color: 'var(--color-fg-muted)' }}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-lg"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-brand-500) 14%, transparent)' }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
      )}
      <Icon className="relative h-4 w-4" strokeWidth={1.9} />
      <span className="relative">{item.label}</span>
    </button>
  );
}
