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
