import { memo } from 'react';
import type { SceneId } from '@/lib/types';
import { cn } from '@/lib/cn';

export const SCENES: { id: SceneId; label: string }[] = [
  { id: 'dusk', label: 'Dusk city' },
  { id: 'mural', label: 'Mural' },
  { id: 'beach', label: 'Beach' },
  { id: 'night', label: 'Night city' },
];

const SKY: Record<SceneId, string> = {
  dusk: 'linear-gradient(180deg, #ffb8cf 0%, #d7b9ff 45%, #9fb8ff 100%)',
  mural: '#E9ECF8',
  beach: 'linear-gradient(180deg, #bfe3ff 0%, #e6f4ff 60%)',
  night: 'linear-gradient(180deg, #111A33 0%, #3B3F8F 100%)',
};

/**
 * Original illustrated backdrops that stand behind a full-body avatar (profile,
 * avatar page, friend profile). Pure CSS shapes — no images, no animation.
 */
export const Scene = memo(function Scene({ id = 'dusk', className }: { id?: SceneId; className?: string }) {
  return (
    <div role="img" aria-label={`${SCENES.find((s) => s.id === id)?.label ?? 'Scene'} backdrop`} className={cn('relative overflow-hidden', className)} style={{ background: SKY[id] }}>
      {id === 'dusk' && (
        <>
          <div className="absolute left-[58%] top-[18%] h-[120px] w-[120px] rounded-full" style={{ background: 'radial-gradient(circle, #ffe7b8 0%, #ffd1a0 55%, rgba(255,209,160,0) 72%)' }} />
          <div className="absolute -inset-x-2.5 bottom-0 h-[46%] bg-[#6b6fb3]" style={{ clipPath: 'polygon(0 40%, 12% 40%, 12% 18%, 22% 18%, 22% 46%, 34% 46%, 34% 8%, 41% 8%, 41% 30%, 55% 30%, 55% 52%, 66% 52%, 66% 22%, 78% 22%, 78% 44%, 88% 44%, 88% 12%, 96% 12%, 96% 36%, 100% 36%, 100% 100%, 0 100%)' }} />
          <div className="absolute -inset-x-2.5 bottom-0 h-[30%] bg-[#4a4f8c]" style={{ clipPath: 'polygon(0 30%, 18% 30%, 18% 55%, 30% 55%, 30% 20%, 46% 20%, 46% 48%, 62% 48%, 62% 12%, 74% 12%, 74% 40%, 90% 40%, 90% 26%, 100% 26%, 100% 100%, 0 100%)' }} />
        </>
      )}
      {id === 'mural' && (
        <>
          <div className="absolute -left-10 -top-8 h-[220px] w-[220px] rounded-full bg-[#FFB3D6]" />
          <div className="absolute -right-12 top-8 h-[240px] w-[240px] rounded-full border-[34px] border-[#A8F0D8]" />
          <div className="absolute -bottom-10 left-10 h-[180px] w-[180px] rotate-[18deg] rounded-[28px] bg-[#3D7BFF]" />
          <div className="absolute bottom-8 right-8 h-0 w-0 border-x-[60px] border-b-[100px] border-x-transparent border-b-[#FFB020]" />
          <div className="absolute inset-x-0 top-[46%] h-3.5 opacity-70" style={{ background: 'repeating-linear-gradient(90deg, #ffffff 0 18px, transparent 18px 34px)' }} />
        </>
      )}
      {id === 'beach' && (
        <>
          <div className="absolute left-[18%] top-[14%] h-[70px] w-[70px] rounded-full bg-[#fff3c4]" />
          <div className="absolute inset-x-0 bottom-[26%] h-[22%]" style={{ background: 'linear-gradient(180deg, #4fb0d9, #2f7fc2)' }} />
          <div className="absolute inset-x-0 bottom-[44%] h-1.5 bg-white/60" />
          <div className="absolute -inset-x-[10%] bottom-0 h-[30%] bg-[#f3d9a8]" style={{ borderRadius: '50% 50% 0 0 / 30% 30% 0 0' }} />
        </>
      )}
      {id === 'night' && (
        <>
          <div className="absolute right-[16%] top-[12%] h-16 w-16 rounded-full" style={{ boxShadow: '-16px 6px 0 0 #fff3c4' }} />
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(2px 2px at 12% 20%, #fff 50%, transparent 52%), radial-gradient(2px 2px at 30% 12%, #fff 50%, transparent 52%), radial-gradient(1.5px 1.5px at 48% 26%, #fff 50%, transparent 52%), radial-gradient(2px 2px at 64% 8%, #fff 50%, transparent 52%), radial-gradient(1.5px 1.5px at 84% 30%, #fff 50%, transparent 52%), radial-gradient(2px 2px at 22% 36%, #fff 50%, transparent 52%)' }} />
          <div className="absolute -inset-x-2.5 bottom-0 h-[40%] bg-[#141b33]" style={{ clipPath: 'polygon(0 30%, 10% 30%, 10% 10%, 20% 10%, 20% 40%, 32% 40%, 32% 0, 40% 0, 40% 25%, 54% 25%, 54% 45%, 68% 45%, 68% 15%, 80% 15%, 80% 35%, 92% 35%, 92% 5%, 100% 5%, 100% 100%, 0 100%)' }} />
          <div className="absolute inset-x-0 bottom-0 h-[40%]" style={{ backgroundImage: 'radial-gradient(3px 4px at 14% 50%, #ffd166 50%, transparent 52%), radial-gradient(3px 4px at 36% 40%, #ffd166 50%, transparent 52%), radial-gradient(3px 4px at 58% 66%, #ffd166 50%, transparent 52%), radial-gradient(3px 4px at 72% 45%, #ffd166 50%, transparent 52%), radial-gradient(3px 4px at 94% 30%, #ffd166 50%, transparent 52%)' }} />
        </>
      )}
    </div>
  );
});
