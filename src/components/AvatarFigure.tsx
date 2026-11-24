import { memo } from 'react';
import type { AuraColor } from '@/lib/types';
import { Avatar } from './Avatar';

/** Full-body avatar picture (map pins, profile heroes); falls back to the face circle. */
export const AvatarFigure = memo(function AvatarFigure({ name, bodyUrl, faceUrl, aura, height = 120, className }: { name: string; bodyUrl?: string | null; faceUrl?: string | null; aura?: AuraColor; height?: number; className?: string }) {
  if (bodyUrl) {
    return <img src={bodyUrl} alt="" loading="lazy" decoding="async" draggable={false} className={className} style={{ height, width: 'auto', objectFit: 'contain' }} />;
  }
  return (
    <span className={className} style={{ display: 'inline-grid', height, alignItems: 'end' }}>
      <Avatar name={name} url={faceUrl} aura={aura} size={Math.round(height * 0.55)} />
    </span>
  );
});
