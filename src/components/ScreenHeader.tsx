import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export function ScreenHeader({ title, back, right, kicker }: { title: ReactNode; back?: boolean; right?: ReactNode; kicker?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-noir via-noir/85 to-transparent px-4 pb-4 pt-safe">
      {back && (
        <button
          onClick={() => navigate(-1)}
          className="glass -ml-1 grid h-10 w-10 place-items-center rounded-full"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {kicker && <p className="eyebrow -mb-0.5 truncate text-ember-amber/80">{kicker}</p>}
        <h1 className="truncate font-display text-[28px] font-medium leading-tight tracking-tight">{title}</h1>
      </div>
      {right}
    </header>
  );
}
