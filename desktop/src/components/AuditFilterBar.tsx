import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import {
  AREA_OPTIONS,
  NO_FILTERS,
  OUTCOME_OPTIONS,
  RANGE_OPTIONS,
  isFiltered,
  type AuditFilters,
} from '@/lib/audit-filters';

/** How long typing has to pause before the search is sent. */
const SEARCH_DELAY_MS = 300;

/**
 * Filters shared by the organization's audit log and a member's activity. The
 * member picker is left out where every row is already one person.
 */
export function AuditFilterBar({
  value,
  onChange,
  members,
}: {
  value: AuditFilters;
  onChange: (next: AuditFilters) => void;
  /** Omit to hide the member filter. */
  members?: { user_id: string; email: string; name?: string | null }[];
}) {
  // Typed text stays local until the pause, so each keystroke is not a request.
  const [search, setSearch] = useState(value.q);

  useEffect(() => setSearch(value.q), [value.q]);

  useEffect(() => {
    if (search === value.q) return;
    const t = setTimeout(() => onChange({ ...value, q: search }), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof AuditFilters>(key: K) => (next: string) =>
    onChange({ ...value, [key]: next as AuditFilters[K] });

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-56 flex-1">
        <TextField
          placeholder="Search actions, names or people"
          icon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Select value={value.area} onChange={set('area')} options={AREA_OPTIONS} className="w-40" />
      {members && (
        <Select
          value={value.userId}
          onChange={set('userId')}
          options={[
            { value: '', label: 'Anyone' },
            ...members.map((m) => ({ value: m.user_id, label: m.name ?? m.email })),
          ]}
          className="w-44"
        />
      )}
      <Select value={value.outcome} onChange={set('outcome')} options={OUTCOME_OPTIONS} className="w-36" />
      <Select value={value.range} onChange={set('range')} options={RANGE_OPTIONS} className="w-36" />
      {isFiltered(value) && (
        <Button
          size="sm"
          variant="ghost"
          icon={<X className="h-3.5 w-3.5" />}
          onClick={() => {
            setSearch('');
            onChange(NO_FILTERS);
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
