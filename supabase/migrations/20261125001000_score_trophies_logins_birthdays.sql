-- Batch 6 (owner-approved 2026-11-25): snap score, trophies, login alerts + device list,
-- birthday notifications. (Two-step login uses Supabase Auth's built-in TOTP MFA — no SQL.)

-- ---------------------------------------------------------------------------
-- Snap score: kept as counters so it survives snap clean-up.
-- ---------------------------------------------------------------------------
create table if not exists public.user_stats (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  snaps_sent      int not null default 0,
  snaps_received  int not null default 0,
  stories_posted  int not null default 0,
  updated_at      timestamptz not null default now()
);
alter table public.user_stats enable row level security;
create policy "own stats" on public.user_stats for select to authenticated using (user_id = (select auth.uid()));

-- Backfill from what exists today.
insert into public.user_stats (user_id, snaps_sent, snaps_received, stories_posted)
select u.id,
       (select count(*) from public.snap_recipients r join public.snaps s on s.id = r.snap_id where s.sender_id = u.id),
       (select count(*) from public.snap_recipients r where r.recipient_id = u.id),
       (select count(*) from public.stories st where st.user_id = u.id)
from auth.users u
on conflict (user_id) do nothing;

create or replace function public.trg_stats_snap_recipient()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_sender uuid;
begin
  select sender_id into v_sender from public.snaps where id = new.snap_id;
  insert into public.user_stats (user_id, snaps_sent) values (v_sender, 1)
    on conflict (user_id) do update set snaps_sent = public.user_stats.snaps_sent + 1, updated_at = now();
  insert into public.user_stats (user_id, snaps_received) values (new.recipient_id, 1)
    on conflict (user_id) do update set snaps_received = public.user_stats.snaps_received + 1, updated_at = now();
  return null;
end;
$$;
drop trigger if exists stats_snap_recipient on public.snap_recipients;
create trigger stats_snap_recipient after insert on public.snap_recipients for each row execute function public.trg_stats_snap_recipient();

create or replace function public.trg_stats_story()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_stats (user_id, stories_posted) values (new.user_id, 1)
    on conflict (user_id) do update set stories_posted = public.user_stats.stories_posted + 1, updated_at = now();
  return null;
end;
$$;
drop trigger if exists stats_story on public.stories;
create trigger stats_story after insert on public.stories for each row execute function public.trg_stats_story();
revoke all on function public.trg_stats_snap_recipient(), public.trg_stats_story() from public, anon, authenticated;

-- Score = snaps sent + snaps received + 2 × stories. Visible to me and my friends.
create or replace function public.snap_score(p_user uuid)
returns int language sql stable security definer set search_path = '' as $$
  select case when p_user = auth.uid() or public.are_friends(auth.uid(), p_user)
              then coalesce((select snaps_sent + snaps_received + 2 * stories_posted from public.user_stats where user_id = p_user), 0)
              else null end;
$$;

-- Everything trophies are earned from (mine only).
create or replace function public.my_trophy_stats()
returns table (snaps_sent int, snaps_received int, stories int, best_streak int, friends int, spotlight_videos int,
               spotlight_likes bigint, explored int, groups int, calls int, memories int, score int)
language sql stable security definer set search_path = '' as $$
  select coalesce(s.snaps_sent, 0), coalesce(s.snaps_received, 0), coalesce(s.stories_posted, 0),
         coalesce((select max(best) from public.streaks where auth.uid() in (user_a, user_b)), 0),
         (select count(*)::int from public.friendships where auth.uid() in (user_a, user_b)),
         (select count(*)::int from public.spotlight_videos where user_id = auth.uid() and status = 'published'),
         (select coalesce(sum(like_count), 0) from public.spotlight_videos where user_id = auth.uid() and status = 'published'),
         (select count(*)::int from public.explored_cells where user_id = auth.uid()),
         (select count(*)::int from public.conversation_members m join public.conversations c on c.id = m.conversation_id where m.user_id = auth.uid() and c.kind = 'group'),
         (select count(*)::int from public.calls where caller_id = auth.uid() and answered_at is not null),
         (select count(*)::int from public.memories where user_id = auth.uid() and deleted_at is null),
         coalesce(s.snaps_sent + s.snaps_received + 2 * s.stories_posted, 0)
  from (select 1) one left join public.user_stats s on s.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Login alerts + device list (the app reports each sign-in with a device label).
-- ---------------------------------------------------------------------------
create table if not exists public.login_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  device      text not null check (char_length(device) between 1 and 80),
  platform    text not null check (platform in ('android','ios','web')),
  device_key  text not null check (char_length(device_key) between 8 and 64),
  created_at  timestamptz not null default now()
);
create index if not exists login_events_user on public.login_events (user_id, created_at desc);
alter table public.login_events enable row level security;
create policy "own logins" on public.login_events for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.report_login(p_device text, p_platform text, p_device_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_known boolean; v_first boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_platform not in ('android','ios','web') then p_platform := 'web'; end if;
  if (select count(*) from public.login_events where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then return false; end if;
  v_first := not exists (select 1 from public.login_events where user_id = auth.uid());
  v_known := exists (select 1 from public.login_events where user_id = auth.uid() and device_key = p_device_key);
  insert into public.login_events (user_id, device, platform, device_key) values (auth.uid(), left(btrim(p_device), 80), p_platform, left(p_device_key, 64));
  -- Alert on a sign-in from a device we haven't seen before (not on the very first one).
  if not v_known and not v_first then
    perform public.notify(auth.uid(), 'system', 'New sign-in on ' || left(btrim(p_device), 60),
      'If this wasn’t you, change your password and sign out other devices in Settings.', '/settings', null);
  end if;
  return not v_known;
end;
$$;

create or replace function public.my_devices()
returns table (device_key text, device text, platform text, last_seen timestamptz, first_seen timestamptz, sign_ins int)
language sql stable security definer set search_path = '' as $$
  select device_key, (array_agg(device order by created_at desc))[1], (array_agg(platform order by created_at desc))[1],
         max(created_at), min(created_at), count(*)::int
  from public.login_events where user_id = auth.uid()
  group by device_key order by max(created_at) desc limit 50;
$$;

-- ---------------------------------------------------------------------------
-- Birthday notifications (daily, 03:31 UTC ≈ 9 AM India): friends get a nudge,
-- the birthday person gets a greeting. Only for people who show their birthday.
-- ---------------------------------------------------------------------------
create or replace function public.send_birthday_notifications()
returns int language plpgsql security definer set search_path = '' as $$
declare b record; f record; n int := 0;
begin
  for b in
    select s.user_id, p.display_name, p.username
    from public.user_settings s join public.profiles p on p.id = s.user_id
    join public.privacy_settings ps on ps.user_id = s.user_id
    where s.date_of_birth is not null and ps.show_birthday
      and extract(month from s.date_of_birth) = extract(month from (now() at time zone 'utc'))
      and extract(day from s.date_of_birth) = extract(day from (now() at time zone 'utc'))
  loop
    perform public.notify(b.user_id, 'system', 'Happy birthday, ' || split_part(b.display_name, ' ', 1) || '!', 'Have the best day — from everyone at SUMANOVA', '/birthdays', null);
    for f in
      select case when fr.user_a = b.user_id then fr.user_b else fr.user_a end as friend
      from public.friendships fr where b.user_id in (fr.user_a, fr.user_b)
    loop
      perform public.notify(f.friend, 'system', 'It’s ' || b.display_name || '’s birthday today', 'Send a snap to celebrate', '/u/' || b.username, b.user_id);
      n := n + 1;
    end loop;
  end loop;
  return n;
end;
$$;
revoke all on function public.send_birthday_notifications() from public, anon, authenticated;
select cron.schedule('sumanova-birthdays', '31 3 * * *', $$select public.send_birthday_notifications()$$);

revoke all on function public.snap_score(uuid), public.my_trophy_stats(), public.report_login(text, text, text), public.my_devices() from public, anon;
grant execute on function public.snap_score(uuid), public.my_trophy_stats(), public.report_login(text, text, text), public.my_devices() to authenticated;
