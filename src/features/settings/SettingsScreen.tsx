import { useState, type ReactNode } from 'react';
import { LogOut, MonitorSmartphone, ShieldCheck, Sparkles } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Toggle } from '@/components/ui/Toggle';
import { Segmented } from '@/components/ui/Segmented';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { supabase } from '@/lib/supabase';
import type { PrivacySettings, UserSettings } from '@/lib/types';
import { brand } from '@/config/brand';

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">
        {icon}
        {title}
      </h2>
      <div className="glass divide-y divide-white/5 overflow-hidden rounded-3xl">{children}</div>
    </section>
  );
}

export default function SettingsScreen() {
  const { session, privacy, settings, setPrivacy, setSettings, signOut } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<'local' | 'global' | null>(null);

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
    <div className="pb-16">
      <ScreenHeader title="Settings" back />
      <div className="mx-auto max-w-md space-y-6 px-4">
        {privacy && (
          <Section title="Privacy" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
            <Segmented label="Who can message me" value={privacy.who_can_message} options={[{ value: 'friends', label: 'Friends' }, { value: 'everyone', label: 'Everyone' }]} onChange={(v) => updatePrivacy({ who_can_message: v })} />
            <Segmented label="Who can call me" value={privacy.who_can_call} options={[{ value: 'friends', label: 'Friends' }, { value: 'everyone', label: 'Everyone' }, { value: 'nobody', label: 'Nobody' }]} onChange={(v) => updatePrivacy({ who_can_call: v })} />
            <Segmented label="Who can view my story" value={privacy.who_can_view_story === 'custom' ? 'friends' : privacy.who_can_view_story} options={[{ value: 'friends', label: 'Friends' }, { value: 'everyone', label: 'Everyone' }]} onChange={(v) => updatePrivacy({ who_can_view_story: v })} />
            <Toggle label="Show when I was last active" checked={privacy.show_last_seen} onChange={(v) => updatePrivacy({ show_last_seen: v })} />
            <Toggle label="Appear in friend suggestions" description="Others can still add you by exact username" checked={privacy.show_in_discovery} onChange={(v) => updatePrivacy({ show_in_discovery: v })} />
            <Toggle label="Ghost mode" description="Hide your location on the map (on by default)" checked={privacy.ghost_mode} onChange={(v) => updatePrivacy({ ghost_mode: v })} />
          </Section>
        )}

        {settings && (
          <Section title="Experience" icon={<Sparkles className="h-3.5 w-3.5" />}>
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
          </div>
        </Section>

        <p className="pb-4 text-center text-xs text-ink-faint">
          {brand.name} · v{__APP_VERSION__}
        </p>
      </div>
    </div>
  );
}
