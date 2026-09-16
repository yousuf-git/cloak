import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { pageRange, pageWindow } from '@/lib/pagination';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  pageSizes: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** Disable the controls while a page is on its way. */
  busy?: boolean;
}

/** "Showing 21–40 of 312", rows per page, and first / previous / numbered / next / last. */
export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  pageSizes,
  onPageChange,
  onPageSizeChange,
  busy = false,
}: PaginationProps) {
  const { from, to } = pageRange(page, pageSize, total);
  const atStart = page <= 1;
  const atEnd = page >= pageCount;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="tabular-nums">
          {total === 0 ? 'No records' : `Showing ${from}–${to} of ${total.toLocaleString()}`}
        </span>
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <Select
            value={String(pageSize)}
            onChange={(v) => onPageSizeChange(Number(v))}
            options={pageSizes.map((n) => ({ value: String(n), label: String(n) }))}
            className="w-20"
          />
        </div>
      </div>

      {pageCount > 0 && (
        <nav className="flex items-center gap-1" aria-label="Pages">
          <span className="mr-2 tabular-nums">
            Page {page} of {pageCount}
          </span>
          <PageButton label="First page" disabled={busy || atStart} onClick={() => onPageChange(1)}>
            <ChevronsLeft className="h-3.5 w-3.5" />
          </PageButton>
          <PageButton label="Previous page" disabled={busy || atStart} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </PageButton>
          {pageWindow(page, pageCount).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1">
                …
              </span>
            ) : (
              <PageButton
                key={p}
                label={`Page ${p}`}
                current={p === page}
                disabled={busy}
                onClick={() => onPageChange(p)}
              >
                {p}
              </PageButton>
            ),
          )}
          <PageButton label="Next page" disabled={busy || atEnd} onClick={() => onPageChange(page + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </PageButton>
          <PageButton label="Last page" disabled={busy || atEnd} onClick={() => onPageChange(pageCount)}>
            <ChevronsRight className="h-3.5 w-3.5" />
          </PageButton>
        </nav>
      )}
    </div>
  );
}

function PageButton({
  label,
  current = false,
  disabled,
  onClick,
  children,
}: {
  label: string;
  current?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      title={label}
      disabled={disabled || current}
      onClick={onClick}
      className={cn(
        'no-drag flex h-7 min-w-7 items-center justify-center rounded-md border px-2 tabular-nums transition-colors',
        !current && 'hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5',
      )}
      style={{
        borderColor: current ? 'var(--color-brand-500)' : 'var(--color-border)',
        color: current ? 'var(--color-fg)' : undefined,
        backgroundColor: current ? 'color-mix(in srgb, var(--color-brand-500) 12%, transparent)' : undefined,
      }}
    >
      {children}
    </button>
  );
}
