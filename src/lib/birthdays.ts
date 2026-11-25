import { supabase } from '@/lib/supabase';
import type { AuraColor } from '@/lib/types';
import { daysUntil, signFor, type Sign } from '@/lib/zodiac';

export interface FriendBirthday {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  aura_color: AuraColor;
  month: number;
  day: number;
  /** days until the next one (0 = today) */
  inDays: number;
  sign: Sign;
}

/** Friends who share their birthday (day + month only), soonest first. */
export async function friendBirthdays(now = new Date()): Promise<FriendBirthday[]> {
  const { data, error } = await supabase.rpc('friend_birthdays');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Omit<FriendBirthday, 'inDays' | 'sign'>[])
    .map((r) => ({ ...r, inDays: daysUntil(r.month, r.day, now), sign: signFor(r.month, r.day) }))
    .sort((a, b) => a.inDays - b.inDays);
}
