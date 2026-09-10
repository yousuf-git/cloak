import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Splash } from './components/Splash';
import { AppShell } from './components/AppShell';
import { Toaster } from './components/ui/Toaster';
import { AuthScreen } from './components/auth/AuthScreen';
import { OnboardingScreen, needsOnboarding } from './components/auth/OnboardingScreen';
import { useAuth } from './stores/auth';
import { useServers } from './stores/server';
import { useAppMode } from './stores/app-mode';

export function App() {
  const status = useAuth((s) => s.status);
  const boot = useAuth((s) => s.boot);
  const claimTicket = useAuth((s) => s.claimTicket);
  const sandbox = useAppMode((s) => s.sandbox);
  const loadServers = useServers((s) => s.load);
  const serversLoading = useServers((s) => s.loading);
  const activeId = useServers((s) => s.activeId);
  const serverInfo = useServers((s) => s.info);
  const reachable = useServers((s) => s.reachable);
  const restorePending = useAuth((s) => s.restorePending);
  const [minSplash, setMinSplash] = useState(true);

  useEffect(() => {
    // Keep the splash on screen briefly for a polished cold-start, while the
    // Remember-Me keychain check runs in parallel.
    const t = setTimeout(() => setMinSplash(false), 1400);
    // Servers first: the saved profile decides which backend every later
    // request goes to, including the one that restores a remembered session.
    void loadServers().then(() => boot());
    return () => clearTimeout(t);
  }, [boot, loadServers]);

  // A remembered session that could not be checked at launch, because the
  // server was not answering yet, is tried again the moment it does.
  useEffect(() => {
    if (reachable && restorePending && status === 'locked') void boot();
  }, [reachable, restorePending, status, boot]);

  const booting = status === 'booting' || serversLoading || minSplash;
  const showShell = status === 'unlocked' || sandbox;
  // Sandbox is a local demo with no backend, so it skips server selection.
  const showOnboarding = !sandbox && needsOnboarding(activeId, serverInfo, claimTicket);

  return (
    <>
      <AnimatePresence>{booting && <Splash key="splash" />}</AnimatePresence>
      {!booting &&
        (showShell ? <AppShell /> : showOnboarding ? <OnboardingScreen /> : <AuthScreen />)}
      <Toaster />
    </>
  );
}
