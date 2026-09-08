import { Check, Minus, ShieldAlert } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CAPABILITIES, CAPABILITY_LABELS, ROLE_ORDER, roleTone } from '@/lib/roles';
import type { Capability } from '@/lib/roles';

const ROWS = Object.keys(CAPABILITY_LABELS) as Capability[];

/**
 * Read-only overview of what each role may do. The grid is derived from the
 * same CAPABILITIES map the UI gates on, so this cannot describe a permission
 * model the app does not actually implement.
 */
export function RolePermissionsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="How roles work"
      description="What each role in this organization is allowed to do. The server enforces these rules on every request."
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-col gap-4">
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="telemetry-label pb-2 pr-4 font-medium">Can</th>
                {ROLE_ORDER.map((role) => (
                  <th key={role} className="pb-2 pl-2 text-center font-medium">
                    <Badge tone={roleTone[role]}>{role}</Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((capability) => {
                const { title, detail } = CAPABILITY_LABELS[capability];
                return (
                  <tr key={capability} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="min-w-52 py-2.5 pr-4">
                      <p className="font-medium">{title}</p>
                      <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                        {detail}
                      </p>
                    </td>
                    {ROLE_ORDER.map((role) => {
                      const allowed = CAPABILITIES[role].includes(capability);
                      return (
                        <td key={role} className="py-2.5 pl-2 text-center">
                          <span className="inline-flex" title={`${role}: ${allowed ? 'allowed' : 'not allowed'}`}>
                            {allowed ? (
                              <Check className="h-4 w-4" style={{ color: 'var(--color-success)' }} aria-label="Allowed" />
                            ) : (
                              <Minus
                                className="h-4 w-4"
                                style={{ color: 'var(--color-fg-muted)', opacity: 0.5 }}
                                aria-label="Not allowed"
                              />
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* The one thing this table would otherwise imply and get wrong. */}
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs leading-relaxed"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
            color: 'var(--color-warning)',
          }}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            These are permissions, not encryption boundaries. Every active member holds the same
            organization key, so a viewer can decrypt exactly what an owner can — the roles above
            control what the server lets them change, not what they can read.
          </span>
        </div>
      </div>
    </Modal>
  );
}
