/**
 * Backup & restore of this phone's own settings (theme, text size, language, wallpapers choice,
 * hidden-chat list, accent, background, data saver, screenshot block, memory places…), as a small
 * JSON file. Your chats, snaps, memories and friends already live in your account, so they come
 * back by signing in. Secrets are never included: no sign-in tokens, saved accounts, app-lock PIN,
 * secret-chat keys or device id.
 */
const NEVER = [/^sb-/, /^snv-accounts/, /^snv-lock/, /^snv-secret-/, /^snv-device-key/, /^snv-login-/, /^snv-e2e/, /^snv-vault/];
const isSafe = (k: string) => k.startsWith('snv-') && !NEVER.some((r) => r.test(k));

/** Blob → text (FileReader works on older WebViews and in tests). */
export function readText(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result ?? ''));
    r.onerror = () => rej(r.error);
    r.readAsText(b);
  });
}

export interface Backup { app: 'SUMANOVA'; kind: 'settings-backup'; version: 1; created_at: string; items: Record<string, string> }

export function makeBackup(): Blob {
  const items: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isSafe(k)) items[k] = localStorage.getItem(k) ?? '';
  }
  const b: Backup = { app: 'SUMANOVA', kind: 'settings-backup', version: 1, created_at: new Date().toISOString(), items };
  return new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' });
}

/** Validates and applies a backup file; returns how many settings were restored. */
export async function restoreBackup(file: Blob): Promise<number> {
  if (file.size > 512 * 1024) throw new Error('That file is too big to be a SUMANOVA backup');
  let b: Backup;
  try {
    b = JSON.parse(await readText(file));
  } catch {
    throw new Error('That isn’t a SUMANOVA backup file');
  }
  if (b?.app !== 'SUMANOVA' || b.kind !== 'settings-backup' || typeof b.items !== 'object' || !b.items) throw new Error('That isn’t a SUMANOVA backup file');
  let n = 0;
  for (const [k, v] of Object.entries(b.items)) {
    if (!isSafe(k) || typeof v !== 'string' || v.length > 100_000) continue;
    localStorage.setItem(k, v);
    n++;
  }
  return n;
}
export const backupKeyAllowed = isSafe;
