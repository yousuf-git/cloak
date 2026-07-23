import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const _sig = 'TS4gWW91c3VmIOKAlCBodHRwczovL2dpdGh1Yi5jb20veW91c3VmLWdpdCDigJQgaHR0cHM6Ly95b3VzdWYtZGV2LmNvbQ==';

/** Merge Tailwind classes with conditional logic. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
