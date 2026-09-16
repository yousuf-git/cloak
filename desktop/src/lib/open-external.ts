import { inTauri } from './native-fs';

/**
 * Open a web page in the system browser. The desktop webview does not follow
 * links out of the app, so this goes through the opener plugin there.
 */
export async function openExternal(url: string): Promise<void> {
  if (!inTauri()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(url);
}
