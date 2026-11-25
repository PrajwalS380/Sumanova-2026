import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { decryptBody } from '@/lib/e2e';

/** A secret-chat message: decrypted on this phone, never readable on the server. */
export function E2EText({ body, mine }: { body: string; mine: boolean; senderId: string | null; conversationId: string }) {
  const { session } = useAuth();
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    void decryptBody(session.user.id, body, mine).then((t) => alive && setText(t)).catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [body, mine, session]);
  return (
    <p className="whitespace-pre-wrap text-[15px] leading-snug [overflow-wrap:anywhere]">
      <Lock className="mr-1 inline h-3 w-3 -translate-y-px opacity-70" aria-label="End-to-end encrypted" />
      {failed ? <span className="italic opacity-70">Encrypted on another device</span> : text ?? <span className="opacity-60">Decrypting…</span>}
    </p>
  );
}
