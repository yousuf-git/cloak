#!/usr/bin/env node
/**
 * Verify the `file:line` links the docs are built on.
 *
 * CORE_LOGICS.md and INFO_ABOUT_KEYS.md trace every claim to a line of real
 * code. Those anchors are hand-written constants, so they rot silently on the
 * next refactor — a link that used to point at `login()` ends up on a closing
 * brace, and the document still reads as if it were sourced.
 *
 * This catches the two things that are checkable without knowing intent:
 *   - the target file or line does not exist (hard error), and
 *   - the target line is one no document would deliberately cite — blank, a
 *     lone brace, an import (a strong signal the anchor drifted).
 *
 * It cannot tell whether `#L187` is still the *right* line, only that it is
 * still a plausible one. Run it after touching code that the docs reference.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'target', 'ignore']);

/** `[`kdf.rs:58`](../desktop/src-tauri/src/crypto/kdf.rs#L58)` */
const LINK = /\[`?([^\]]*?)`?\]\(([^)#\s]+)#L(\d+)\)/g;
/** A label that names its own line, e.g. "kdf.rs:58" or ":60". */
const LABEL_LINE = /^(?:[\w.-]+)?:(\d+)$/;

function markdownFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...markdownFiles(path));
    else if (entry.endsWith('.md')) out.push(path);
  }
  return out;
}

/** Lines a doc would never mean to point at. */
function suspicious(code) {
  const trimmed = code.trim();
  if (trimmed === '') return 'blank line';
  if (/^[})\];,]+$/.test(trimmed)) return `closing punctuation (${trimmed})`;
  if (/^(import|use|from)\b/.test(trimmed)) return 'an import';
  return null;
}

const cache = new Map();
function sourceLines(path) {
  if (!cache.has(path)) cache.set(path, readFileSync(path, 'utf8').split('\n'));
  return cache.get(path);
}

let errors = 0;
let warnings = 0;
let checked = 0;

for (const md of markdownFiles(ROOT)) {
  const text = readFileSync(md, 'utf8');
  const here = relative(ROOT, md);

  text.split('\n').forEach((line, index) => {
    for (const [, label, rel, lineNo] of line.matchAll(LINK)) {
      // Only code links are checkable; cross-document anchors are not.
      if (rel.endsWith('.md')) continue;
      checked += 1;

      const where = `${here}:${index + 1}`;
      const target = resolve(dirname(md), rel);

      let lines;
      try {
        lines = sourceLines(target);
      } catch {
        console.error(`ERROR ${where} -> ${rel} does not exist`);
        errors += 1;
        continue;
      }

      const n = Number(lineNo);
      if (n < 1 || n > lines.length) {
        console.error(`ERROR ${where} -> ${rel}#L${n} is past end of file (${lines.length} lines)`);
        errors += 1;
        continue;
      }

      const labelled = LABEL_LINE.exec(label);
      if (labelled && Number(labelled[1]) !== n) {
        console.error(`ERROR ${where} -> label says :${labelled[1]}, anchor says #L${n}`);
        errors += 1;
        continue;
      }

      const reason = suspicious(lines[n - 1]);
      if (reason) {
        console.warn(`WARN  ${where} -> ${rel}#L${n} is ${reason} — anchor has probably drifted`);
        warnings += 1;
      }
    }
  });
}

console.log(`\n${checked} code links checked · ${errors} broken · ${warnings} suspect`);
process.exit(errors > 0 ? 1 : 0);
