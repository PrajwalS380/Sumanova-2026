import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/providers/ToastProvider';
import { contactSyncOn, contactsSupported, defaultCountryCode, phoneApi, stopContactSync, syncContacts } from '@/lib/contacts';

/** Settings → Account: optional private phone number (only the last 4 digits are ever shown). */
export function PhoneRow({ uid }: { uid: string }) {
  const toast = useToast();
  const [last4, setLast4] = useState<string | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void phoneApi.mine(uid).then(setLast4).catch(() => setLast4(null));
  }, [uid]);

  async function save(raw: string) {
    setBusy(true);
    try {
      const l4 = await phoneApi.set(raw);
      setLast4(l4);
      setEditing(false);
      setValue('');
      toast(l4 ? 'Number saved — friends with it in their contacts can find you' : 'Number removed', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); void save(value); }} className="flex items-center gap-2 px-3.5 py-[9px]">
        <input autoFocus type="tel" inputMode="tel" autoComplete="tel" value={value} onChange={(e) => setValue(e.target.value)} placeholder={`+${defaultCountryCode()} 98765 43210`} aria-label="Phone number" className="h-10 min-w-0 flex-1 rounded-xl bg-[#F1F1F4] px-3 text-[15px] font-semibold outline-none" />
        <button type="submit" disabled={busy || !value.trim()} className="h-10 rounded-xl bg-ember-flame px-3.5 text-sm font-extrabold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</button>
        <button type="button" onClick={() => setEditing(false)} className="h-10 rounded-xl bg-[#F1F1F4] px-3 text-sm font-extrabold">Cancel</button>
      </form>
    );
  }
  return (
    <div className="flex items-center gap-3 px-3.5 py-[13px] text-[15px] font-semibold">
      <span className="flex-1">Phone <span className="block text-xs font-normal text-ink-mute">Private — never shown on your profile</span></span>
      {last4 === undefined ? (
        <Loader2 className="h-4 w-4 animate-spin text-ink-mute" />
      ) : last4 ? (
        <>
          <span className="text-ink-mute">•••• {last4}</span>
          <button onClick={() => setEditing(true)} className="text-sm font-extrabold text-ember-flame">Change</button>
          <button onClick={() => void save('')} disabled={busy} className="text-sm font-extrabold text-ink-mute">Remove</button>
        </>
      ) : (
        <button onClick={() => setEditing(true)} className="text-sm font-extrabold text-ember-flame">Add</button>
      )}
    </div>
  );
}

/** Settings → Privacy: contact sync on/off (phone app only). */
export function ContactSyncToggle({ uid }: { uid: string }) {
  const toast = useToast();
  const [on, setOn] = useState(() => contactSyncOn(uid));
  const [busy, setBusy] = useState(false);
  if (!contactsSupported) return null;
  async function change(v: boolean) {
    setBusy(true);
    try {
      if (v) {
        const r = await syncContacts(uid, { ask: true, force: true });
        if (r === 'denied') return toast('Allow Contacts for SUMANOVA in your phone settings', 'error');
        setOn(true);
      } else {
        await stopContactSync(uid);
        setOn(false);
        toast('Contacts removed from SUMANOVA', 'success');
      }
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }
  return <Toggle label="Sync my contacts" description="Find friends from your phone book. Numbers are scrambled on your phone first; turning this off deletes them from our server." checked={on} disabled={busy} onChange={(v) => void change(v)} />;
}
