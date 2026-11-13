import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { cn } from '@/lib/cn';

/** Bottom sheet with drag-to-dismiss, backdrop tap and Escape support. */
export function Sheet({ open, onClose, children, title, className }: { open: boolean; onClose: () => void; children: ReactNode; title?: string; className?: string }) {
  const drag = useDragControls();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.button aria-label="Close" className="absolute inset-0 bg-black/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => (info.offset.y > 100 || info.velocity.y > 600) && onClose()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            className={cn('glass-strong relative max-h-[88vh] w-full max-w-lg overflow-hidden rounded-t-[2rem] pb-safe', className)}
          >
            <div className="flex cursor-grab touch-none justify-center pb-1 pt-3" onPointerDown={(e) => drag.start(e)}>
              <span className="h-1.5 w-10 rounded-full bg-white/20" />
            </div>
            {title && <h2 className="px-5 pb-2 pt-1 font-display text-lg font-semibold">{title}</h2>}
            <div className="max-h-[calc(88vh-3rem)] overflow-y-auto overscroll-contain">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function SheetItem({ icon, label, onClick, danger, disabled }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={cn('flex w-full items-center gap-3 px-5 py-3.5 text-left text-[15px] transition-colors hover:bg-white/5 active:bg-white/10 disabled:opacity-40', danger ? 'text-aurora-coral' : 'text-ink')}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/5">{icon}</span>
      {label}
    </button>
  );
}
