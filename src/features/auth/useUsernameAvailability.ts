import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usernameProblem } from '@/lib/validation';

export type Availability = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'error';

/** Debounced server check against the is_username_available RPC. */
export function useUsernameAvailability(username: string, delay = 350): { state: Availability; message?: string } {
  const [state, setState] = useState<Availability>('idle');
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    const u = username.trim().toLowerCase();
    if (!u) {
      setState('idle');
      setMessage(undefined);
      return;
    }
    const problem = usernameProblem(u);
    if (problem) {
      setState('invalid');
      setMessage(problem);
      return;
    }
    setState('checking');
    setMessage(undefined);
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('is_username_available', { p_username: u });
      if (cancelled) return;
      if (error) {
        setState('error');
        setMessage('Couldn’t check right now');
      } else if (data) {
        setState('available');
        setMessage(`@${u} is yours`);
      } else {
        setState('taken');
        setMessage(`@${u} is taken`);
      }
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username, delay]);

  return { state, message };
}
