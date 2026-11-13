import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ImagePlus, Mic, PencilLine, Reply, SendHorizontal, Smile, Square, Trash2, X } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/providers/ToastProvider';
import { MAX_VOICE_SECONDS, prepareMedia, startVoiceRecording, type VoiceRecording } from '@/lib/chat/media';
import { formatDuration } from '@/lib/chat/time';
import type { LocalMessage, MediaMeta, MessageKind } from '@/lib/chat/types';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { STICKERS } from './themes';

export interface ComposerSend {
  kind: MessageKind;
  body?: string | null;
  blob?: Blob;
  meta?: MediaMeta;
  replyTo?: string | null;
}

interface Props {
  onSend: (m: ComposerSend) => void;
  onEdit: (id: string, body: string) => Promise<void>;
  onTyping: () => void;
  replyTo: LocalMessage | null;
  replyName?: string;
  editing: LocalMessage | null;
  onCancel: () => void;
  accent: string;
  disabled?: string | null;
}

export function Composer({ onSend, onEdit, onTyping, replyTo, replyName, editing, onCancel, accent, disabled }: Props) {
  const [text, setText] = useState('');
  const [stickers, setStickers] = useState(false);
  const [rec, setRec] = useState<VoiceRecording | null>(null);
  const [recSecs, setRecSecs] = useState(0);
  const [level, setLevel] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (editing) {
      setText(editing.body ?? '');
      ta.current?.focus();
    }
  }, [editing]);
  useEffect(() => {
    if (replyTo) ta.current?.focus();
  }, [replyTo]);

  // Auto-grow textarea up to 5 lines.
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

  // Recording timer + level meter.
  useEffect(() => {
    if (!rec) return;
    const started = Date.now();
    const t = setInterval(() => {
      const s = (Date.now() - started) / 1000;
      setRecSecs(s);
      setLevel(rec.level());
      if (s >= MAX_VOICE_SECONDS) void finishRecording();
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec]);

  async function submit() {
    const body = text.trim();
    if (!body) return;
    haptic(8);
    if (editing) {
      try {
        await onEdit(editing.id, body);
      } catch (e) {
        toast((e as Error).message, 'error');
        return;
      }
    } else {
      onSend({ kind: 'text', body, replyTo: replyTo?.id ?? null });
    }
    setText('');
    onCancel();
  }

  async function pickFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const f of Array.from(files).slice(0, 10)) {
      try {
        const prepared = await prepareMedia(f);
        onSend({ kind: prepared.kind, blob: prepared.blob, meta: prepared.meta, replyTo: replyTo?.id ?? null });
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    }
    onCancel();
  }

  async function startRecording() {
    try {
      haptic(12);
      setRecSecs(0);
      setRec(await startVoiceRecording());
    } catch {
      toast('Microphone access is needed for voice notes. Allow it in your browser/app settings.', 'error');
    }
  }

  async function finishRecording() {
    if (!rec) return;
    const r = rec;
    setRec(null);
    const out = await r.stop();
    if (!out) return toast('Hold on a little longer to record', 'info');
    haptic(10);
    onSend({ kind: 'voice', blob: out.blob, meta: { duration: out.duration, waveform: out.waveform, mime: out.blob.type, size: out.blob.size }, replyTo: replyTo?.id ?? null });
    onCancel();
  }

  if (disabled) {
    return <div className="glass-strong mx-3 mb-3 rounded-3xl px-4 py-3 text-center text-sm text-ink-mute pb-safe">{disabled}</div>;
  }

  return (
    <div className="relative z-20 px-3 pb-safe pt-2">
      <AnimatePresence>
        {(replyTo || editing) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="glass-strong mb-2 flex items-center gap-2 rounded-2xl px-3 py-2">
            {editing ? <PencilLine className="h-4 w-4 shrink-0" style={{ color: accent }} /> : <Reply className="h-4 w-4 shrink-0" style={{ color: accent }} />}
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-semibold" style={{ color: accent }}>{editing ? 'Edit message' : `Replying to ${replyName ?? ''}`}</p>
              <p className="truncate text-ink-mute">{(editing ?? replyTo)?.body ?? 'Media'}</p>
            </div>
            <button onClick={() => { onCancel(); if (editing) setText(''); }} aria-label="Cancel" className="p-1 text-ink-mute"><X className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {rec ? (
        <div className="glass-strong flex h-14 items-center gap-3 rounded-[1.75rem] px-2">
          <button onClick={() => { rec.cancel(); setRec(null); }} aria-label="Discard recording" className="grid h-10 w-10 place-items-center rounded-full text-aurora-coral"><Trash2 className="h-5 w-5" /></button>
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-aurora-coral" />
          <span className="w-10 text-sm tabular-nums">{formatDuration(recSecs)}</span>
          <div className="flex flex-1 items-center justify-center gap-[3px]" aria-hidden>
            {Array.from({ length: 18 }).map((_, i) => (
              <span key={i} className="w-[3px] rounded-full bg-white/70 transition-[height] duration-100" style={{ height: `${6 + level * 26 * (0.5 + Math.abs(Math.sin(i * 1.7 + recSecs * 6)) * 0.5)}px` }} />
            ))}
          </div>
          <button onClick={finishRecording} aria-label="Send voice note" className="grid h-11 w-11 place-items-center rounded-full text-white shadow-glow" style={{ background: `linear-gradient(135deg, ${accent}, #2dd4bf)` }}>
            <Square className="h-4 w-4 fill-current" />
          </button>
        </div>
      ) : (
        <div className="glass-strong flex items-end gap-1 rounded-[1.75rem] p-1.5">
          <button onClick={() => file.current?.click()} aria-label="Attach photo or video" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-soft hover:text-white">
            <ImagePlus className="h-5 w-5" />
          </button>
          <input ref={file} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { void pickFiles(e.target.files); e.target.value = ''; }} />
          <textarea
            ref={ta}
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value) onTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={editing ? 'Edit message' : 'Message'}
            maxLength={4000}
            aria-label="Message"
            className="max-h-[132px] min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-snug outline-none placeholder:text-ink-faint"
          />
          <button onClick={() => setStickers(true)} aria-label="Stickers" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-soft hover:text-white">
            <Smile className="h-5 w-5" />
          </button>
          <AnimatePresence mode="wait" initial={false}>
            {text.trim() ? (
              <motion.button key="send" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} onClick={() => void submit()} aria-label={editing ? 'Save edit' : 'Send'} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-glow" style={{ background: `linear-gradient(135deg, ${accent}, #2dd4bf)` }}>
                <SendHorizontal className="h-5 w-5" />
              </motion.button>
            ) : (
              <motion.button key="mic" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} onClick={startRecording} aria-label="Record voice note" className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white')}>
                <Mic className="h-5 w-5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      <Sheet open={stickers} onClose={() => setStickers(false)} title="Stickers">
        <div className="grid grid-cols-6 gap-1 px-4 pb-6">
          {STICKERS.map((s) => (
            <button key={s} onClick={() => { haptic(8); onSend({ kind: 'sticker', body: s, replyTo: replyTo?.id ?? null }); setStickers(false); onCancel(); }} className="grid aspect-square place-items-center rounded-2xl text-4xl transition-transform hover:bg-white/5 active:scale-90" aria-label={`Send ${s} sticker`}>
              {s}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
