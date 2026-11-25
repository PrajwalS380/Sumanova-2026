-- Batch 3 (owner-approved 2026-11-25): group voice and video calls.
-- Mesh WebRTC (every pair connects directly; no media server, ₹0) — practical up to 6 people in a call.
-- * start_call works in groups: every member rings; anyone can join while the call is live.
-- * A group call stays live until fewer than 2 people are in it.
-- * Up to 6 people in a call at once; more members can join when someone leaves.

alter table public.calls add column if not exists is_group boolean not null default false;
alter table public.calls add column if not exists pushed_at timestamptz;
alter publication supabase_realtime add table public.call_participants;

create or replace function public.call_summary_text(c public.calls)
returns text language sql immutable set search_path = '' as $$
  select case
    when c.status = 'ended' and c.answered_at is not null then
      (case when c.is_group then (case when c.kind = 'video' then '🎥 Group video call · ' else '📞 Group call · ' end)
            when c.kind = 'video' then '🎥 Video call · ' else '📞 Voice call · ' end)
      || to_char(make_interval(secs => extract(epoch from (coalesce(c.ended_at, now()) - c.answered_at))::int), 'FMMI:SS')
    when c.status in ('missed','cancelled','busy') then
      (case when c.is_group then 'Missed group call' when c.kind = 'video' then '🎥 Missed video call' else '📞 Missed voice call' end)
    when c.status = 'declined' then (case when c.kind = 'video' then '🎥 Video call declined' else '📞 Voice call declined' end)
    when c.status = 'failed' then '⚠️ Call couldn’t connect'
    else null end;
$$;
revoke all on function public.call_summary_text(public.calls) from public, anon, authenticated;

create or replace function public.start_call(p_conversation uuid, p_kind text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_kind text;
  v_other uuid;
  v_allow text;
  v_id uuid;
  v_live uuid;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if p_kind not in ('voice','video') then raise exception 'invalid call type'; end if;
  perform public.expire_stale_calls();
  select kind into v_kind from public.conversations where id = p_conversation;
  if v_kind is null or not public.is_member(p_conversation) then raise exception 'not a member'; end if;
  if exists (select 1 from public.calls c join public.call_participants p on p.call_id = c.id
             where c.status in ('ringing','accepted') and p.user_id = v_me and p.joined_at is not null and p.left_at is null) then
    raise exception 'you are already in a call';
  end if;

  if v_kind = 'group' then
    -- A call is already live in this group: join it instead of starting another.
    select id into v_live from public.calls where conversation_id = p_conversation and status in ('ringing','accepted') order by started_at desc limit 1;
    if v_live is not null then return v_live; end if;
    insert into public.calls (conversation_id, caller_id, kind, is_group) values (p_conversation, v_me, p_kind, true) returning id into v_id;
    insert into public.call_participants (call_id, user_id, role, joined_at)
      select v_id, m.user_id, case when m.user_id = v_me then 'caller' else 'callee' end, case when m.user_id = v_me then now() else null end
      from public.conversation_members m
      where m.conversation_id = p_conversation
        and (m.user_id = v_me or not public.is_blocked_between(v_me, m.user_id));
    return v_id;
  end if;

  select user_id into v_other from public.conversation_members where conversation_id = p_conversation and user_id <> v_me limit 1;
  if v_other is null or public.is_blocked_between(v_me, v_other) then raise exception 'cannot call this user'; end if;
  select who_can_call into v_allow from public.privacy_settings where user_id = v_other;
  if coalesce(v_allow, 'friends') = 'nobody' then raise exception 'this user isn’t accepting calls'; end if;
  if coalesce(v_allow, 'friends') = 'friends' and not public.are_friends(v_me, v_other) then
    raise exception 'this user only accepts calls from friends';
  end if;
  insert into public.calls (conversation_id, caller_id, kind) values (p_conversation, v_me, p_kind) returning id into v_id;
  insert into public.call_participants (call_id, user_id, role, joined_at) values (v_id, v_me, 'caller', now()), (v_id, v_other, 'callee', null);
  if exists (select 1 from public.calls c join public.call_participants p on p.call_id = c.id
             where c.id <> v_id and c.status in ('ringing','accepted') and p.user_id = v_other and p.joined_at is not null and p.left_at is null) then
    update public.calls set status = 'busy', ended_at = now(), end_reason = 'busy' where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.answer_call(p_call uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.calls; v_in int;
begin
  select * into c from public.calls where id = p_call for update;
  if not found or not exists (select 1 from public.call_participants where call_id = p_call and user_id = auth.uid()) then
    raise exception 'this call is no longer ringing';
  end if;
  if not c.is_group then
    update public.calls set status = 'accepted', answered_at = now()
      where id = p_call and status = 'ringing'
        and exists (select 1 from public.call_participants where call_id = p_call and user_id = auth.uid() and role = 'callee');
    if not found then raise exception 'this call is no longer ringing'; end if;
    update public.call_participants set joined_at = now() where call_id = p_call and user_id = auth.uid();
    return;
  end if;
  -- Group: join (or re-join) while the call is live, up to 6 people at once.
  if c.status not in ('ringing','accepted') then raise exception 'this call has ended'; end if;
  select count(*) into v_in from public.call_participants where call_id = p_call and joined_at is not null and left_at is null and user_id <> auth.uid();
  if v_in >= 6 then raise exception 'this call is full (6 people) — try again when someone leaves'; end if;
  update public.call_participants set joined_at = now(), left_at = null where call_id = p_call and user_id = auth.uid();
  if c.status = 'ringing' then update public.calls set status = 'accepted', answered_at = now() where id = p_call; end if;
end;
$$;

create or replace function public.end_call(p_call uuid, p_reason text default 'hangup')
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.calls;
  v_role text;
  v_new text;
  v_text text;
  v_left int;
begin
  select role into v_role from public.call_participants where call_id = p_call and user_id = auth.uid();
  if v_role is null then raise exception 'not part of this call'; end if;
  select * into c from public.calls where id = p_call for update;
  if c.status not in ('ringing','accepted') then return; end if;

  if c.is_group then
    -- I leave (or decline). The call ends when fewer than 2 people remain in it,
    -- or when the starter cancels before anyone answered.
    update public.call_participants set left_at = now() where call_id = p_call and user_id = auth.uid() and left_at is null;
    select count(*) into v_left from public.call_participants where call_id = p_call and joined_at is not null and left_at is null;
    if c.status = 'ringing' and v_role = 'caller' then
      update public.calls set status = 'missed', ended_at = now(), end_reason = left(p_reason, 40) where id = p_call returning * into c;
    elsif c.status = 'ringing' and not exists (select 1 from public.call_participants where call_id = p_call and role = 'callee' and left_at is null) then
      update public.calls set status = 'missed', ended_at = now(), end_reason = 'declined' where id = p_call returning * into c;
    elsif c.status = 'accepted' and v_left < 2 then
      update public.calls set status = 'ended', ended_at = now(), end_reason = left(p_reason, 40) where id = p_call returning * into c;
      update public.call_participants set left_at = now() where call_id = p_call and left_at is null and joined_at is not null;
    else
      return;
    end if;
    v_text := public.call_summary_text(c);
    if v_text is not null then perform public.post_system_message(c.conversation_id, v_text); end if;
    return;
  end if;

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

-- Stale group calls (everyone dropped without hanging up) are closed by the housekeeping job too.
create or replace function public.expire_stale_calls()
returns void language sql security definer set search_path = '' as $$
  update public.calls set status = 'missed', ended_at = now(), end_reason = 'timeout'
    where status = 'ringing' and started_at < now() - interval '60 seconds';
  update public.calls set status = 'ended', ended_at = now(), end_reason = 'stale'
    where status = 'accepted' and coalesce(answered_at, started_at) < now() - interval '6 hours';
$$;
revoke all on function public.expire_stale_calls() from public, anon, authenticated;

-- Call history: one row per call; group calls show the group.
drop function if exists public.list_calls(int);
create function public.list_calls(p_limit int default 50)
returns table (id uuid, conversation_id uuid, kind text, status text, started_at timestamptz, answered_at timestamptz,
               ended_at timestamptz, outgoing boolean, other_id uuid, other_username text, other_display_name text,
               other_avatar_url text, other_aura text, is_group boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.conversation_id, c.kind, c.status, c.started_at, c.answered_at, c.ended_at,
         c.caller_id = auth.uid(),
         case when c.is_group then null else p.id end,
         case when c.is_group then null else p.username::text end,
         case when c.is_group then coalesce(cv.title, 'Group') else p.display_name end,
         case when c.is_group then cv.avatar_url else p.avatar_url end,
         case when c.is_group then 'violet' else p.aura_color end,
         c.is_group
  from public.call_participants me
  join public.calls c on c.id = me.call_id
  join public.conversations cv on cv.id = c.conversation_id
  left join lateral (
    select pr.* from public.call_participants op join public.profiles pr on pr.id = op.user_id
    where op.call_id = c.id and op.user_id <> auth.uid() limit 1
  ) p on true
  where me.user_id = auth.uid()
  order by c.started_at desc
  limit least(greatest(p_limit, 1), 200);
$$;
revoke all on function public.list_calls(int) from public, anon;
grant execute on function public.list_calls(int) to authenticated;

-- Missed-call notifications: 1:1 only (a group call isn't "missed" by people who chose not to join).
create or replace function public.trg_notify_calls()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_callee uuid;
begin
  if new.is_group then return null; end if;
  select user_id into v_callee from public.call_participants where call_id = new.id and role = 'callee';
  if v_callee is null then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'ringing' and new.status in ('missed','cancelled','busy') then
    perform public.notify(v_callee, 'missed_call', 'Missed ' || new.kind || ' call', 'from ' || public.display_name_of(new.caller_id), '/calls', new.caller_id);
  end if;
  return null;
end;
$$;
revoke all on function public.trg_notify_calls() from public, anon, authenticated;
