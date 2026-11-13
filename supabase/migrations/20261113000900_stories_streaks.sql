-- SUMANOVA Phase 6: stories (24h, audiences, viewers, reactions, replies, highlights, archive),
-- streaks (server-timestamped, day-based) and friendship profiles.
-- Expiry is enforced by RLS on the server, not just hidden in the UI.

-- ---------------------------------------------------------------------------
-- Stories
-- ---------------------------------------------------------------------------
create table public.stories (
  id               uuid primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  kind             text not null check (kind in ('image','video','text')),
  media_path       text check (char_length(media_path) <= 200),
  overlay_path     text check (char_length(overlay_path) <= 200),
  text_body        text check (char_length(text_body) <= 500),
  background       text check (char_length(background) <= 60),
  media_meta       jsonb not null default '{}'::jsonb,
  audience         text not null default 'friends' check (audience in ('friends','everyone','custom','group')),
  group_id         uuid references public.conversations (id) on delete cascade,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '24 hours',
  deleted_at       timestamptz,
  check ((kind = 'text' and text_body is not null) or (kind <> 'text' and media_path is not null)),
  check ((audience = 'group') = (group_id is not null))
);
create index stories_user_live on public.stories (user_id, created_at desc) where deleted_at is null;
create index stories_expiry on public.stories (expires_at);

create table public.story_audience (
  story_id  uuid not null references public.stories (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  primary key (story_id, user_id)
);

create table public.story_views (
  story_id   uuid not null references public.stories (id) on delete cascade,
  viewer_id  uuid not null references auth.users (id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  reaction   text check (char_length(reaction) <= 16),
  primary key (story_id, viewer_id)
);

create table public.highlights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 24),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create table public.highlight_items (
  highlight_id  uuid not null references public.highlights (id) on delete cascade,
  story_id      uuid not null references public.stories (id) on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (highlight_id, story_id)
);

create or replace function public.in_live_highlight(p_story uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.highlight_items hi join public.highlights h on h.id = hi.highlight_id
                 where hi.story_id = p_story and h.deleted_at is null);
$$;

-- Central visibility rule for a story (used by RLS, storage and RPCs).
create or replace function public.can_view_story(p_story uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare s public.stories; v_me uuid := auth.uid(); v_allow text;
begin
  select * into s from public.stories where id = p_story;
  if s.id is null or v_me is null then return false; end if;
  if s.user_id = v_me then return true; end if;
  if s.deleted_at is not null then return false; end if;
  if s.expires_at <= now() and not public.in_live_highlight(s.id) then return false; end if;
  if public.is_blocked_between(v_me, s.user_id) then return false; end if;
  return case s.audience
    when 'everyone' then true
    when 'friends' then public.are_friends(v_me, s.user_id)
    when 'custom' then exists (select 1 from public.story_audience a where a.story_id = s.id and a.user_id = v_me)
    when 'group' then exists (select 1 from public.conversation_members m where m.conversation_id = s.group_id and m.user_id = v_me)
    else false end;
end;
$$;

alter table public.stories enable row level security;
alter table public.story_audience enable row level security;
alter table public.story_views enable row level security;
alter table public.highlights enable row level security;
alter table public.highlight_items enable row level security;

create policy "viewers see permitted stories" on public.stories for select to authenticated using (public.can_view_story(id));
create policy "owners see audience" on public.story_audience for select to authenticated
  using (exists (select 1 from public.stories s where s.id = story_id and s.user_id = (select auth.uid())));
create policy "owner sees views, viewer sees own" on public.story_views for select to authenticated
  using (viewer_id = (select auth.uid()) or exists (select 1 from public.stories s where s.id = story_id and s.user_id = (select auth.uid())));
create policy "highlights visible with profile" on public.highlights for select to authenticated
  using (deleted_at is null or user_id = (select auth.uid()));
create policy "highlight items visible if story visible" on public.highlight_items for select to authenticated
  using (public.can_view_story(story_id));

create or replace function public.post_story(
  p_story uuid, p_kind text, p_media_path text, p_overlay_path text, p_text text, p_background text,
  p_meta jsonb, p_audience text, p_custom uuid[] default null, p_group uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if p_media_path is not null and p_media_path not like v_me::text || '/' || p_story::text || '.%' then raise exception 'invalid media path'; end if;
  if p_overlay_path is not null and p_overlay_path <> v_me::text || '/' || p_story::text || '-overlay.png' then raise exception 'invalid overlay path'; end if;
  if p_audience = 'group' and (p_group is null or not public.is_member(p_group)) then raise exception 'not a member of that group'; end if;
  if (select count(*) from public.stories where user_id = v_me and created_at > now() - interval '24 hours') >= 100 then
    raise exception 'story limit reached for today';
  end if;
  insert into public.stories (id, user_id, kind, media_path, overlay_path, text_body, background, media_meta, audience, group_id)
  values (p_story, v_me, p_kind, p_media_path, p_overlay_path, left(p_text, 500), left(p_background, 60), coalesce(p_meta, '{}'::jsonb), p_audience,
          case when p_audience = 'group' then p_group else null end);
  if p_audience = 'custom' and p_custom is not null then
    insert into public.story_audience (story_id, user_id)
      select p_story, x from unnest(p_custom) x where public.are_friends(v_me, x) on conflict do nothing;
  end if;
end;
$$;

create or replace function public.remove_story(p_story uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.stories set deleted_at = now() where id = p_story and user_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'story not found'; end if;
end;
$$;

create or replace function public.view_story(p_story uuid, p_reaction text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  if not public.can_view_story(p_story) then raise exception 'story not available'; end if;
  select user_id into v_owner from public.stories where id = p_story;
  if v_owner = auth.uid() then return; end if;
  insert into public.story_views (story_id, viewer_id, reaction) values (p_story, auth.uid(), left(p_reaction, 16))
  on conflict (story_id, viewer_id) do update set reaction = coalesce(excluded.reaction, public.story_views.reaction);
end;
$$;

-- Reply privately: lands in the 1:1 chat with the story owner.
create or replace function public.reply_to_story(p_story uuid, p_text text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_conv uuid; v_kind text;
begin
  if not public.can_view_story(p_story) then raise exception 'story not available'; end if;
  if char_length(btrim(coalesce(p_text, ''))) not between 1 and 1000 then raise exception 'reply must be 1-1000 characters'; end if;
  select user_id, kind into v_owner, v_kind from public.stories where id = p_story;
  if v_owner = auth.uid() then raise exception 'that is your own story'; end if;
  v_conv := public.get_or_create_direct(v_owner);
  insert into public.messages (conversation_id, client_id, kind, body, media_meta)
    values (v_conv, gen_random_uuid(), 'text', p_text, jsonb_build_object('story_reply', p_story, 'story_kind', v_kind));
  return v_conv;
end;
$$;

-- Story rings: everyone whose live stories I can see, with an "unseen" flag.
create or replace function public.story_feed()
returns table (user_id uuid, username text, display_name text, avatar_url text, aura_color text,
               story_count int, unseen boolean, latest_at timestamptz, is_me boolean, is_friend boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name, p.avatar_url, p.aura_color,
         count(*)::int,
         bool_or(not exists (select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid())) and p.id <> auth.uid(),
         max(s.created_at),
         p.id = auth.uid(),
         public.are_friends(auth.uid(), p.id)
  from public.stories s
  join public.profiles p on p.id = s.user_id
  where s.deleted_at is null and s.expires_at > now() and public.can_view_story(s.id)
  group by p.id
  order by (p.id = auth.uid()) desc, bool_or(not exists (select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid())) desc, max(s.created_at) desc
  limit 100;
$$;

create or replace function public.story_viewers(p_story uuid)
returns table (viewer_id uuid, username text, display_name text, avatar_url text, aura_color text, viewed_at timestamptz, reaction text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name, p.avatar_url, p.aura_color, v.viewed_at, v.reaction
  from public.story_views v join public.profiles p on p.id = v.viewer_id
  where v.story_id = p_story and exists (select 1 from public.stories s where s.id = p_story and s.user_id = auth.uid())
  order by v.viewed_at desc;
$$;

create or replace function public.create_highlight(p_title text, p_stories uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select count(*) from public.highlights where user_id = auth.uid() and deleted_at is null) >= 30 then raise exception 'you can have up to 30 highlights'; end if;
  insert into public.highlights (user_id, title) values (auth.uid(), btrim(p_title)) returning id into v_id;
  insert into public.highlight_items (highlight_id, story_id)
    select v_id, s.id from public.stories s where s.id = any(p_stories) and s.user_id = auth.uid() and s.deleted_at is null on conflict do nothing;
  return v_id;
end;
$$;

create or replace function public.add_to_highlight(p_highlight uuid, p_story uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.highlights where id = p_highlight and user_id = auth.uid() and deleted_at is null) then raise exception 'highlight not found'; end if;
  if not exists (select 1 from public.stories where id = p_story and user_id = auth.uid() and deleted_at is null) then raise exception 'story not found'; end if;
  insert into public.highlight_items (highlight_id, story_id) values (p_highlight, p_story) on conflict do nothing;
end;
$$;

create or replace function public.remove_highlight(p_highlight uuid)
returns void language sql security definer set search_path = '' as $$
  update public.highlights set deleted_at = now() where id = p_highlight and user_id = auth.uid();
$$;

-- Stories bucket: <user_id>/<story_id>.<ext> (+ -overlay.png)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stories', 'stories', false, 31457280, array['image/jpeg','image/webp','image/png','video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

create or replace function public.can_read_story_object(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_story uuid;
begin
  begin
    v_story := substring(storage.filename(p_name) from 1 for 36)::uuid;
  exception when others then return false;
  end;
  return public.can_view_story(v_story);
end;
$$;

create policy "story owners upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'stories' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "story viewers read" on storage.objects for select to authenticated
  using (bucket_id = 'stories' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.can_read_story_object(name)));
create policy "story owners remove files" on storage.objects for delete to authenticated
  using (bucket_id = 'stories' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Streaks: a day counts when BOTH friends sent each other a snap that (UTC) day.
-- Consecutive counted days grow the streak; a missed day breaks it.
-- One free restore within 24h of a break, once every 30 days.
-- ---------------------------------------------------------------------------
create table public.streaks (
  user_a             uuid not null references auth.users (id) on delete cascade,
  user_b             uuid not null references auth.users (id) on delete cascade,
  count              int not null default 0,
  best               int not null default 0,
  last_sent_a        timestamptz,
  last_sent_b        timestamptz,
  last_counted_day   date,
  restore_used_at    timestamptz,
  updated_at         timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
alter table public.streaks enable row level security;
create policy "pair sees streak" on public.streaks for select to authenticated using ((select auth.uid()) in (user_a, user_b));

create or replace function public.bump_streak(p_from uuid, p_to uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a uuid := least(p_from, p_to); b uuid := greatest(p_from, p_to); r public.streaks; today date := (now() at time zone 'utc')::date;
begin
  insert into public.streaks (user_a, user_b) values (a, b) on conflict do nothing;
  if p_from = a then update public.streaks set last_sent_a = now(), updated_at = now() where user_a = a and user_b = b;
  else update public.streaks set last_sent_b = now(), updated_at = now() where user_a = a and user_b = b; end if;
  select * into r from public.streaks where user_a = a and user_b = b for update;
  if (r.last_sent_a at time zone 'utc')::date = today and (r.last_sent_b at time zone 'utc')::date = today
     and r.last_counted_day is distinct from today then
    update public.streaks set
      count = case when r.last_counted_day = today - 1 then r.count + 1 else 1 end,
      best = greatest(r.best, case when r.last_counted_day = today - 1 then r.count + 1 else 1 end),
      last_counted_day = today
    where user_a = a and user_b = b;
  end if;
end;
$$;
revoke all on function public.bump_streak(uuid, uuid) from public, anon, authenticated;

create or replace function public.snaps_streak_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_sender uuid;
begin
  select sender_id into v_sender from public.snaps where id = new.snap_id;
  perform public.bump_streak(v_sender, new.recipient_id);
  return new;
end;
$$;
create trigger snap_recipients_streak after insert on public.snap_recipients
  for each row execute function public.snaps_streak_trigger();

create or replace function public.restore_streak(p_friend uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare a uuid := least(auth.uid(), p_friend); b uuid := greatest(auth.uid(), p_friend); r public.streaks; today date := (now() at time zone 'utc')::date;
begin
  select * into r from public.streaks where user_a = a and user_b = b for update;
  if r.user_a is null or r.count = 0 then raise exception 'no streak to restore'; end if;
  if r.last_counted_day >= today - 1 then raise exception 'your streak is still alive'; end if;
  if r.last_counted_day < today - 2 then raise exception 'this streak ended too long ago to restore'; end if;
  if r.restore_used_at is not null and r.restore_used_at > now() - interval '30 days' then raise exception 'you can restore once every 30 days'; end if;
  update public.streaks set last_counted_day = today - 1, restore_used_at = now() where user_a = a and user_b = b;
  return r.count;
end;
$$;

-- Streak view for the chat list: live count + "expiring soon" (no exchange yet today).
create or replace function public.my_streaks()
returns table (friend_id uuid, count int, best int, expiring boolean, restorable boolean)
language sql stable security definer set search_path = '' as $$
  select case when s.user_a = auth.uid() then s.user_b else s.user_a end,
         case when s.last_counted_day >= (now() at time zone 'utc')::date - 1 then s.count else 0 end,
         s.best,
         s.last_counted_day = (now() at time zone 'utc')::date - 1,
         s.count > 0 and s.last_counted_day = (now() at time zone 'utc')::date - 2
           and (s.restore_used_at is null or s.restore_used_at < now() - interval '30 days')
  from public.streaks s
  where auth.uid() in (s.user_a, s.user_b);
$$;

-- Friendship profile: everything the two of you share.
create or replace function public.friendship_profile(p_friend uuid)
returns table (friends_since timestamptz, streak int, best_streak int, streak_expiring boolean, snaps_exchanged int,
               messages_exchanged int, is_best_friend boolean, anniversary_today boolean, badges text[])
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_since timestamptz;
  v_streak int := 0; v_best int := 0; v_exp boolean := false;
  v_snaps int; v_msgs int; v_best_friend boolean; v_badges text[] := '{}';
begin
  if not public.are_friends(v_me, p_friend) then raise exception 'not friends'; end if;
  select created_at into v_since from public.friendships where user_a = least(v_me, p_friend) and user_b = greatest(v_me, p_friend);
  select ms.count, ms.best, ms.expiring into v_streak, v_best, v_exp from public.my_streaks() ms where ms.friend_id = p_friend;
  select count(*) into v_snaps from public.snaps s join public.snap_recipients r on r.snap_id = s.id
    where (s.sender_id = v_me and r.recipient_id = p_friend) or (s.sender_id = p_friend and r.recipient_id = v_me);
  select count(*) into v_msgs from public.messages m join public.conversations c on c.id = m.conversation_id
    where c.direct_key = least(v_me, p_friend)::text || ':' || greatest(v_me, p_friend)::text and m.kind <> 'system';
  select exists (select 1 from public.best_friends() bf where bf.friend_id = p_friend) into v_best_friend;
  if coalesce(v_streak, 0) >= 3 then v_badges := v_badges || '🔥 Streak keeper'; end if;
  if coalesce(v_best, 0) >= 30 then v_badges := v_badges || '🏆 30-day legends'; end if;
  if coalesce(v_best, 0) >= 100 then v_badges := v_badges || '💯 Century club'; end if;
  if v_snaps >= 50 then v_badges := v_badges || '📸 Snap squad'; end if;
  if v_msgs >= 500 then v_badges := v_badges || '💬 Chatterboxes'; end if;
  if v_best_friend then v_badges := v_badges || '💜 Best friends'; end if;
  if v_since < now() - interval '1 year' then v_badges := v_badges || '🎂 One year+'; end if;
  return query select v_since, coalesce(v_streak, 0), coalesce(v_best, 0), coalesce(v_exp, false), v_snaps, v_msgs, v_best_friend,
    (extract(month from v_since) = extract(month from now()) and extract(day from v_since) = extract(day from now()) and v_since < now() - interval '300 days'),
    v_badges;
end;
$$;

-- Best friends: top 3 by snaps + messages over the last 30 days.
create or replace function public.best_friends()
returns table (friend_id uuid, score int)
language sql stable security definer set search_path = '' as $$
  with f as (
    select case when user_a = auth.uid() then user_b else user_a end as fid from public.friendships where auth.uid() in (user_a, user_b)
  ), snaps as (
    select case when s.sender_id = auth.uid() then r.recipient_id else s.sender_id end as fid, count(*) * 3 as pts
    from public.snaps s join public.snap_recipients r on r.snap_id = s.id
    where s.created_at > now() - interval '30 days' and (s.sender_id = auth.uid() or r.recipient_id = auth.uid())
    group by 1
  ), msgs as (
    select cm.user_id as fid, count(*) as pts
    from public.messages m
    join public.conversations c on c.id = m.conversation_id and c.kind = 'direct'
    join public.conversation_members me on me.conversation_id = c.id and me.user_id = auth.uid()
    join public.conversation_members cm on cm.conversation_id = c.id and cm.user_id <> auth.uid()
    where m.created_at > now() - interval '30 days' and m.kind <> 'system'
    group by 1
  )
  select f.fid, (coalesce(snaps.pts, 0) + coalesce(msgs.pts, 0))::int as score
  from f left join snaps on snaps.fid = f.fid left join msgs on msgs.fid = f.fid
  where coalesce(snaps.pts, 0) + coalesce(msgs.pts, 0) > 0
  order by score desc limit 3;
$$;

do $$
declare f text;
begin
  foreach f in array array['in_live_highlight(uuid)','can_view_story(uuid)','post_story(uuid,text,text,text,text,text,jsonb,text,uuid[],uuid)',
    'remove_story(uuid)','view_story(uuid,text)','reply_to_story(uuid,text)','story_feed()','story_viewers(uuid)',
    'create_highlight(text,uuid[])','add_to_highlight(uuid,uuid)','remove_highlight(uuid)','can_read_story_object(text)',
    'restore_streak(uuid)','my_streaks()','friendship_profile(uuid)','best_friends()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

alter publication supabase_realtime add table public.stories, public.story_views;
