import { useEffect, useState } from 'react';
import { avatarApi } from '@/features/avatar/api';
import { useThumb } from '@/features/avatar/editor/thumbs';
import type { Expression, Look } from '@/features/avatar/look/config';
import { NovaEmoji } from '@/components/emoji/NovaEmoji';
import { parseNovaSticker } from '@/components/emoji/novaEmoji';

/**
 * Reactions beyond emoji: "av:<expression>" shows the reactor's own 3D avatar head pulling that face;
 * "nova:<id>" shows our Nova emoji. Anything else is a plain emoji.
 */
export const AVATAR_REACTIONS: Expression[] = ['happy', 'laughing', 'surprised', 'blushing', 'winking', 'tongue', 'sad', 'angry'];
export const NOVA_REACTIONS = ['nova:smitten', 'nova:wow', 'nova:flame', 'nova:hearts', 'nova:star', 'nova:devil'];

const looks = new Map<string, Promise<Look | null>>();
const lookOf = (userId: string) => {
  if (!looks.has(userId)) looks.set(userId, avatarApi.get(userId).catch(() => null));
  return looks.get(userId)!;
};

function Head({ userId, expression, size }: { userId: string; expression: Expression; size: number }) {
  const [look, setLook] = useState<Look | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void lookOf(userId).then((l) => alive && setLook(l));
    return () => {
      alive = false;
    };
  }, [userId]);
  const url = useThumb(`react:${userId}:${expression}:${look ? JSON.stringify(look).length : 0}`, () => ({ ...(look as Look), expression }), 'head', !!look);
  if (look === null) return <NovaEmoji id="smitten" size={size} />;
  return url ? <img src={url} alt="" width={size} height={size} className="rounded-full bg-[#F1F1F4] object-cover" /> : <span className="inline-block animate-pulse rounded-full bg-ink/10" style={{ width: size, height: size }} />;
}

export function ReactionGlyph({ value, userId, size = 18 }: { value: string; userId: string; size?: number }) {
  if (value.startsWith('av:')) return <Head userId={userId} expression={value.slice(3) as Expression} size={size + 4} />;
  const nova = parseNovaSticker(value);
  if (nova) return <NovaEmoji id={nova.id} size={size} />;
  return <span style={{ fontSize: size * 0.8 }}>{value}</span>;
}

/** My avatar head with an expression, for the reaction picker. */
export function MyAvatarFace({ userId, expression, size = 40 }: { userId: string; expression: Expression; size?: number }) {
  return <Head userId={userId} expression={expression} size={size} />;
}
