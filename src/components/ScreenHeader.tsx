import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export function ScreenHeader({ title, back, right }: { title: ReactNode; back?: boolean; right?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-night via-night/80 to-transparent px-4 pb-4 pt-safe">
      {back && (
        <button
          onClick={() => navigate(-1)}
          className="glass -ml-1 grid h-10 w-10 place-items-center rounded-full"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <h1 className="flex-1 font-display text-[22px] font-semibold tracking-tight">{title}</h1>
      {right}
    </header>
  );
}
