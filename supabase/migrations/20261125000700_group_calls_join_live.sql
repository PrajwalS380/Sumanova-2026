-- Group calls: starting a call in a group that already has one live returns that call (join),
-- checked before the "already in a call" guard.
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
  if v_kind = 'group' then
    -- A call is already live in this group: join it instead of starting another.
    select id into v_live from public.calls where conversation_id = p_conversation and status in ('ringing','accepted') order by started_at desc limit 1;
    if v_live is not null then return v_live; end if;
  end if;
  if exists (select 1 from public.calls c join public.call_participants p on p.call_id = c.id
             where c.status in ('ringing','accepted') and p.user_id = v_me and p.joined_at is not null and p.left_at is null) then
    raise exception 'you are already in a call';
  end if;

  if v_kind = 'group' then
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

