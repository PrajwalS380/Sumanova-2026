/**
 * Accounts remembered on this device (Snapchat-style "Welcome back").
 *
 * We keep each account's public bits (name, @username, picture, email) plus its
 * current session tokens so you can switch with one tap. Passwords are never
 * stored. Signing out of an account drops its tokens (the server revokes them);
 * the entry stays until you remove it, and then needs the password again.
 * Same storage and risk level as Supabase's own persisted session.
 */
import type { Session } from '@supabase/supabase-js';
import type { AuraColor, Profile } from '@/lib/types';

export interface SavedAccount {
  id: string;
  email: string | null;
  username: string;
  display_name: string;
  avatar_url: string | null;
  aura_color: AuraColor;
  access_token: string | null;
  refresh_token: string | null;
  saved_at: number;
}

const KEY = 'snv-accounts';
const MAX = 5;

function read(): SavedAccount[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedAccount[];
    return Array.isArray(v) ? v.filter((a) => a && typeof a.id === 'string') : [];
  } catch {
    return [];
  }
}
function write(list: SavedAccount[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage blocked */
  }
}

export const savedAccounts = {
  list: (): SavedAccount[] => read().sort((a, b) => b.saved_at - a.saved_at),
  /** Remember (or refresh) the signed-in account. */
  remember(session: Session, profile: Profile) {
    const rest = read().filter((a) => a.id !== profile.id);
    write([
      {
        id: profile.id,
        email: session.user.email ?? null,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        aura_color: profile.aura_color,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        saved_at: Date.now(),
      },
      ...rest,
    ]);
  },
  /** Keep the entry but drop its tokens (after signing out). */
  forgetTokens(id: string) {
    write(read().map((a) => (a.id === id ? { ...a, access_token: null, refresh_token: null } : a)));
  },
  remove(id: string) {
    write(read().filter((a) => a.id !== id));
  },
};

/** localStorage key supabase-js uses for the active session (its default naming). */
export function authStorageKey(supabaseUrl: string | undefined): string | null {
  try {
    return `sb-${new URL(supabaseUrl ?? '').hostname.split('.')[0]}-auth-token`;
  } catch {
    return null;
  }
}
