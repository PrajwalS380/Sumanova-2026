import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { Copy, Download, ScanLine, Share2, X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Ghost, GHOST_HOST } from '@/components/ui/Ghost';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { cn } from '@/lib/cn';

/** Public web address friends can open (also what the code encodes). */
export const profileLink = (username: string) => `https://sumanova.vercel.app/u/${encodeURIComponent(username)}`;

/** Pull a username out of a scanned code / pasted link. */
export function usernameFromCode(text: string): string | null {
  const t = text.trim();
  const m = /\/u\/([A-Za-z0-9._]{3,30})(?:[/?#]|$)/.exec(t) ?? /^@?([A-Za-z0-9._]{3,30})$/.exec(t);
  return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** My profile code (wireframe 6d): a scannable code with my face in the middle; share, save, scan. */
export default function ProfileCodeScreen() {
  const { profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [qr, setQr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const link = profile ? profileLink(profile.username) : '';

  useEffect(() => {
    if (!link) return;
    // High error correction so the face in the middle never breaks the code.
    void QRCode.toDataURL(link, { errorCorrectionLevel: 'H', margin: 1, width: 640, color: { dark: '#111111', light: '#FFFFFF' } }).then(setQr);
  }, [link]);
  if (!profile) return null;

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: 'SUMANOVA', text: `Add me on SUMANOVA: @${profile!.username}`, url: link });
      else await copy();
    } catch {
      /* cancelled */
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied', 'success');
    } catch {
      toast(link, 'info');
    }
  }
  function save() {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = `sumanova-${profile!.username}.png`;
    a.click();
  }

  const act = cn('flex flex-col items-center gap-1.5 rounded-tile bg-white px-1 py-3 text-xs font-extrabold active:scale-95', GHOST_HOST);
  return (
    <div className="min-h-full bg-noir pb-10">
      <header className="flex items-center gap-2 px-3.5 pb-2 pt-safe">
        <button onClick={() => navigate(-1)} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-2xl bg-white active:scale-90"><X className="h-5 w-5" /></button>
        <h1 className="flex-1 text-center text-lg font-extrabold">My code</h1>
        <span className="w-10" />
      </header>
      <div className="mx-auto max-w-sm px-6">
        <div className={cn('mt-2 rounded-[32px] bg-white p-6 text-center', GHOST_HOST)}>
          <Ghost url={profile.avatar_url} size={260} opacity={0.06} className="-right-16 -top-10" />
          <div className="relative mx-auto aspect-square w-full max-w-[250px] rounded-[26px] border-[3px] border-[#111111] p-3">
            {qr ? <img src={qr} alt={`Profile code for @${profile.username}`} className="h-full w-full rounded-xl" /> : <div className="h-full w-full animate-pulse rounded-xl bg-ink/[0.06]" />}
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-white">
              <Avatar name={profile.display_name} url={profile.avatar_url} aura={profile.aura_color} size={64} />
            </span>
          </div>
          <p className="mt-4 font-display text-[30px] leading-none">{profile.display_name}</p>
          <p className="mt-1 text-sm font-bold text-ink-mute">@{profile.username}</p>
          <span className="mt-3 inline-block rounded-xl bg-ink/[0.06] px-3 py-1.5 text-xs font-extrabold">Scan in SUMANOVA to add me</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <button onClick={() => void copy()} className={act}><Copy className="h-6 w-6" />Copy link</button>
          <button onClick={() => void share()} className={act}><Share2 className="h-6 w-6" />Share…</button>
          <button onClick={save} className={act}><Download className="h-6 w-6" />Save</button>
          <button onClick={() => setScanning(true)} className={cn(act, 'bg-[#111111] text-white')}><ScanLine className="h-6 w-6" />Scan</button>
        </div>
      </div>
      {scanning && <Scanner onClose={() => setScanning(false)} onFound={(u) => { setScanning(false); navigate(`/u/${u}`); }} />}
    </div>
  );
}

/** Camera scanner using the built-in BarcodeDetector (Android Chrome / WebView); camera is released on close. */
function Scanner({ onClose, onFound }: { onClose: () => void; onFound: (username: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!Ctor) {
      setError('Scanning isn’t supported on this device yet — ask your friend to share their link instead.');
      return;
    }
    const detector = new Ctor({ formats: ['qr_code'] });
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(v);
            const u = codes.map((c) => usernameFromCode(c.rawValue)).find(Boolean);
            if (u) return onFound(u);
          } catch {
            /* frame not ready */
          }
          raf = window.setTimeout(() => void tick(), 250);
        };
        void tick();
      } catch {
        setError('Camera permission is needed to scan a code.');
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onFound]);
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <video ref={video} playsInline muted className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-[32px] border-4 border-white/90" />
      <button onClick={onClose} aria-label="Close scanner" className="absolute right-4 top-[calc(var(--safe-top)+12px)] grid h-11 w-11 place-items-center rounded-2xl bg-black/50 text-white"><X className="h-5 w-5" /></button>
      <p className="absolute inset-x-6 bottom-[calc(var(--safe-bottom)+32px)] rounded-2xl bg-black/55 p-3 text-center text-sm font-semibold text-white">{error ?? 'Point at a SUMANOVA code'}</p>
    </div>
  );
}
