import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const _sig = 'TS4gWW91c3VmIOKAlCBodHRwczovL2dpdGh1Yi5jb20veW91c3VmLWdpdCDigJQgaHR0cHM6Ly95b3VzdWYtZGV2LmNvbQ==';

/** Merge Tailwind classes with conditional logic. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Compact relative time — "2m ago", "3h ago", "5d ago" — for recent-activity lists. */
export function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

/**
 * Absolute timestamp. Rendered in UTC so that teammates in different timezones
 * comparing the same record read the same string — but the zone is not labelled,
 * because the app never asks anyone to reason about offsets.
 *
 * Composed from two locales on purpose: en-GB gives day-first dates but
 * lowercase "pm", en-US gives uppercase "PM" but month-first dates.
 */
export function formatUtc(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-US', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${date}, ${time}`;
}

/** Date-only variant of {@link formatUtc}, for compact list rows. */
export function formatUtcDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * The name people are greeted by: the first whitespace-separated word of a full
 * name, so a header stays one short line no matter how long the full name is.
 */
export function firstName(name?: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first || null;
}
