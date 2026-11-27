import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { firstLink, linkPreview, type LinkPreview } from '@/lib/chat/more';
import { saveData } from '@/lib/display';
import { cn } from '@/lib/cn';

/** Preview card for the first web link in a text message (title, site, picture). */
export function LinkCard({ body, mine }: { body: string | null; mine: boolean }) {
  const url = firstLink(body);
  const [p, setP] = useState<LinkPreview | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    void linkPreview(url).then((v) => alive && setP(v));
    return () => {
      alive = false;
    };
  }, [url]);
  if (!url || !p) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onPointerDown={(e) => e.stopPropagation()}
      className={cn('mt-1.5 block w-[240px] max-w-full overflow-hidden rounded-2xl', mine ? 'bg-black/15' : 'bg-ink/[0.05]')}
    >
      {p.image && !saveData() && <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-[1.91/1] w-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />}
      <span className="block px-3 py-2">
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide opacity-70"><ExternalLink className="h-3 w-3" /> {p.site}</span>
        <span className="mt-0.5 line-clamp-2 block text-[13px] font-extrabold leading-snug">{p.title}</span>
        {p.description && <span className="mt-0.5 line-clamp-2 block text-xs opacity-75">{p.description}</span>}
      </span>
    </a>
  );
}
