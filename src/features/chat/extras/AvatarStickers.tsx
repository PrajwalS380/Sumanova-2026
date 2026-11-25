import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { avatarApi } from '@/features/avatar/api';
import { useThumb, type ThumbFrame } from '@/features/avatar/editor/thumbs';
import type { Expression, Look, Pose } from '@/features/avatar/look/config';
import { NovaEmoji } from '@/components/emoji/NovaEmoji';
import { loadNovaEmoji, novaEmojiImage, type NovaEmojiId } from '@/components/emoji/novaEmoji';
import { useAuth } from '@/providers/AuthProvider';

/** My avatar in poses + expressions, with a Nova prop and a caption — made on this phone, sent as a sticker. */
interface Design { id: string; pose: Pose; expression: Expression; prop: NovaEmojiId; caption: string; frame: ThumbFrame }
export const AVATAR_STICKERS: Design[] = [
  { id: 'hi', pose: 'waving', expression: 'happy', prop: 'sparkle', caption: 'Hi!', frame: 'sticker' },
  { id: 'lol', pose: 'standing', expression: 'laughing', prop: 'wow', caption: 'LOL', frame: 'sticker' },
  { id: 'yay', pose: 'celebrating', expression: 'happy', prop: 'star', caption: 'Yay!', frame: 'sticker' },
  { id: 'thanks', pose: 'thumbsup', expression: 'happy', prop: 'hearts', caption: 'Thank you', frame: 'sticker' },
  { id: 'love', pose: 'standing', expression: 'blushing', prop: 'smitten', caption: 'Love you', frame: 'sticker' },
  { id: 'night', pose: 'sitting', expression: 'sleeping', prop: 'halo', caption: 'Good night', frame: 'seated' },
  { id: 'sorry', pose: 'standing', expression: 'sad', prop: 'blush', caption: 'Sorry', frame: 'sticker' },
  { id: 'omg', pose: 'standing', expression: 'surprised', prop: 'wow', caption: 'OMG', frame: 'sticker' },
  { id: 'grr', pose: 'standing', expression: 'angry', prop: 'devil', caption: 'Grr', frame: 'sticker' },
  { id: 'party', pose: 'dancing', expression: 'laughing', prop: 'crown', caption: 'Party!', frame: 'sticker' },
  { id: 'otw', pose: 'walking', expression: 'happy', prop: 'flame', caption: 'On my way', frame: 'sticker' },
  { id: 'wink', pose: 'thumbsup', expression: 'winking', prop: 'shades', caption: 'Got it', frame: 'sticker' },
  { id: 'cry', pose: 'sitting', expression: 'crying', prop: 'hourglass', caption: 'Miss you', frame: 'seated' },
  { id: 'cheeky', pose: 'standing', expression: 'tongue', prop: 'kitty', caption: 'Hehe', frame: 'sticker' },
];

const SIZE = 320;
const lookKey = (l: Look) => JSON.stringify(l).length.toString(36) + ':' + hash(JSON.stringify(l));
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function StickerThumb({ look, d, onPick }: { look: Look; d: Design; onPick: (url: string, d: Design) => void }) {
  const url = useThumb(`stk:${lookKey(look)}:${d.id}`, () => ({ ...structuredClone(look), pose: d.pose, expression: d.expression }), d.frame, true, false, SIZE);
  return (
    <button disabled={!url} onClick={() => onPick(url, d)} className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl bg-[#F1F1F4] active:scale-95" aria-label={`Send ${d.caption} sticker`}>
      {url ? <img src={url} alt="" className="h-full w-full object-contain" draggable={false} /> : <Loader2 className="h-5 w-5 animate-spin text-ink-mute" />}
      <NovaEmoji id={d.prop} size={26} className="absolute right-1 top-1" />
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 -rotate-3 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-black text-white">{d.caption}</span>
    </button>
  );
}

/** Draws the final sticker PNG: avatar render + Nova prop + caption tag. */
export async function composeSticker(renderUrl: string, d: Design): Promise<Blob> {
  const img = new Image();
  img.src = renderUrl;
  await img.decode();
  await loadNovaEmoji(d.prop);
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const prop = novaEmojiImage(d.prop);
  if (prop) {
    ctx.save();
    ctx.translate(SIZE * 0.8, SIZE * 0.18);
    ctx.rotate(0.18);
    ctx.drawImage(prop, -SIZE * 0.14, -SIZE * 0.14, SIZE * 0.28, SIZE * 0.28);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(SIZE / 2, SIZE * 0.86);
  ctx.rotate(-0.06);
  ctx.font = `900 ${SIZE * 0.1}px "Inter Variable", system-ui, sans-serif`;
  const w = ctx.measureText(d.caption).width + SIZE * 0.08;
  const h = SIZE * 0.15;
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, SIZE * 0.035);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(d.caption, 0, SIZE * 0.006);
  ctx.restore();
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Couldn’t make the sticker'))), 'image/png'));
}

export function AvatarStickers({ onSend }: { onSend: (blob: Blob, d: Design) => void }) {
  const { session } = useAuth();
  const [look, setLook] = useState<Look | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!session) return;
    void avatarApi.get(session.user.id).then(setLook).catch(() => setLook(null));
  }, [session]);

  if (look === undefined) return <div className="grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-ink-mute" /></div>;
  if (!look) {
    return (
      <div className="mx-4 mb-6 rounded-tile bg-[#F1F1F4] p-5 text-center">
        <NovaEmoji id="sparkle" size={44} />
        <p className="mt-2 font-extrabold">Make your avatar to get stickers of you</p>
        <Link to="/onboarding/avatar" className="mt-3 inline-block rounded-2xl bg-ink px-4 py-2.5 text-sm font-extrabold text-white">Create my avatar</Link>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2 px-4 pb-6">
      {AVATAR_STICKERS.map((d) => (
        <StickerThumb
          key={d.id}
          look={look}
          d={d}
          onPick={async (url, dd) => {
            if (busy) return;
            setBusy(true);
            try {
              onSend(await composeSticker(url, dd), dd);
            } finally {
              setBusy(false);
            }
          }}
        />
      ))}
    </div>
  );
}
