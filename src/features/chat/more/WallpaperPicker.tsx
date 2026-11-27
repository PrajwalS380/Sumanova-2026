import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { WALLPAPERS, getWallpaperId, setWallpaperId, setWallpaperPhoto } from './wallpaper';
import { useToast } from '@/providers/ToastProvider';
import { cn } from '@/lib/cn';

/** Chat details → Wallpaper (only on this phone). */
export function WallpaperPicker({ chatId }: { chatId: string }) {
  const toast = useToast();
  const [cur, setCur] = useState(() => getWallpaperId(chatId));
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="px-4 py-3">
      <p className="mb-2 text-[15px] font-medium">Wallpaper <span className="text-xs text-ink-mute">· on this phone</span></p>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {WALLPAPERS.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => { setWallpaperId(chatId, w.id); setCur(w.id); }}
            aria-label={`Wallpaper ${w.label}`}
            aria-pressed={cur === w.id}
            className={cn('h-16 w-11 shrink-0 rounded-xl bg-noir ring-1 ring-ink/10', cur === w.id && 'ring-2 ring-ember-flame')}
            style={{ background: w.id === 'none' ? undefined : w.css }}
          >
            {w.id === 'none' && <span className="text-[10px] font-bold text-ink-mute">None</span>}
          </button>
        ))}
        <button type="button" onClick={() => file.current?.click()} aria-label="Use my own photo" aria-pressed={cur === 'photo'} className={cn('grid h-16 w-11 shrink-0 place-items-center rounded-xl bg-[#F1F1F4]', cur === 'photo' && 'ring-2 ring-ember-flame')}>
          <ImagePlus className="h-5 w-5" />
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              await setWallpaperPhoto(chatId, f);
              setCur('photo');
              toast('Wallpaper set', 'success');
            } catch (err) {
              toast((err as Error).message, 'error');
            }
          }}
        />
      </div>
    </div>
  );
}
