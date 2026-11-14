import { useId } from 'react';
import { brand } from '@/config/brand';
import { cn } from '@/lib/cn';

/** Original SUMANOVA mark: an ember planet with a cream orbit and a nova spark. */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const svg = `<defs><radialGradient id="snv-s" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="#ffe2b0"/><stop offset=".45" stop-color="#ff8a3d"/><stop offset="1" stop-color="#d9364a"/></radialGradient><linearGradient id="snv-o" x1="0" x2="1"><stop offset="0" stop-color="#f4e9da" stop-opacity=".15"/><stop offset=".6" stop-color="#f4e9da" stop-opacity=".9"/><stop offset="1" stop-color="#ffb547"/></linearGradient></defs><rect x="2" y="2" width="60" height="60" rx="18" fill="#15100d"/><circle cx="30" cy="35" r="15.5" fill="url(#snv-s)"/><ellipse cx="31" cy="35" rx="25" ry="7.5" transform="rotate(-20 31 35)" fill="none" stroke="url(#snv-o)" stroke-width="2"/><path d="M47 9.5c.7 4.4 2.4 6.3 6.5 7-4.1.7-5.8 2.6-6.5 7-.7-4.4-2.4-6.3-6.5-7 4.1-.7 5.8-2.6 6.5-7z" fill="#f4e9da"/>`.replace(/snv-/g, `snv${id}-`);
  return <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-2xl font-medium italic tracking-tight text-ink', className)}>
      {brand.name.charAt(0) + brand.name.slice(1).toLowerCase()}
    </span>
  );
}
