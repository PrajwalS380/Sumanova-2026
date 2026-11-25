import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { MeButton } from './MeButton';

/**
 * Screen header. Root sections show my avatar face (→ profile);
 * nested screens show back.
 */
export function ScreenHeader({ title, back, right, kicker }: { title: ReactNode; back?: boolean; right?: ReactNode; kicker?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2.5 bg-gradient-to-b from-noir via-noir/85 to-transparent px-4 pb-4 pt-safe">
      {back ? (
        <button onClick={() => navigate(-1)} className="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white" aria-label="Back">
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : (
        <MeButton className="-ml-1 shrink-0 rounded-full" />
      )}
      <div className="min-w-0 flex-1">
        {kicker && <p className="eyebrow -mb-0.5 truncate text-ember-flame">{kicker}</p>}
        <h1 className="truncate font-display text-[30px] leading-tight">{title}</h1>
      </div>
      {right}
    </header>
  );
}
