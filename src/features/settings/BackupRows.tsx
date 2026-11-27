import { useRef } from 'react';
import { DownloadCloud, UploadCloud } from 'lucide-react';
import { makeBackup, restoreBackup } from '@/lib/backup';
import { saveMedia } from '@/lib/saveMedia';
import { useToast } from '@/providers/ToastProvider';

const ROW = 'flex w-full items-center gap-3 px-3.5 py-[13px] text-left text-[15px] font-semibold';

/** Settings → Backup & restore (this phone's settings; your account data is already in the cloud). */
export function BackupRows() {
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        className={ROW}
        onClick={async () => {
          const r = await saveMedia(makeBackup(), `sumanova-settings-${new Date().toISOString().slice(0, 10)}.json`).catch((e: Error) => toast(e.message, 'error'));
          if (r === 'saved') toast('Backup saved', 'success');
        }}
      >
        <DownloadCloud className="h-5 w-5" />
        <span className="flex-1">Back up this phone’s settings<span className="block text-xs font-normal text-ink-mute">Theme, language, text size, wallpapers, hidden chats… (never passwords or PINs)</span></span>
      </button>
      <button className={ROW} onClick={() => file.current?.click()}>
        <UploadCloud className="h-5 w-5" />
        <span className="flex-1">Restore from a backup<span className="block text-xs font-normal text-ink-mute">Chats, snaps, memories and friends come back just by signing in</span></span>
      </button>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const n = await restoreBackup(f);
            toast(`Restored ${n} setting${n === 1 ? '' : 's'} — reloading`, 'success');
            setTimeout(() => location.reload(), 900);
          } catch (err) {
            toast((err as Error).message, 'error');
          }
        }}
      />
    </>
  );
}
