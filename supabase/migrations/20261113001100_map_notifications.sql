-- SUMANOVA Phases 8-9: opt-in location sharing, notifications, Web Push, scheduled jobs.
-- Location rows are never readable directly: friends get them only through
-- friend_locations(), which enforces opt-in, expiry, audience, blocks and precision.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Location sharing
-- ---------------------------------------------------------------------------
create table public.location_shares (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  accuracy_m  real check (accuracy_m >= 0),
  precise     boolean not null default false,
  audience    text not null default 'friends' check (audience in ('friends','selected')),
  targets     uuid[] not null default '{}',
  updated_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
alter table public.location_shares enable row level security;
-- Owners may read their own row; nobody else reads the table directly.
create policy "owner reads own location" on public.location_shares for select to authenticated using (user_id = (select auth.uid()));

-- p_new_session = true starts sharing (sets duration/audience); false just refreshes the position.
create or replace function public.share_location(p_lat double precision, p_lng double precision, p_accuracy real,
                                                  p_minutes int, p_precise boolean, p_audience text, p_friends uuid[], p_new_session boolean)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_targets uuid[];
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if p_new_session then
    if p_minutes is null or p_minutes not between 1 and 1440 then raise exception 'pick a sharing duration up to 24 hours'; end if;
    select coalesce(array_agg(x), '{}') into v_targets from unnest(coalesce(p_friends, '{}')) x where public.are_friends(v_me, x);
    if p_audience = 'selected' and coalesce(array_length(v_targets, 1), 0) = 0 then raise exception 'pick at least one friend'; end if;
    insert into public.location_shares (user_id, lat, lng, accuracy_m, precise, audience, targets, expires_at)
      values (v_me, p_lat, p_lng, p_accuracy, coalesce(p_precise, false), p_audience, v_targets, now() + make_interval(mins => p_minutes))
    on conflict (user_id) do update set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m, precise = excluded.precise,
      audience = excluded.audience, targets = excluded.targets, updated_at = now(), expires_at = excluded.expires_at;
    update public.privacy_settings set ghost_mode = false where user_id = v_me;
  else
    update public.location_shares set lat = p_lat, lng = p_lng, accuracy_m = p_accuracy, updated_at = now()
      where user_id = v_me and expires_at > now();
    if not found then return null; end if;
  end if;
  return (select expires_at from public.location_shares where user_id = v_me);
end;
$$;

create or replace function public.stop_sharing_location()
returns void language sql security definer set search_path = '' as $$
  update public.location_shares set expires_at = now(), updated_at = now() where user_id = auth.uid();
  update public.privacy_settings set ghost_mode = true where user_id = auth.uid();
$$;

create or replace function public.friend_locations()
returns table (user_id uuid, username text, display_name text, avatar_url text, aura_color text,
               lat double precision, lng double precision, precise boolean, updated_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name, p.avatar_url, p.aura_color,
         case when l.precise then l.lat else round(l.lat::numeric, 2)::double precision end,
         case when l.precise then l.lng else round(l.lng::numeric, 2)::double precision end,
         l.precise, l.updated_at, l.expires_at
  from public.location_shares l
  join public.profiles p on p.id = l.user_id
  join public.privacy_settings ps on ps.user_id = l.user_id
  where l.user_id <> auth.uid()
    and l.expires_at > now()
    and not ps.ghost_mode
    and public.are_friends(auth.uid(), l.user_id)
    and not public.is_blocked_between(auth.uid(), l.user_id)
    and (l.audience = 'friends' or auth.uid() = any(l.targets));
$$;

-- ---------------------------------------------------------------------------
-- Notifications (in-app list + push delivery state)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('friend_request','friend_accepted','missed_call','incoming_call','snap','story_reaction','story_reply','mention','comment','follow','streak','system')),
  title       text not null check (char_length(title) <= 120),
  body        text check (char_length(body) <= 300),
  url         text check (char_length(url) <= 200),
  actor_id    uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  pushed_at   timestamptz
);
create index notifications_user on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "mark own read" on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique check (char_length(endpoint) <= 1000),
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth        text not null check (char_length(auth) <= 100),
  user_agent  text check (char_length(user_agent) <= 300),
  created_at  timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "own push subs" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "add own push sub" on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy "remove own push sub" on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- Fire-and-forget call to the "push" Edge Function (it re-reads everything with
-- the service role, so the request body carries only an id).
create or replace function public.request_push(p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://wssfbcscijpwfohhkerz.supabase.co/functions/v1/push',
    body := jsonb_build_object('kind', p_kind, 'id', p_id),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 4000
  );
exception when others then
  null; -- never block the user's action because push failed
end;
$$;
revoke all on function public.request_push(text, uuid) from public, anon, authenticated;

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_url text, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_user is null or p_user = p_actor then return; end if;
  if p_actor is not null and public.is_blocked_between(p_user, p_actor) then return; end if;
  insert into public.notifications (user_id, kind, title, body, url, actor_id)
    values (p_user, p_kind, left(p_title, 120), left(p_body, 300), left(p_url, 200), p_actor) returning id into v_id;
  perform public.request_push('notification', v_id);
end;
$$;
revoke all on function public.notify(uuid, text, text, text, text, uuid) from public, anon, authenticated;

create or replace function public.display_name_of(p uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select display_name from public.profiles where id = p), 'Someone');
$$;

-- Triggers that create notifications --------------------------------------
create or replace function public.trg_notify_friend_requests()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.notify(new.receiver_id, 'friend_request', public.display_name_of(new.sender_id) || ' wants to be friends', 'Tap to accept', '/friends', new.sender_id);
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then
    perform public.notify(new.sender_id, 'friend_accepted', public.display_name_of(new.receiver_id) || ' accepted your request', 'Say hi 👋', '/friends', new.receiver_id);
  end if;
  return null;
end;
$$;
create trigger notify_friend_requests after insert or update on public.friend_requests for each row execute function public.trg_notify_friend_requests();

create or replace function public.trg_notify_calls()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_callee uuid;
begin
  select user_id into v_callee from public.call_participants where call_id = new.id and role = 'callee';
  if v_callee is null then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'ringing' and new.status in ('missed','cancelled','busy') then
    perform public.notify(v_callee, 'missed_call', 'Missed ' || new.kind || ' call', 'from ' || public.display_name_of(new.caller_id), '/calls', new.caller_id);
  end if;
  return null;
end;
$$;
create trigger notify_calls after update on public.calls for each row execute function public.trg_notify_calls();

-- Incoming-call push fires when the callee row is created (the call row exists by then).
create or replace function public.trg_push_incoming_call()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'callee' then perform public.request_push('call', new.call_id); end if;
  return null;
end;
$$;
create trigger push_incoming_call after insert on public.call_participants for each row execute function public.trg_push_incoming_call();

create or replace function public.trg_notify_snaps()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_sender uuid;
begin
  select sender_id into v_sender from public.snaps where id = new.snap_id;
  perform public.notify(new.recipient_id, 'snap', 'New snap from ' || public.display_name_of(v_sender), 'Tap to view', '/chat/' || new.conversation_id, v_sender);
  return null;
end;
$$;
create trigger notify_snaps after insert on public.snap_recipients for each row execute function public.trg_notify_snaps();

create or replace function public.trg_notify_story_reaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  if new.reaction is null or (tg_op = 'UPDATE' and old.reaction is not distinct from new.reaction) then return null; end if;
  select user_id into v_owner from public.stories where id = new.story_id;
  perform public.notify(v_owner, 'story_reaction', public.display_name_of(new.viewer_id) || ' reacted ' || new.reaction || ' to your story', null, '/stories', new.viewer_id);
  return null;
end;
$$;
create trigger notify_story_reaction after insert or update on public.story_views for each row execute function public.trg_notify_story_reaction();

create or replace function public.trg_notify_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  select user_id into v_owner from public.spotlight_videos where id = new.video_id;
  perform public.notify(v_owner, 'comment', public.display_name_of(new.user_id) || ' commented on your Spotlight', left(new.body, 120), '/spotlight', new.user_id);
  return null;
end;
$$;
create trigger notify_comment after insert on public.video_comments for each row execute function public.trg_notify_comment();

create or replace function public.trg_notify_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify(new.followee_id, 'follow', public.display_name_of(new.follower_id) || ' started following you', null, '/u/' || (select username from public.profiles where id = new.follower_id), new.follower_id);
  return null;
end;
$$;
create trigger notify_follow after insert on public.follows for each row execute function public.trg_notify_follow();

-- Chat messages: push only (no table rows), plus @mentions in groups become notifications.
create or replace function public.trg_message_push()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_kind text; v_title text; m record;
begin
  if new.kind = 'system' or new.sender_id is null then return null; end if;
  perform public.request_push('message', new.id);
  select kind, title into v_kind, v_title from public.conversations where id = new.conversation_id;
  if v_kind = 'group' and new.kind = 'text' and new.body ~ '@[a-z0-9._]{3,20}' then
    for m in
      select cm.user_id from public.conversation_members cm join public.profiles p on p.id = cm.user_id
      where cm.conversation_id = new.conversation_id and cm.user_id <> new.sender_id
        and new.body ~* ('@' || regexp_replace(p.username::text, '([.])', '\\\1', 'g') || '(\W|$)')
    loop
      perform public.notify(m.user_id, 'mention', public.display_name_of(new.sender_id) || ' mentioned you in ' || coalesce(v_title, 'a group'), left(new.body, 140), '/chat/' || new.conversation_id, new.sender_id);
    end loop;
  end if;
  return null;
end;
$$;
create trigger message_push after insert on public.messages for each row execute function public.trg_message_push();

-- ---------------------------------------------------------------------------
-- Push configuration for the Edge Function (service role only).
-- The VAPID private key lives in Supabase Vault, never in the app.
-- ---------------------------------------------------------------------------
create or replace function public.push_config()
returns table (public_key text, private_key text, subject text)
language sql stable security definer set search_path = '' as $$
  select (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key'),
         (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key'),
         coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'vapid_subject'), 'mailto:noreply@sumanova.app');
$$;
revoke all on function public.push_config() from public, anon, authenticated;
grant execute on function public.push_config() to service_role;

-- ---------------------------------------------------------------------------
-- Scheduled jobs (pg_cron, free): housekeeping + streak reminders.
-- ---------------------------------------------------------------------------
create or replace function public.run_housekeeping()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.expire_stale_calls();
  perform public.expire_snaps();
end;
$$;
revoke all on function public.run_housekeeping() from public, anon, authenticated;

create or replace function public.send_streak_reminders()
returns void language plpgsql security definer set search_path = '' as $$
declare s record; today date := (now() at time zone 'utc')::date;
begin
  for s in
    select * from public.streaks where count >= 2 and last_counted_day = today - 1
  loop
    if not exists (select 1 from public.notifications n where n.kind = 'streak' and n.user_id = s.user_a and n.actor_id = s.user_b and n.created_at::date = today) then
      perform public.notify(s.user_a, 'streak', '⏳ Your ' || s.count || '-day streak with ' || public.display_name_of(s.user_b) || ' ends soon', 'Send a snap today to keep it going', '/', s.user_b);
    end if;
    if not exists (select 1 from public.notifications n where n.kind = 'streak' and n.user_id = s.user_b and n.actor_id = s.user_a and n.created_at::date = today) then
      perform public.notify(s.user_b, 'streak', '⏳ Your ' || s.count || '-day streak with ' || public.display_name_of(s.user_a) || ' ends soon', 'Send a snap today to keep it going', '/', s.user_a);
    end if;
  end loop;
end;
$$;
revoke all on function public.send_streak_reminders() from public, anon, authenticated;

select cron.schedule('sumanova-housekeeping', '*/10 * * * *', $$select public.run_housekeeping()$$);
select cron.schedule('sumanova-streak-reminders', '0 16 * * *', $$select public.send_streak_reminders()$$);

do $$
declare f text;
begin
  foreach f in array array['share_location(double precision,double precision,real,int,boolean,text,uuid[],boolean)','stop_sharing_location()','friend_locations()','display_name_of(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

alter publication supabase_realtime add table public.notifications;
