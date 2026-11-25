import { useEffect, useState } from 'react';
import { AtSign, Globe2, Lock, MapPin, Users, UsersRound } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Toggle } from '@/components/ui/Toggle';
import { useInbox } from '@/providers/InboxProvider';
import { conversationName } from '@/lib/chat/preview';
import type { Friend } from '@/lib/chat/types';
import type { Audience } from '@/lib/social/api';
import { cn } from '@/lib/cn';

export interface StoryChoice {
  audience: Audience;
  custom: string[];
  group: string | null;
  mentions: string[];
  onMap: boolean;
}
export const DEFAULT_STORY: StoryChoice = { audience: 'friends', custom: [], group: null, mentions: [], onMap: false };

const OPTS: { v: Audience; label: string; desc: string; icon: typeof Users }[] = [
  { v: 'friends', label: 'Friends', desc: 'All your friends', icon: Users },
  { v: 'everyone', label: 'Public', desc: 'Anyone on SUMANOVA', icon: Globe2 },
  { v: 'custom', label: 'Private', desc: 'Only people you pick', icon: Lock },
  { v: 'group', label: 'Group', desc: 'Members of a group chat', icon: UsersRound },
];

/** Story audience (friends, public, private list, group), @mentions and "show on map". */
export function StoryOptions({ value, onChange, friends }: { value: StoryChoice; onChange: (c: StoryChoice) => void; friends: Friend[] }) {
  const { conversations } = useInbox();
  const groups = conversations.filter((c) => c.kind === 'group');
  const [mentionQuery, setMentionQuery] = useState('');
  const set = (p: Partial<StoryChoice>) => onChange({ ...value, ...p });
  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  useEffect(() => {
    if (value.audience === 'group' && !value.group && groups[0]) set({ group: groups[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.audience]);

  const mentionable = friends.filter((f) => !mentionQuery || f.display_name.toLowerCase().includes(mentionQuery.toLowerCase()) || f.username.includes(mentionQuery.toLowerCase().replace(/^@/, '')));
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        {OPTS.map((o) => (
          <button key={o.v} type="button" onClick={() => set({ audience: o.v })} aria-pressed={value.audience === o.v} className={cn('flex items-center gap-2 rounded-2xl p-3 text-left', value.audience === o.v ? 'bg-ink text-white' : 'bg-white')}>
            <o.icon className="h-5 w-5 shrink-0" />
            <span><span className="block text-sm font-extrabold">{o.label}</span><span className="block text-[11px] opacity-70">{o.desc}</span></span>
          </button>
        ))}
      </div>

      {value.audience === 'custom' && (
        <div className="rounded-2xl bg-white p-2.5">
          <p className="px-1 pb-1.5 text-xs font-bold text-ink-mute">{value.custom.length ? `${value.custom.length} can see this story` : 'Pick who can see it'}</p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {friends.map((f) => (
              <button key={f.id} type="button" onClick={() => set({ custom: toggleIn(value.custom, f.id) })} className={cn('flex w-16 shrink-0 flex-col items-center gap-1 rounded-2xl p-1.5 text-[11px] font-bold', value.custom.includes(f.id) ? 'bg-ink text-white' : 'bg-[#F1F1F4]')}>
                <Avatar name={f.display_name} url={f.avatar_url} aura={f.aura_color} size={40} />
                <span className="w-full truncate text-center">{f.display_name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {value.audience === 'group' && (
        <div className="rounded-2xl bg-white p-2.5">
          {groups.length === 0 ? (
            <p className="px-1 text-sm text-ink-mute">You’re not in any group chats yet.</p>
          ) : (
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {groups.map((g) => (
                <button key={g.id} type="button" onClick={() => set({ group: g.id })} className={cn('shrink-0 rounded-xl px-3 py-2 text-sm font-extrabold', value.group === g.id ? 'bg-ink text-white' : 'bg-[#F1F1F4]')}>{conversationName(g)}</button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl bg-white p-2.5">
        <label className="flex items-center gap-2 px-1">
          <AtSign className="h-4 w-4 text-ink-mute" />
          <input value={mentionQuery} onChange={(e) => setMentionQuery(e.target.value)} placeholder="Mention friends" aria-label="Mention friends" className="h-9 flex-1 bg-transparent text-sm font-semibold outline-none" />
        </label>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pt-1">
          {mentionable.slice(0, 30).map((f) => (
            <button key={f.id} type="button" onClick={() => set({ mentions: toggleIn(value.mentions, f.id) })} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold', value.mentions.includes(f.id) ? 'bg-ember-flame text-white' : 'bg-[#F1F1F4]')}>@{f.username}</button>
          ))}
        </div>
      </div>

      {value.audience === 'everyone' && (
        <div className="overflow-hidden rounded-2xl bg-white">
          <Toggle label="Show on the map" description="Pinned to your area (about 1 km), never your exact spot" checked={value.onMap} onChange={(v) => set({ onMap: v })} />
        </div>
      )}
      <p className="flex items-center gap-1.5 px-1 text-[11px] text-ink-faint"><MapPin className="h-3 w-3" /> Stories disappear after 24 hours unless you add them to a highlight.</p>
    </div>
  );
}
