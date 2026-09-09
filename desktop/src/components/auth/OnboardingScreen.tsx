import { AnimatePresence, motion } from 'framer-motion';
import { AuthShell } from './AuthShell';
import { ConnectServerForm } from './ConnectServerForm';
import { ClaimOwnershipForm } from './ClaimOwnershipForm';
import { useAuth } from '@/stores/auth';
import { useServers } from '@/stores/server';
import type { ServerInfo } from '@/lib/server';

/**
 * True while the app still has to be pointed at a server, or that server still
 * has to be claimed.
 *
 * Derived rather than remembered: quitting halfway through claiming and
 * relaunching lands back on the claim step, because the server itself is still
 * reporting that nobody owns it.
 */
export function needsOnboarding(
  activeId: string | null,
  info: ServerInfo | null,
  claimTicket: string | null,
): boolean {
  if (!activeId) return true;
  return info !== null && !info.ownership_claimed && claimTicket === null;
}

/**
 * Everything that has to happen before a sign-in form makes sense: pick a
 * server, and on a brand new one, prove you are the person who set it up.
 */
export function OnboardingScreen() {
  const setOnboarding = useAuth((s) => s.setOnboarding);
  const claimTicket = useAuth((s) => s.claimTicket);
  const activeId = useServers((s) => s.activeId);
  const info = useServers((s) => s.info);

  const claiming = Boolean(activeId && info && !info.ownership_claimed && !claimTicket);

  return (
    <AuthShell
      eyebrow={claiming ? 'Server ownership' : 'Server selection'}
      status={
        claiming
          ? { text: 'Unclaimed', tone: 'warn' }
          : { text: activeId ? 'Saved' : 'Not connected', tone: 'muted' }
      }
      headline={
        <>
          <span className="block">Your keys.</span>
          <span className="auth-headline-shift block">Your server.</span>
          <span className="block" style={{ color: 'var(--color-text-muted)' }}>
            Nobody else&apos;s.
          </span>
        </>
      }
      blurb="Cloak has no central service to trust. Your team runs the backend, holds the database, and keeps the only copies of every key."
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={claiming ? 'claim' : 'connect'}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {claiming && info ? (
            <ClaimOwnershipForm
              serverName={info.name}
              // Backing out drops the active server, which is what returns this
              // screen to its first step.
              onBack={() => useServers.setState({ activeId: null, info: null })}
              onClaimed={(ticket) => setOnboarding({ claimTicket: ticket })}
            />
          ) : (
            <ConnectServerForm
              onConnected={(_info, joinToken) => setOnboarding({ pendingInviteToken: joinToken })}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </AuthShell>
  );
}
