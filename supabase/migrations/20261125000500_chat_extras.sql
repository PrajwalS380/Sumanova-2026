-- Batch 2 (owner-approved 2026-11-25): polls, live location in chat, scheduled messages,
-- chat screenshot alerts.

-- New message kinds. poll: body = question, media_meta.options = text[2..6].
-- location: body = label, media_meta = {lat,lng,acc,live_until,updated_at} (live while live_until > now()).
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text','image','video','voice','sticker','system','snap','poll','location'));

-- ---------------------------------------------------------------------------
-- Polls
-- ---------------------------------------------------------------------------
create table if not exists public.poll_votes (
  message_id  uuid not null references public.messages (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  option      smallint not null check (option between 0 and 5),
  voted_at    timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists poll_votes_user on public.poll_votes (user_id);
alter table public.poll_votes enable row level security;
create policy "members see poll votes" on public.poll_votes for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and public.is_member(m.conversation_id)));
alter publication supabase_realtime add table public.poll_votes;

-- Polls must have 2–6 short options.
create or replace function public.messages_validate_extras()
returns trigger language plpgsql set search_path = '' as $$
declare n int;
begin
  if new.kind = 'poll' then
    if jsonb_typeof(new.media_meta -> 'options') is distinct from 'array' then raise exception 'poll needs options'; end if;
    n := jsonb_array_length(new.media_meta -> 'options');
    if n < 2 or n > 6 then raise exception 'polls have 2 to 6 options'; end if;
    if exists (select 1 from jsonb_array_elements(new.media_meta -> 'options') o
               where jsonb_typeof(o) <> 'string' or char_length(o #>> '{}') not between 1 and 80) then
      raise exception 'each option is 1–80 characters';
    end if;
    if char_length(coalesce(new.body, '')) not between 1 and 200 then raise exception 'ask a question (up to 200 characters)'; end if;
  elsif new.kind = 'location' then
    if jsonb_typeof(new.media_meta -> 'lat') is distinct from 'number' or jsonb_typeof(new.media_meta -> 'lng') is distinct from 'number'
       or abs((new.media_meta ->> 'lat')::float8) > 90 or abs((new.media_meta ->> 'lng')::float8) > 180 then
      raise exception 'invalid location';
    end if;
    -- Live sharing lasts at most 8 hours.
    if new.media_meta ? 'live_until' and (new.media_meta ->> 'live_until')::timestamptz > now() + interval '8 hours 1 minute' then
      raise exception 'live location lasts up to 8 hours';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists messages_validate_extras on public.messages;
create trigger messages_validate_extras before insert on public.messages
  for each row execute function public.messages_validate_extras();
revoke all on function public.messages_validate_extras() from public, anon, authenticated;

create or replace function public.vote_poll(p_message uuid, p_option int)
returns void language plpgsql security definer set search_path = '' as $$
declare v_m public.messages;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_m from public.messages where id = p_message and kind = 'poll' and deleted_at is null;
  if not found or not public.is_member(v_m.conversation_id) then raise exception 'poll not found'; end if;
  if p_option is null or p_option < 0 or p_option >= jsonb_array_length(v_m.media_meta -> 'options') then
    raise exception 'invalid option';
  end if;
  insert into public.poll_votes (message_id, user_id, option) values (p_message, auth.uid(), p_option)
    on conflict (message_id, user_id) do update set option = excluded.option, voted_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Live location: the sender moves their pin while sharing is live, or stops it.
-- ---------------------------------------------------------------------------
create or replace function public.update_live_location(p_message uuid, p_lat float8, p_lng float8, p_acc real default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_m public.messages;
begin
  select * into v_m from public.messages where id = p_message and kind = 'location' and sender_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'not your location'; end if;
  if coalesce((v_m.media_meta ->> 'live_until')::timestamptz, '-infinity') <= now() then return false; end if;
  if abs(p_lat) > 90 or abs(p_lng) > 180 then raise exception 'invalid location'; end if;
  update public.messages
    set media_meta = media_meta || jsonb_build_object('lat', p_lat, 'lng', p_lng, 'acc', p_acc, 'updated_at', now())
    where id = p_message;
  return true;
end;
$$;

create or replace function public.stop_live_location(p_message uuid)
returns void language sql security definer set search_path = '' as $$
  update public.messages set media_meta = media_meta || jsonb_build_object('live_until', now())
  where id = p_message and kind = 'location' and sender_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Scheduled messages (text). Delivered by cron every minute as the author.
-- ---------------------------------------------------------------------------
create table if not exists public.scheduled_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  sender_id        uuid not null references auth.users (id) on delete cascade,
  body             text not null check (char_length(body) between 1 and 4000),
  send_at          timestamptz not null,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz,
  cancelled_at     timestamptz,
  failed_reason    text
);
create index if not exists scheduled_messages_due on public.scheduled_messages (send_at) where sent_at is null and cancelled_at is null;
create index if not exists scheduled_messages_sender on public.scheduled_messages (sender_id, conversation_id);
alter table public.scheduled_messages enable row level security;
create policy "own scheduled messages" on public.scheduled_messages for select to authenticated using (sender_id = (select auth.uid()));

create or replace function public.schedule_message(p_conversation uuid, p_body text, p_send_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_pending int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_member(p_conversation) then raise exception 'not in this chat'; end if;
  if p_send_at < now() + interval '1 minute' or p_send_at > now() + interval '30 days' then
    raise exception 'pick a time from 1 minute to 30 days ahead';
  end if;
  select count(*) into v_pending from public.scheduled_messages where sender_id = auth.uid() and sent_at is null and cancelled_at is null;
  if v_pending >= 50 then raise exception 'you have 50 scheduled messages already'; end if;
  insert into public.scheduled_messages (conversation_id, sender_id, body, send_at)
    values (p_conversation, auth.uid(), btrim(p_body), p_send_at) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.cancel_scheduled_message(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.scheduled_messages set cancelled_at = now()
  where id = p_id and sender_id = auth.uid() and sent_at is null and cancelled_at is null;
$$;

-- messages_before_insert: allow the scheduler to send as the author (flag is transaction-local and
-- only set by deliver_scheduled_messages(), which nobody but cron can execute).
create or replace function public.messages_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_conv public.conversations;
  v_other uuid;
  v_sched text := coalesce(current_setting('sumanova.scheduled_sender', true), '');
begin
  new.created_at := now();
  new.edited_at := null;
  new.deleted_at := null;
  if new.kind = 'system' then
    if coalesce(current_setting('sumanova.system_message', true), '') <> 'on' then
      raise exception 'system messages are server-only';
    end if;
    new.sender_id := null;
    return new;
  end if;
  if auth.uid() is null and v_sched <> '' then
    new.sender_id := v_sched::uuid;
  else
    new.sender_id := auth.uid();
  end if;
  select * into v_conv from public.conversations where id = new.conversation_id;
  if v_conv.kind = 'direct' then
    select user_id into v_other from public.conversation_members
      where conversation_id = new.conversation_id and user_id <> new.sender_id limit 1;
    if v_other is not null and public.is_blocked_between(new.sender_id, v_other) then
      raise exception 'cannot message this user';
    end if;
  end if;
  new.disappear_mode := v_conv.disappear_mode;
  new.expires_at := case when v_conv.disappear_mode = '24h' then now() + interval '24 hours' else null end;
  return new;
end;
$$;

create or replace function public.deliver_scheduled_messages()
returns int language plpgsql security definer set search_path = '' as $$
declare s record; n int := 0;
begin
  for s in
    select * from public.scheduled_messages
    where sent_at is null and cancelled_at is null and send_at <= now()
    order by send_at limit 200
    for update skip locked
  loop
    begin
      if not exists (select 1 from public.conversation_members where conversation_id = s.conversation_id and user_id = s.sender_id) then
        update public.scheduled_messages set cancelled_at = now(), failed_reason = 'left the chat' where id = s.id;
        continue;
      end if;
      perform set_config('sumanova.scheduled_sender', s.sender_id::text, true);
      insert into public.messages (conversation_id, client_id, kind, body)
        values (s.conversation_id, s.id, 'text', s.body);
      perform set_config('sumanova.scheduled_sender', '', true);
      update public.scheduled_messages set sent_at = now() where id = s.id;
      n := n + 1;
    exception when others then
      perform set_config('sumanova.scheduled_sender', '', true);
      update public.scheduled_messages set cancelled_at = now(), failed_reason = left(sqlerrm, 200) where id = s.id;
    end;
  end loop;
  return n;
end;
$$;
revoke all on function public.deliver_scheduled_messages() from public, anon, authenticated;
select cron.schedule('sumanova-scheduled-messages', '* * * * *', $$select public.deliver_scheduled_messages()$$);

-- ---------------------------------------------------------------------------
-- Chat screenshot alerts (Android 14+ reports screenshots; posted as a system line).
-- ---------------------------------------------------------------------------
create table if not exists public.chat_screenshot_log (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  at              timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.chat_screenshot_log enable row level security;

create or replace function public.report_chat_screenshot(p_conversation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_last timestamptz;
begin
  if auth.uid() is null or not public.is_member(p_conversation) then raise exception 'not in this chat'; end if;
  select at into v_last from public.chat_screenshot_log where conversation_id = p_conversation and user_id = auth.uid();
  if v_last is not null and v_last > now() - interval '15 seconds' then return; end if;
  insert into public.chat_screenshot_log (conversation_id, user_id) values (p_conversation, auth.uid())
    on conflict (conversation_id, user_id) do update set at = now();
  perform public.post_system_message(p_conversation, public.display_name_of(auth.uid()) || ' took a screenshot of the chat');
end;
$$;

revoke all on function public.vote_poll(uuid, int), public.update_live_location(uuid, float8, float8, real),
  public.stop_live_location(uuid), public.schedule_message(uuid, text, timestamptz),
  public.cancel_scheduled_message(uuid), public.report_chat_screenshot(uuid) from public, anon;
grant execute on function public.vote_poll(uuid, int), public.update_live_location(uuid, float8, float8, real),
  public.stop_live_location(uuid), public.schedule_message(uuid, text, timestamptz),
  public.cancel_scheduled_message(uuid), public.report_chat_screenshot(uuid) to authenticated;
