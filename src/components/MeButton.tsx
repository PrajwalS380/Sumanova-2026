import { Link } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { Avatar } from './Avatar';

/** My avatar's face — the profile button, top-left on every main tab. */
export function MeButton({ size = 40, className }: { size?: number; className?: string }) {
  const { profile } = useAuth();
  return (
    <Link to="/profile" aria-label="My profile" className={className ?? 'shrink-0 rounded-full shadow-[0_4px_14px_rgba(30,42,74,0.16)]'}>
      <Avatar name={profile?.display_name ?? 'Me'} url={profile?.avatar_url} size={size} ring={false} />
    </Link>
  );
}
