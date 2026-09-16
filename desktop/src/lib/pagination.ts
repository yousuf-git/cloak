/**
 * The page buttons to show: always the first and last page, the current page
 * with a neighbour either side, and a gap wherever pages are skipped. Keeps the
 * control the same width whether there are 3 pages or 300.
 */
export function pageWindow(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  // Near an end, widen towards the middle so the control does not shrink.
  if (page <= 3) [2, 3, 4].forEach((p) => wanted.add(p));
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => wanted.add(p));

  const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  for (const [i, p] of pages.entries()) {
    const prev = pages[i - 1];
    if (prev !== undefined && p - prev > 1) out.push('gap');
    out.push(p);
  }
  return out;
}

/** "21–40", the rows a page holds. */
export function pageRange(page: number, pageSize: number, total: number): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 };
  const from = (page - 1) * pageSize + 1;
  return { from, to: Math.min(page * pageSize, total) };
}
