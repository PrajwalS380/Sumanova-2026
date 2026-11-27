import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, KeyRound, Loader2, LogOut, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { deviceKey, exportMyData, securityApi, type DeviceRow } from '@/lib/security';
import { saveMedia } from '@/lib/saveMedia';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { deviceApproval, type DeviceRequest } from '@/lib/deviceApproval';

const ROW = 'flex w-full items-center gap-3 px-3.5 py-[13px] text-left text-[15px] font-semibold';

/** Settings → Security: two-step login (TOTP), devices + sign out others, download my data. */
export function SecuritySection() {
  const { session } = useAuth();
  const toast = useToast();
  const [factors, setFactors] = useState<{ id: string }[] | null>(null);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [showDevices, setShowDevices] = useState(false);
  const load = () => void securityApi.mfa().then(setFactors).catch(() => setFactors([]));
  useEffect(load, []);
  const [approve, setApprove] = useState(false);
  const [requests, setRequests] = useState<DeviceRequest[]>([]);
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    void deviceApproval.enabled(uid).then(setApprove);
    const pull = () => void deviceApproval.requests().then(setRequests).catch(() => undefined);
    pull();
    const t = setInterval(pull, 15000);
    return () => clearInterval(t);
  }, [uid]);
  async function toggleApproval(v: boolean) {
    try {
      await deviceApproval.set(v);
      setApprove(v);
      toast(v ? 'New devices now need your approval' : 'Device approval is off', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function decide(r: DeviceRequest, ok: boolean) {
    try {
      await deviceApproval.decide(r.id, ok);
      setRequests((l) => l.filter((x) => x.id !== r.id));
      if (!ok) await securityApi.signOutOthers().catch(() => undefined);
      toast(ok ? `${r.device} approved` : 'Blocked. Change your password if you didn’t sign in.', ok ? 'success' : 'info');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  async function startEnroll() {
    setBusy('enroll');
    try {
      // Clean up any half-finished setup first, then create a fresh one.
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all ?? []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `SUMANOVA ${new Date().toISOString().slice(0, 10)}` });
      if (error) throw error;
      const qr = await QRCode.toDataURL(data.totp.uri, { margin: 1, width: 220 });
      setEnroll({ id: data.id, qr, secret: data.totp.secret });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }
  async function confirmEnroll() {
    if (!enroll) return;
    setBusy('verify');
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code });
      if (error) throw new Error('That code didn’t work — try the newest one');
      setEnroll(null);
      setCode('');
      load();
      toast('Two-step login is on', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }
  async function disable() {
    if (!factors?.length || !window.confirm('Turn off two-step login?')) return;
    setBusy('off');
    try {
      for (const f of factors) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (error) throw error;
      }
      load();
      toast('Two-step login is off', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }
  async function download() {
    if (!session) return;
    setBusy('data');
    try {
      const r = await saveMedia(await exportMyData(session.user.id), `sumanova-my-data-${new Date().toISOString().slice(0, 10)}.json`);
      if (r === 'saved') toast('Your data was saved', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }

  const on = !!factors?.length;
  return (
    <>
      {requests.map((r) => (
        <div key={r.id} className="mx-3 my-2 rounded-2xl bg-ember-gold/15 p-3.5">
          <p className="text-[15px] font-extrabold">Sign-in waiting: {r.device}</p>
          <p className="text-xs text-ink-mute">{new Date(r.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} — was this you?</p>
          <div className="mt-2.5 flex gap-2">
            <button onClick={() => void decide(r, true)} className="h-10 flex-1 rounded-xl bg-ink text-sm font-extrabold text-white">Approve</button>
            <button onClick={() => void decide(r, false)} className="h-10 flex-1 rounded-xl bg-white text-sm font-extrabold text-ember-rose">Not me</button>
          </div>
        </div>
      ))}
      <Toggle label="Approve new devices" description="A new phone or browser can’t open your chats, snaps or memories until you approve it here" checked={approve} onChange={(v) => void toggleApproval(v)} />
      <button onClick={() => (on ? void disable() : void startEnroll())} disabled={factors === null || !!busy} className={ROW}>
        <KeyRound className="h-5 w-5" />
        <span className="flex-1">Two-step login<span className="block text-xs font-normal text-ink-mute">{on ? 'On — a code from your authenticator app is needed to sign in' : 'Add a code from an authenticator app when signing in'}</span></span>
        <span className="text-sm font-extrabold text-ember-flame">{busy === 'enroll' || busy === 'off' ? <Loader2 className="h-4 w-4 animate-spin" /> : on ? 'Turn off' : 'Set up'}</span>
      </button>
      <button onClick={() => { setShowDevices(true); void securityApi.devices().then(setDevices).catch(() => setDevices([])); }} className={ROW}>
        <Smartphone className="h-5 w-5" />
        <span className="flex-1">Devices &amp; sign-ins<span className="block text-xs font-normal text-ink-mute">We alert you when a new device signs in</span></span>
      </button>
      <button onClick={() => void download()} disabled={!!busy} className={ROW}>
        <Download className="h-5 w-5" />
        <span className="flex-1">Download my data<span className="block text-xs font-normal text-ink-mute">Profile, friends, messages you sent, stories, memories list</span></span>
        {busy === 'data' && <Loader2 className="h-4 w-4 animate-spin" />}
      </button>

      <Sheet open={!!enroll} onClose={() => setEnroll(null)} title="Set up two-step login">
        {enroll && (
          <div className="space-y-3 px-5 pb-6 text-center">
            <p className="text-sm text-ink-mute">Scan this with an authenticator app (Google Authenticator, Microsoft Authenticator, Aegis… all free), then type the 6-digit code it shows.</p>
            <img src={enroll.qr} alt="Two-step login QR code" className="mx-auto h-52 w-52 rounded-2xl bg-white p-2" />
            <p className="select-all break-all rounded-xl bg-[#F1F1F4] px-3 py-2 font-mono text-xs">{enroll.secret}</p>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" aria-label="6-digit code" className="h-12 w-full rounded-2xl bg-[#F1F1F4] text-center text-xl font-black tracking-[0.4em] outline-none" />
            <button onClick={() => void confirmEnroll()} disabled={code.length !== 6 || busy === 'verify'} className="h-12 w-full rounded-2xl bg-ink text-[15px] font-extrabold text-white disabled:opacity-50">{busy === 'verify' ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Turn on'}</button>
          </div>
        )}
      </Sheet>

      <Sheet open={showDevices} onClose={() => setShowDevices(false)} title="Devices & sign-ins">
        <div className="px-4 pb-6">
          {devices === null ? (
            <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-mute" /></div>
          ) : (
            <ul className="space-y-1.5">
              {devices.length === 0 && <li className="py-3 text-sm text-ink-mute">No sign-ins recorded yet.</li>}
              {devices.map((d) => (
                <li key={d.device_key} className="flex items-center gap-3 rounded-2xl bg-[#F1F1F4] px-3.5 py-3">
                  <Smartphone className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold">{d.device}{d.device_key === deviceKey() ? ' · this device' : ''}</span>
                    <span className="block text-xs text-ink-mute">Last sign-in {new Date(d.last_seen).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {d.sign_ins}×</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button onClick={async () => { try { await securityApi.signOutOthers(); toast('Signed out on all other devices', 'success'); } catch (e) { toast((e as Error).message, 'error'); } }} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[15px] font-extrabold text-white"><LogOut className="h-4 w-4" /> Sign out all other devices</button>
        </div>
      </Sheet>
    </>
  );
}
