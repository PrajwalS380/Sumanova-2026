import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Loader2, Send, X } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { storiesApi, type Audience } from '@/lib/social/api';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { STORY_BACKGROUNDS } from './backgrounds';
import { AudiencePicker } from './AudiencePicker';

export function TextStoryComposer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const { session } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const [bgKey, setBgKey] = useState('aurora');
  const [audience, setAudience] = useState<Audience>('friends');
  const [step, setStep] = useState<'write' | 'share'>('write');
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ta.current?.focus(), []);

  async function post() {
    setBusy(true);
    try {
      await storiesApi.post(session!.user.id, { kind: 'text', text: text.trim(), background: bgKey, audience });
      haptic([10, 40, 10]);
      toast('Added to your story ✦', 'success');
      onPosted();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex flex-col" style={{ background: STORY_BACKGROUNDS[bgKey] }}>
      <div className="flex items-center justify-between px-4 pt-safe">
        <button onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-black/25 text-white"><X className="h-6 w-6" /></button>
        <button onClick={() => setStep('share')} disabled={!text.trim()} className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-noir disabled:opacity-50">Next</button>
      </div>
      <div className="grid flex-1 place-items-center px-8">
        <textarea ref={ta} value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} rows={5} placeholder="What’s on your mind?" className="w-full resize-none bg-transparent text-center font-display text-3xl font-medium leading-tight text-white outline-none placeholder:text-white/50" />
      </div>
      <div className="flex justify-center gap-2.5 pb-safe pt-2">
        {Object.entries(STORY_BACKGROUNDS).map(([k, v]) => (
          <button key={k} onClick={() => setBgKey(k)} aria-label={`Background ${k}`} className={cn('mb-5 h-9 w-9 rounded-full ring-2 transition-transform', bgKey === k ? 'scale-110 ring-white' : 'ring-white/30')} style={{ background: v }} />
        ))}
      </div>
      {step === 'share' && (
        <div className="fixed inset-0 z-10 flex items-end bg-black/50" onClick={() => setStep('write')}>
          <motion.div initial={{ y: 200 }} animate={{ y: 0 }} onClick={(e) => e.stopPropagation()} className="glass-strong w-full rounded-t-[2rem] p-5 pb-safe">
            <p className="mb-3 font-display text-lg font-medium">Share to</p>
            <AudiencePicker value={audience} onChange={setAudience} />
            <button onClick={() => void post()} disabled={busy} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-[1.25rem] bg-ember-gradient text-noir font-semibold shadow-glow">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Post story <Send className="h-4 w-4" /></>}
            </button>
          </motion.div>
        </div>
      )}
    </motion.div>,
    document.body,
  );
}
