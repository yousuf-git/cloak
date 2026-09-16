import { useEffect } from 'react';
import { Download, Loader2, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DOWNLOAD_PAGE } from '@/lib/releases';
import { openExternal } from '@/lib/open-external';
import { updateSupport, useUpdates } from '@/stores/updates';

/**
 * The way out of "this app is too old for that server": update in place where
 * this build can, and send people to the download page where it cannot.
 */
export function AppUpdateAction() {
  const status = useUpdates((s) => s.status);
  const available = useUpdates((s) => s.available);
  const error = useUpdates((s) => s.error);
  const check = useUpdates((s) => s.check);
  const install = useUpdates((s) => s.install);
  const supported = updateSupport() === 'supported';

  useEffect(() => {
    if (supported && status === 'idle') void check();
  }, [supported, status, check]);

  if (!supported) {
    return (
      <Button size="sm" variant="outline" icon={<Download className="h-3.5 w-3.5" />} onClick={() => void openExternal(DOWNLOAD_PAGE)}>
        Download the latest Cloak
      </Button>
    );
  }

  if (status === 'checking') {
    return <Busy label="Looking for an update…" />;
  }
  if (status === 'downloading' || status === 'restarting') {
    return <Busy label={status === 'downloading' ? 'Downloading the update…' : 'Restarting…'} />;
  }
  if (status === 'available' && available) {
    return (
      <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => void install()}>
        Update to {available.version} and restart
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1.5">
      {status === 'failed' && error && (
        <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
          Could not update: {error}
        </p>
      )}
      {status === 'up-to-date' && (
        <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
          No newer version is published yet.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" icon={<RotateCw className="h-3.5 w-3.5" />} onClick={() => void check()}>
          Check again
        </Button>
        <Button size="sm" variant="ghost" icon={<Download className="h-3.5 w-3.5" />} onClick={() => void openExternal(DOWNLOAD_PAGE)}>
          Download page
        </Button>
      </div>
    </div>
  );
}

function Busy({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {label}
    </span>
  );
}
