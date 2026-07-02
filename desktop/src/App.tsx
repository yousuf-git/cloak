import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Splash } from './components/Splash';
import { AppShell } from './components/AppShell';
import { AuthScreen } from './components/auth/AuthScreen';
import { useAuth } from './stores/auth';
import { useAppMode } from './stores/app-mode';

export function App() {
  const status = useAuth((s) => s.status);
  const boot = useAuth((s) => s.boot);
  const sandbox = useAppMode((s) => s.sandbox);
  const [minSplash, setMinSplash] = useState(true);

  useEffect(() => {
    // Keep the splash on screen briefly for a polished cold-start, while the
    // Remember-Me keychain check runs in parallel.
    const t = setTimeout(() => setMinSplash(false), 1400);
    void boot();
    return () => clearTimeout(t);
  }, [boot]);

  const booting = status === 'booting' || minSplash;
  const showShell = status === 'unlocked' || sandbox;

  return (
    <>
      <AnimatePresence>{booting && <Splash key="splash" />}</AnimatePresence>
      {!booting && (showShell ? <AppShell /> : <AuthScreen />)}
    </>
  );
}
