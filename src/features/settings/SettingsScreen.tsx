import { useEffect, useState, type ReactNode } from 'react';
import { Bell } from 'lucide-react';
import { currentSubscription, disablePush, enablePush, pushSupported } from '@/lib/push';
import { isNative } from '@/lib/platform';
import { LogOut, MonitorSmartphone, ShieldCheck, Trash2 } from 'lucide-react';
import { deleteMyAccount } from '@/lib/account';
import { Link, useNavigate } from 'react-router-dom';
import { Toggle } from '@/components/ui/Toggle';
import { Segmented } from '@/components/ui/Segmented';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { supabase } from '@/lib/supabase';
import type { PrivacySettings, UserSettings } from '@/lib/types';
import { brand } from '@/config/brand';
import { ChevronLeft, Palette, UserRound } from 'lucide-react';
import { Ghost } from '@/components/ui/Ghost';
import { ACCENTS, CANVASES, getAccent, getCanvas, setAccent, setCanvas } from '@/lib/accent';
import { APP_ICONS, appIconSupported, getAppIcon, setAppIcon, type AppIconId } from '@/lib/appIcon';
import { platform } from '@/lib/platform';
import { ContactSyncToggle, PhoneRow } from './PhoneRows';
import { SecuritySection } from './SecuritySection';
import { KeyRound } from 'lucide-react';
import { DisplayRows } from './DisplayRows';
import { LockRows } from './LockRows';

function AccentPicker() {
  const [cur, setCur] = useState(() => getAccent().id);
  return (
    <div className="flex items-center gap-3 px-3.5 py-[13px]">
      <span className="flex-1 text-[15px] font-semibold">Theme colour</span>
      <span className="flex gap-1.5">
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-label={a.label}
            aria-pressed={cur === a.id}
            onClick={() => setCur(setAccent(a.id).id)}
            className="h-[26px] w-[26px] rounded-full transition-transform active:scale-90"
            style={{ background: a.main, boxShadow: cur === a.id ? `0 0 0 2px #fff, 0 0 0 4px ${a.main}` : undefined }}
          />
        ))}
      </span>
    </div>
  );
}

function CanvasPicker() {
  const [cur, setCur] = useState(() => getCanvas().id);
  async function pick(id: string) {
    const c = setCanvas(id);
    setCur(c.id);
    if (isNative && platform === 'android') {
      const { StatusBar } = await import('@capacitor/status-bar');
      await StatusBar.setBackgroundColor({ color: c.hex }).catch(() => undefined);
    }
  }
  return (
    <div className="flex items-center gap-3 px-3.5 py-[13px]">
      <span className="flex-1 text-[15px] font-semibold">Background</span>
      <span className="flex gap-1.5">
        {CANVASES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-label={c.label}
            aria-pressed={cur === c.id}
            onClick={() => void pick(c.id)}
            className="h-[26px] w-[26px] rounded-full border border-ink/15 transition-transform active:scale-90"
            style={{ background: c.hex, boxShadow: cur === c.id ? '0 0 0 2px #fff, 0 0 0 4px #111' : undefined }}
          />
        ))}
      </span>
    </div>
  );
}

function AppIconPicker() {
  const toast = useToast();
  const [cur, setCur] = useState<AppIconId | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void getAppIcon().then((i) => {
      setCur(i);
      setReady(i !== null);
    });
  }, []);
  if (!appIconSupported || !ready) return null;
  async function pick(id: AppIconId) {
    try {
      await setAppIcon(id);
      setCur(id);
      toast('App icon changed — your home screen may take a moment to update', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  return (
    <div className="flex items-center gap-3 px-3.5 py-[13px]">
      <span className="flex-1 text-[15px] font-semibold">App icon</span>
      <span className="flex gap-1.5">
        {APP_ICONS.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-label={`${a.id} icon`}
            aria-pressed={cur === a.id}
            onClick={() => void pick(a.id)}
            className="grid h-[26px] w-[26px] place-items-center rounded-[8px] transition-transform active:scale-90"
            style={{ background: a.hex, boxShadow: cur === a.id ? `0 0 0 2px #fff, 0 0 0 4px ${a.hex}` : undefined }}
          >
            <svg viewBox="7 7 50 50" className="h-[18px] w-[18px]" aria-hidden><path d="M32 7C37.8 20 44 26.2 57 32 44 37.8 37.8 44 32 57 26.2 44 20 37.8 7 32 20 26.2 26.2 20 32 7Z" fill="#fff" stroke="#111" strokeWidth="4" strokeLinejoin="round" /></svg>
          </button>
        ))}
      </span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h2 className="px-1 pb-1.5 pt-4 text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-mute">
        <span className="sr-only">{icon}</span>
        {title}
      </h2>
      <div className="relative isolate divide-y divide-[#F1F1F4] overflow-hidden rounded-tile bg-white">
        <Ghost size={120} opacity={0.06} className="-right-4 -top-6 [&>svg]:h-full [&>svg]:w-full">{icon}</Ghost>
        {children}
      </div>
    </section>
  );
}

export default function SettingsScreen() {
  const { session, profile, privacy, settings, setPrivacy, setSettings, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState<'local' | 'global' | null>(null);
  const [push, setPush] = useState(false);
  useEffect(() => {
    void currentSubscription().then((s) => setPush(!!s)).catch(() => undefined);
  }, []);
  async function togglePush(on: boolean) {
    try {
      if (on) {
        const r = await enablePush(session!.user.id);
        if (r === 'denied') return toast('Notifications are blocked — allow them in your browser’s site settings', 'error');
        if (r === 'unsupported') return toast('Push isn’t supported in this browser', 'error');
        setPush(true);
        toast('Push notifications on', 'success');
      } else {
        await disablePush();
        setPush(false);
      }
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  /** Optimistic update with rollback if the server rejects it. */
  async function updatePrivacy(patch: Partial<PrivacySettings>) {
    if (!privacy) return;
    const prev = privacy;
    setPrivacy({ ...privacy, ...patch });
    const { error } = await supabase.from('privacy_settings').update(patch).eq('user_id', privacy.user_id);
    if (error) {
      setPrivacy(prev);
      toast('Couldn’t save — check your connection', 'error');
    }
  }
  async function updateSettings(patch: Partial<UserSettings>) {
    if (!settings) return;
    const prev = settings;
    setSettings({ ...settings, ...patch });
    const { error } = await supabase.from('user_settings').update(patch).eq('user_id', settings.user_id);
    if (error) {
      setSettings(prev);
      toast('Couldn’t save — check your connection', 'error');
    }
  }

  return (
    <div className="min-h-full bg-noir pb-16">
      <header className="flex items-center gap-2 px-3.5 pt-safe">
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-ink active:scale-90"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 text-center text-lg font-extrabold">Settings</h1>
        <span className="w-10" aria-hidden />
      </header>
      <div className="mx-auto max-w-md px-4">
        {profile && (
          <Section title="Account" icon={<UserRound className="h-3.5 w-3.5" />}>
            <Link to="/profile/edit" className="flex items-center gap-3 px-3.5 py-[13px] text-[15px] font-semibold"><span className="flex-1">Name</span><span className="text-ink-mute">{profile.display_name}</span></Link>
            <Link to="/profile/edit" className="flex items-center gap-3 px-3.5 py-[13px] text-[15px] font-semibold"><span className="flex-1">Username</span><span className="text-ink-mute">@{profile.username}</span></Link>
            <div className="flex items-center gap-3 px-3.5 py-[13px] text-[15px] font-semibold"><span className="flex-1">Email</span><span className="truncate text-ink-mute">{session?.user.email}</span></div>
            {session && <PhoneRow uid={session.user.id} />}
            <Link to="/profile/photo" className="flex items-center gap-3 px-3.5 py-[13px] text-[15px] font-semibold"><span className="flex-1">Profile picture</span><span className="text-ink-mute">{profile.photo_mode ? 'Photo' : 'Avatar face'} ›</span></Link>
            {settings && (
              <label className="flex items-center gap-3 px-3.5 py-[11px] text-[15px] font-semibold">
                <span className="flex-1">Birthday</span>
                <input type="date" value={settings.date_of_birth ?? ''} max={new Date(new Date().getFullYear() - 13, new Date().getMonth(), new Date().getDate()).toISOString().slice(0, 10)} min="1900-01-02" onChange={(e) => e.target.value && updateSettings({ date_of_birth: e.target.value })} className="rounded-xl bg-ink/[0.05] px-2.5 py-1.5 text-[15px] text-ink-soft" aria-label="Birthday" />
              </label>
            )}
            <Link to="/accounts" className="flex items-center gap-3 px-3.5 py-[13px] text-[15px] font-semibold"><span className="flex-1">Switch account</span><span className="text-ink-mute">Saved on this phone ›</span></Link>
          </Section>
        )}
        {privacy && (
          <Section title="Privacy" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
            <Segmented label="Who can message me" value={privacy.who_can_message} options={[{ value: 'friends', label: 'Friends' }, { value: 'everyone', label: 'Everyone' }]} onChange={(v) => updatePrivacy({ who_can_message: v })} />
            <Segmented label="Who can call me" value={privacy.who_can_call} options={[{ value: 'friends', label: 'Friends' }, { value: 'everyone', label: 'Everyone' }, { value: 'nobody', label: 'Nobody' }]} onChange={(v) => updatePrivacy({ who_can_call: v })} />
            <Segmented label="Who can view my story" value={privacy.who_can_view_story === 'custom' ? 'friends' : privacy.who_can_view_story} options={[{ value: 'friends', label: 'Friends' }, { value: 'everyone', label: 'Everyone' }]} onChange={(v) => updatePrivacy({ who_can_view_story: v })} />
            <Toggle label="Show when I was last active" checked={privacy.show_last_seen} onChange={(v) => updatePrivacy({ show_last_seen: v })} />
            <Toggle label="Appear in friend suggestions" description="Others can still add you by exact username" checked={privacy.show_in_discovery} onChange={(v) => updatePrivacy({ show_in_discovery: v })} />
            <Toggle label="Let people find me by phone number" description="Only people who already have your number" checked={privacy.find_by_phone ?? true} onChange={(v) => updatePrivacy({ find_by_phone: v })} />
            {session && <ContactSyncToggle uid={session.user.id} />}
            <Toggle label="Show my birthday to friends" description="Day and month only — never the year" checked={privacy.show_birthday ?? true} onChange={(v) => updatePrivacy({ show_birthday: v })} />
            <Toggle label="Show my battery on the map" description="Friends see it while you share your location" checked={privacy.share_battery ?? true} onChange={(v) => updatePrivacy({ share_battery: v })} />
            <Toggle label="Ghost mode" description="Hide your location on the map (on by default)" checked={privacy.ghost_mode} onChange={(v) => updatePrivacy({ ghost_mode: v })} />
          </Section>
        )}

        <Section title="Security" icon={<KeyRound className="h-3.5 w-3.5" />}>
          <LockRows />
          <SecuritySection />
        </Section>

        <Section title="Notifications" icon={<Bell className="h-3.5 w-3.5" />}>
          {isNative ? (
            <p className="px-4 py-3.5 text-sm text-ink-mute">The Android app shows notifications while SUMANOVA is open or in the background. Notifications when the app is fully closed need the optional Firebase setup described in the owner handbook.</p>
          ) : pushSupported() ? (
            <Toggle label="Push notifications" description="Messages, calls, snaps and friend activity — even when SUMANOVA is closed" checked={push} onChange={(v) => void togglePush(v)} />
          ) : (
            <p className="px-4 py-3.5 text-sm text-ink-mute">This browser doesn’t support push. On iPhone, add SUMANOVA to your Home Screen first (iOS 16.4+).</p>
          )}
        </Section>

        {settings && (
          <Section title="Look & feel" icon={<Palette className="h-3.5 w-3.5" />}>
            <DisplayRows />
            <AccentPicker />
            <CanvasPicker />
            <AppIconPicker />
            <Toggle label="Reduce motion" description="Calmer transitions and no background animation" checked={settings.reduce_motion} onChange={(v) => updateSettings({ reduce_motion: v })} />
            <Toggle label="Haptic feedback" description="Subtle vibrations on supported Android phones" checked={settings.haptics} onChange={(v) => updateSettings({ haptics: v })} />
          </Section>
        )}

        <Section title="Account" icon={<MonitorSmartphone className="h-3.5 w-3.5" />}>
          <div className="px-4 py-3.5">
            <p className="text-[15px] font-medium">Signed in as</p>
            <p className="text-sm text-ink-mute">{session?.user.email}</p>
          </div>
          <div className="space-y-2 p-3">
            <Button
              variant="glass"
              block
              loading={busy === 'local'}
              onClick={async () => {
                setBusy('local');
                await signOut(false);
              }}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
            <Button
              variant="danger"
              block
              loading={busy === 'global'}
              onClick={async () => {
                if (!confirm('Sign out of SUMANOVA on every device?')) return;
                setBusy('global');
                await signOut(true);
              }}
            >
              Sign out of all devices
            </Button>
            <Button
              variant="danger"
              block
              onClick={async () => {
                const typed = window.prompt('This permanently deletes your account, chats, snaps, stories, memories and avatar. Type DELETE to confirm.');
                if (typed !== 'DELETE') return;
                try {
                  await deleteMyAccount(session!.user.id);
                  await signOut(false);
                } catch (e) {
                  toast((e as Error).message, 'error');
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete my account
            </Button>
          </div>
        </Section>

        <p className="pb-4 text-center text-xs text-ink-faint">
          {brand.name} · v{__APP_VERSION__}
        </p>
      </div>
    </div>
  );
}
