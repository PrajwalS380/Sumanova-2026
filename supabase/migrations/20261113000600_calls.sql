-- SUMANOVA Phase 3: 1:1 voice/video calls.
-- Media flows peer-to-peer over WebRTC (DTLS-SRTP encrypted in transit).
-- Signalling runs over *private* Supabase Realtime channels "call:<id>" that
-- only the call's participants are authorised to join (RLS on realtime.messages).

create table public.calls (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  caller_id        uuid references auth.users (id) on delete set null,
  kind             text not null check (kind in ('voice','video')),
  status           text not null default 'ringing'
                     check (status in ('ringing','accepted','declined','missed','cancelled','ended','failed','busy')),
  started_at       timestamptz not null default now(),
  answered_at      timestamptz,
  ended_at         timestamptz,
  end_reason       text check (char_length(end_reason) <= 40)
);
create index calls_conversation on public.calls (conversation_id, started_at desc);
create index calls_active on public.calls (status) where status in ('ringing','accepted');

create table public.call_participants (
  call_id    uuid not null references public.calls (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('caller','callee')),
  joined_at  timestamptz,
  left_at    timestamptz,
  primary key (call_id, user_id)
);
create index call_participants_user on public.call_participants (user_id);

create or replace function public.is_call_participant(p_call uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.call_participants where call_id = p_call and user_id = auth.uid());
$$;

alter table public.calls enable row level security;
alter table public.call_participants enable row level security;

create policy "participants see calls" on public.calls for select to authenticated
  using (public.is_call_participant(id));
create policy "participants see participants" on public.call_participants for select to authenticated
  using (public.is_call_participant(call_id));

-- Expire calls nobody answered / left hanging (runs opportunistically inside RPCs).
create or replace function public.expire_stale_calls()
returns void language sql security definer set search_path = '' as $$
  update public.calls set status = 'missed', ended_at = now(), end_reason = 'timeout'
    where status = 'ringing' and started_at < now() - interval '60 seconds';
  update public.calls set status = 'ended', ended_at = now(), end_reason = 'stale'
    where status = 'accepted' and coalesce(answered_at, started_at) < now() - interval '6 hours';
$$;

create or replace function public.call_summary_text(c public.calls)
returns text language sql immutable set search_path = '' as $$
  select case
    when c.status = 'ended' and c.answered_at is not null then
      (case when c.kind = 'video' then '🎥 Video call · ' else '📞 Voice call · ' end)
      || to_char(make_interval(secs => extract(epoch from (coalesce(c.ended_at, now()) - c.answered_at))::int), 'FMMI:SS')
    when c.status in ('missed','cancelled','busy') then (case when c.kind = 'video' then '🎥 Missed video call' else '📞 Missed voice call' end)
    when c.status = 'declined' then (case when c.kind = 'video' then '🎥 Video call declined' else '📞 Voice call declined' end)
    when c.status = 'failed' then '⚠️ Call couldn’t connect'
    else null end;
$$;

create or replace function public.start_call(p_conversation uuid, p_kind text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_kind text;
  v_other uuid;
  v_allow text;
  v_id uuid;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if p_kind not in ('voice','video') then raise exception 'invalid call type'; end if;
  perform public.expire_stale_calls();
  select kind into v_kind from public.conversations where id = p_conversation;
  if v_kind is null or not public.is_member(p_conversation) then raise exception 'not a member'; end if;
  if v_kind <> 'direct' then raise exception 'group calls are not available yet'; end if;
  select user_id into v_other from public.conversation_members where conversation_id = p_conversation and user_id <> v_me limit 1;
  if v_other is null or public.is_blocked_between(v_me, v_other) then raise exception 'cannot call this user'; end if;
  select who_can_call into v_allow from public.privacy_settings where user_id = v_other;
  if coalesce(v_allow, 'friends') = 'nobody' then raise exception 'this user isn’t accepting calls'; end if;
  if coalesce(v_allow, 'friends') = 'friends' and not public.are_friends(v_me, v_other) then
    raise exception 'this user only accepts calls from friends';
  end if;
  -- One active call per person: prevents duplicate/simultaneous calls.
  if exists (select 1 from public.calls c join public.call_participants p on p.call_id = c.id
             where c.status in ('ringing','accepted') and p.user_id = v_me) then
    raise exception 'you are already in a call';
  end if;
  insert into public.calls (conversation_id, caller_id, kind) values (p_conversation, v_me, p_kind) returning id into v_id;
  insert into public.call_participants (call_id, user_id, role, joined_at) values (v_id, v_me, 'caller', now()), (v_id, v_other, 'callee', null);
  if exists (select 1 from public.calls c join public.call_participants p on p.call_id = c.id
             where c.id <> v_id and c.status in ('ringing','accepted') and p.user_id = v_other) then
    update public.calls set status = 'busy', ended_at = now(), end_reason = 'busy' where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.answer_call(p_call uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.calls set status = 'accepted', answered_at = now()
    where id = p_call and status = 'ringing'
      and exists (select 1 from public.call_participants where call_id = p_call and user_id = auth.uid() and role = 'callee');
  if not found then raise exception 'this call is no longer ringing'; end if;
  update public.call_participants set joined_at = now() where call_id = p_call and user_id = auth.uid();
end;
$$;

create or replace function public.end_call(p_call uuid, p_reason text default 'hangup')
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.calls;
  v_role text;
  v_new text;
  v_text text;
begin
  select role into v_role from public.call_participants where call_id = p_call and user_id = auth.uid();
  if v_role is null then raise exception 'not part of this call'; end if;
  select * into c from public.calls where id = p_call for update;
  if c.status not in ('ringing','accepted') then return; end if;
  v_new := case
    when c.status = 'accepted' then case when p_reason = 'failed' then 'failed' else 'ended' end
    when v_role = 'callee' then 'declined'
    when p_reason = 'timeout' then 'missed'
    else 'cancelled' end;
  update public.calls set status = v_new, ended_at = now(), end_reason = left(p_reason, 40) where id = p_call returning * into c;
  update public.call_participants set left_at = now() where call_id = p_call and left_at is null and joined_at is not null;
  v_text := public.call_summary_text(c);
  if v_text is not null then perform public.post_system_message(c.conversation_id, v_text); end if;
end;
$$;

create or replace function public.list_calls(p_limit int default 50)
returns table (id uuid, conversation_id uuid, kind text, status text, started_at timestamptz, answered_at timestamptz,
               ended_at timestamptz, outgoing boolean, other_id uuid, other_username text, other_display_name text,
               other_avatar_url text, other_aura text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.conversation_id, c.kind, c.status, c.started_at, c.answered_at, c.ended_at,
         c.caller_id = auth.uid(), p.id, p.username::text, p.display_name, p.avatar_url, p.aura_color
  from public.call_participants me
  join public.calls c on c.id = me.call_id
  join public.call_participants op on op.call_id = c.id and op.user_id <> auth.uid()
  join public.profiles p on p.id = op.user_id
  where me.user_id = auth.uid()
  order by c.started_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

-- Topic guard for private Realtime channels "call:<uuid>".
create or replace function public.can_use_call_topic(p_topic text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_topic is null or p_topic not like 'call:%' then return false; end if;
  begin
    v_id := substring(p_topic from 6)::uuid;
  exception when others then
    return false;
  end;
  return exists (select 1 from public.call_participants where call_id = v_id and user_id = auth.uid());
end;
$$;

create policy "call participants receive signalling" on realtime.messages for select to authenticated
  using (realtime.topic() like 'call:%' and public.can_use_call_topic(realtime.topic()));
create policy "call participants send signalling" on realtime.messages for insert to authenticated
  with check (realtime.topic() like 'call:%' and public.can_use_call_topic(realtime.topic()));

revoke all on function public.expire_stale_calls() from public, anon, authenticated;
revoke all on function public.call_summary_text(public.calls) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['is_call_participant(uuid)','start_call(uuid,text)','answer_call(uuid)','end_call(uuid,text)',
                           'list_calls(int)','can_use_call_topic(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

alter publication supabase_realtime add table public.calls;
