/**
 * Shared file I/O for the desktop app. Everything that saves a file out of
 * Cloak (CSV/backup/key exports, sample downloads) or reads a file into it
 * (CSV/key imports) goes through here so behaviour is consistent everywhere.
 *
 * In the Tauri webview:
 *   - saveDownload writes straight into the OS Downloads folder; if that can't
 *     be resolved it falls back to a native "Save As" dialog so the user picks
 *     a location.
 *   - pickTextFile opens a native file dialog with real extension filters.
 * Outside Tauri (browser dev / Sandbox in a plain browser) both fall back to
 * DOM primitives (blob download / hidden <input type=file>).
 */

import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { downloadDir, join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { toast } from '@/stores/toast';

/** `{ name, extensions }` — extensions carry no leading dot, e.g. `['csv']`. */
export interface FileFilter {
  name: string;
  extensions: string[];
}

function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export interface SaveResult {
  saved: boolean;
  /** Absolute path written, when known (Tauri only). */
  path?: string;
}

/**
 * Save text to the user's Downloads folder. Falls back to a "Save As" dialog if
 * the Downloads folder can't be resolved, and to a browser blob download when
 * not running under Tauri. Surfaces the outcome as a toast (path on success).
 */
export async function saveDownload(
  filename: string,
  content: string,
  opts: { mime?: string; filters?: FileFilter[] } = {},
): Promise<SaveResult> {
  const { mime = 'text/plain', filters } = opts;

  if (!inTauri()) {
    browserDownload(filename, content, mime);
    toast.success(`Downloaded ${filename}`);
    return { saved: true };
  }

  try {
    let path: string;
    try {
      const dir = await downloadDir();
      const target = await join(dir, filename);
      path = await invoke<string>('write_text_file', { path: target, contents: content });
    } catch {
      // Downloads folder unavailable — let the user choose where to save.
      const chosen = await saveDialog({ defaultPath: filename, filters });
      if (!chosen) return { saved: false }; // user cancelled — no toast
      path = await invoke<string>('write_text_file', { path: chosen, contents: content });
    }
    toast.success(`File saved to ${path}`);
    return { saved: true, path };
  } catch {
    toast.error(`Could not save ${filename}`);
    return { saved: false };
  }
}

export interface PickedFile {
  name: string;
  content: string;
}

/**
 * Open a native file picker (filtered by `filters`) and return the selected
 * file's name + text contents. Returns `null` if the user cancels.
 */
export async function pickTextFile(filters?: FileFilter[]): Promise<PickedFile | null> {
  if (!inTauri()) return pickViaInput(filters);

  const selected = await openDialog({ multiple: false, directory: false, filters });
  if (!selected || Array.isArray(selected)) return null;
  const content = await invoke<string>('read_text_file', { path: selected });
  return { name: baseName(selected), content };
}

// ---- Browser fallbacks -----------------------------------------------------

function browserDownload(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function pickViaInput(filters?: FileFilter[]): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (filters?.length) {
      input.accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',');
    }
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name, content: await file.text() } : null);
    };
    input.click();
  });
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Turn a user title into a safe download filename with the given extension. */
export function safeFilename(base: string, ext: string): string {
  const clean =
    base
      .trim()
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'export';
  return `${clean}.${ext}`;
}
