-- Batch 5 (owner-approved 2026-11-25): @mentions + map pins on stories, story heat map, explored
-- areas, travel status + battery on the friend map, private (passcode) memories, memory search,
-- trending hashtags / sounds and creator stats on Spotlight.

-- ---------------------------------------------------------------------------
-- Stories: mentions (friends only, notified) and an optional map pin for public stories
-- (rounded to ~1 km; never the precise spot).
-- ---------------------------------------------------------------------------
alter table public.stories
  add column if not exists mentions uuid[] not null default '{}',
  add column if not exists map_lat double precision,
  add column if not exists map_lng double precision;
create index if not exists stories_map on public.stories (map_lat, map_lng) where map_lat is not null and deleted_at is null;

create or replace function public.post_story(
  p_story uuid, p_kind text, p_media_path text, p_overlay_path text, p_text text, p_background text,
  p_meta jsonb, p_audience text, p_custom uuid[] default null, p_group uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_meta jsonb := coalesce(p_meta, '{}'::jsonb);
  v_mentions uuid[];
  v_lat double precision;
  v_lng double precision;
  u uuid;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if p_media_path is not null and p_media_path not like v_me::text || '/' || p_story::text || '.%' then raise exception 'invalid media path'; end if;
  if p_overlay_path is not null and p_overlay_path <> v_me::text || '/' || p_story::text || '-overlay.png' then raise exception 'invalid overlay path'; end if;
  if p_audience = 'group' and (p_group is null or not public.is_member(p_group)) then raise exception 'not a member of that group'; end if;
  if (select count(*) from public.stories where user_id = v_me and created_at > now() - interval '24 hours') >= 100 then
    raise exception 'story limit reached for today';
  end if;
  -- Mentions: up to 20 friends.
  select coalesce(array_agg(distinct x), '{}') into v_mentions
    from (select (e #>> '{}')::uuid as x from jsonb_array_elements(case when jsonb_typeof(v_meta -> 'mentions') = 'array' then v_meta -> 'mentions' else '[]'::jsonb end) e limit 20) m
    where m.x <> v_me and public.are_friends(v_me, m.x);
  -- Map pin: only for public stories, rounded to 2 decimals (~1 km).
  if p_audience = 'everyone' and jsonb_typeof(v_meta -> 'map') = 'object'
     and jsonb_typeof(v_meta -> 'map' -> 'lat') = 'number' and jsonb_typeof(v_meta -> 'map' -> 'lng') = 'number' then
    v_lat := round(((v_meta -> 'map' ->> 'lat')::numeric), 2)::double precision;
    v_lng := round(((v_meta -> 'map' ->> 'lng')::numeric), 2)::double precision;
    if abs(v_lat) > 90 or abs(v_lng) > 180 then v_lat := null; v_lng := null; end if;
  end if;
  v_meta := (v_meta - 'map') - 'mentions';

  insert into public.stories (id, user_id, kind, media_path, overlay_path, text_body, background, media_meta, audience, group_id, mentions, map_lat, map_lng)
  values (p_story, v_me, p_kind, p_media_path, p_overlay_path, left(p_text, 500), left(p_background, 60), v_meta, p_audience,
          case when p_audience = 'group' then p_group else null end, v_mentions, v_lat, v_lng);
  if p_audience = 'custom' and p_custom is not null then
    insert into public.story_audience (story_id, user_id)
      select p_story, x from unnest(p_custom) x where public.are_friends(v_me, x) on conflict do nothing;
  end if;
  -- Tell mentioned friends who can actually see the story.
  foreach u in array v_mentions loop
    if p_audience in ('friends', 'everyone')
       or (p_audience = 'custom' and exists (select 1 from public.story_audience a where a.story_id = p_story and a.user_id = u))
       or (p_audience = 'group' and exists (select 1 from public.conversation_members m where m.conversation_id = p_group and m.user_id = u)) then
      perform public.notify(u, 'mention', public.display_name_of(v_me) || ' mentioned you in their story', 'Tap to watch', '/stories?u=' || v_me, v_me);
    end if;
  end loop;
end;
$$;

-- Heat map of public stories in a map view (last 24 h), bucketed to a grid that fits the zoom.
create or replace function public.story_heat(p_south double precision, p_west double precision, p_north double precision, p_east double precision)
returns table (lat double precision, lng double precision, stories int)
language sql stable security definer set search_path = '' as $$
  with g as (select greatest((p_north - p_south) / 24, 0.01) as cell)
  select (floor(s.map_lat / g.cell) * g.cell + g.cell / 2)::double precision,
         (floor(s.map_lng / g.cell) * g.cell + g.cell / 2)::double precision,
         count(*)::int
  from public.stories s, g
  where s.map_lat between p_south and p_north and s.map_lng between p_west and p_east
    and s.audience = 'everyone' and s.deleted_at is null and s.expires_at > now()
    and not public.is_blocked_between(auth.uid(), s.user_id)
  group by 1, 2
  order by 3 desc
  limit 400;
$$;

-- Public stories around a point (for "tap the heat").
create or replace function public.stories_near(p_lat double precision, p_lng double precision, p_radius double precision default 0.03)
returns table (story_id uuid, user_id uuid, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, s.user_id, s.created_at
  from public.stories s
  where s.map_lat between p_lat - p_radius and p_lat + p_radius
    and s.map_lng between p_lng - p_radius and p_lng + p_radius
    and s.audience = 'everyone' and s.deleted_at is null and s.expires_at > now()
    and not public.is_blocked_between(auth.uid(), s.user_id)
  order by s.created_at desc
  limit 50;
$$;

-- ---------------------------------------------------------------------------
-- Map: explored areas (~1 km cells I've shared from), travel status and battery.
-- ---------------------------------------------------------------------------
create table if not exists public.explored_cells (
  user_id   uuid not null references auth.users (id) on delete cascade,
  lat_i     int not null,
  lng_i     int not null,
  first_at  timestamptz not null default now(),
  primary key (user_id, lat_i, lng_i)
);
alter table public.explored_cells enable row level security;
create policy "own explored cells" on public.explored_cells for select to authenticated using (user_id = (select auth.uid()));

alter table public.location_shares
  add column if not exists battery smallint check (battery between 0 and 100),
  add column if not exists motion text check (motion in ('still','walking','driving','flying')),
  add column if not exists prev_lat double precision,
  add column if not exists prev_lng double precision,
  add column if not exists prev_at timestamptz;
alter table public.privacy_settings add column if not exists share_battery boolean not null default true;

drop function if exists public.share_location(double precision, double precision, real, int, boolean, text, uuid[], boolean);
create function public.share_location(p_lat double precision, p_lng double precision, p_accuracy real,
                                      p_minutes int, p_precise boolean, p_audience text, p_friends uuid[], p_new_session boolean,
                                      p_battery int default null)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_targets uuid[]; v_old public.location_shares; v_speed double precision; v_motion text;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if p_battery is not null and p_battery not between 0 and 100 then p_battery := null; end if;
  select * into v_old from public.location_shares where user_id = v_me;
  -- Travel status from the distance between updates (m/s; equirectangular is plenty at this scale).
  if v_old.user_id is not null and v_old.updated_at < now() - interval '20 seconds' then
    v_speed := 6371000 * sqrt(power(radians(p_lat - v_old.lat), 2) + power(radians(p_lng - v_old.lng) * cos(radians(p_lat)), 2))
               / greatest(extract(epoch from now() - v_old.updated_at), 1);
    v_motion := case when v_speed < 0.6 then 'still' when v_speed < 3 then 'walking' when v_speed < 70 then 'driving' else 'flying' end;
  end if;
  if p_new_session then
    if p_minutes is null or p_minutes not between 1 and 1440 then raise exception 'pick a sharing duration up to 24 hours'; end if;
    select coalesce(array_agg(x), '{}') into v_targets from unnest(coalesce(p_friends, '{}')) x where public.are_friends(v_me, x);
    if p_audience = 'selected' and coalesce(array_length(v_targets, 1), 0) = 0 then raise exception 'pick at least one friend'; end if;
    insert into public.location_shares (user_id, lat, lng, accuracy_m, precise, audience, targets, expires_at, battery, motion)
      values (v_me, p_lat, p_lng, p_accuracy, coalesce(p_precise, false), p_audience, v_targets, now() + make_interval(mins => p_minutes), p_battery, v_motion)
    on conflict (user_id) do update set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m, precise = excluded.precise,
      audience = excluded.audience, targets = excluded.targets, updated_at = now(), expires_at = excluded.expires_at,
      battery = excluded.battery, motion = excluded.motion, prev_lat = public.location_shares.lat, prev_lng = public.location_shares.lng, prev_at = public.location_shares.updated_at;
    update public.privacy_settings set ghost_mode = false where user_id = v_me;
  else
    update public.location_shares set lat = p_lat, lng = p_lng, accuracy_m = p_accuracy, updated_at = now(),
        battery = coalesce(p_battery, battery), motion = coalesce(v_motion, motion), prev_lat = lat, prev_lng = lng, prev_at = updated_at
      where user_id = v_me and expires_at > now();
    if not found then return null; end if;
  end if;
  insert into public.explored_cells (user_id, lat_i, lng_i) values (v_me, floor(p_lat * 100)::int, floor(p_lng * 100)::int) on conflict do nothing;
  return (select expires_at from public.location_shares where user_id = v_me);
end;
$$;
revoke all on function public.share_location(double precision, double precision, real, int, boolean, text, uuid[], boolean, int) from public, anon;
grant execute on function public.share_location(double precision, double precision, real, int, boolean, text, uuid[], boolean, int) to authenticated;

drop function if exists public.friend_locations();
create function public.friend_locations()
returns table(user_id uuid, username text, display_name text, avatar_url text, avatar_body_url text, aura_color text,
              lat double precision, lng double precision, precise boolean, updated_at timestamptz, expires_at timestamptz,
              battery smallint, motion text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name, p.avatar_url, p.avatar_body_url, p.aura_color,
         case when l.precise then l.lat else round(l.lat::numeric, 2)::double precision end,
         case when l.precise then l.lng else round(l.lng::numeric, 2)::double precision end,
         l.precise, l.updated_at, l.expires_at,
         case when ps.share_battery then l.battery else null end,
         case when l.updated_at > now() - interval '30 minutes' then l.motion else null end
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
revoke all on function public.friend_locations() from public, anon;
grant execute on function public.friend_locations() to authenticated;

-- ---------------------------------------------------------------------------
-- Memories: private (encrypted on the phone with the owner's passcode) + search.
-- ---------------------------------------------------------------------------
alter table public.memories add column if not exists private boolean not null default false;
-- Passcode verifier for the private vault (salt + an encrypted check value; never the passcode).
alter table public.user_settings add column if not exists vault jsonb;

create or replace function public.search_memories(p_query text, p_limit int default 60)
returns setof public.memories
language sql stable security invoker set search_path = '' as $$
  select m.* from public.memories m
  where m.user_id = auth.uid() and m.deleted_at is null and not m.private
    and (
      coalesce(m.media_meta ->> 'tags', '') ilike '%' || btrim(p_query) || '%'
      or coalesce(m.media_meta ->> 'text', '') ilike '%' || btrim(p_query) || '%'
      or to_char(m.taken_at, 'FMMonth YYYY') ilike '%' || btrim(p_query) || '%'
      or to_char(m.taken_at, 'FMDay') ilike btrim(p_query) || '%'
      or (btrim(p_query) ilike 'video%' and m.kind = 'video')
      or (btrim(p_query) ilike 'photo%' and m.kind = 'image')
    )
  order by m.taken_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

-- ---------------------------------------------------------------------------
-- Spotlight: trending hashtags, trending sounds and my creator stats.
-- ---------------------------------------------------------------------------
create or replace function public.trending_hashtags(p_limit int default 12)
returns table (tag text, videos int)
language sql stable security definer set search_path = '' as $$
  select lower(m[1]), count(distinct v.id)::int
  from public.spotlight_videos v, regexp_matches(coalesce(v.caption, ''), '#([A-Za-z0-9_]{2,30})', 'g') m
  where v.status = 'published' and v.created_at > now() - interval '14 days'
  group by 1 order by 2 desc, 1 limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.trending_sounds(p_limit int default 8)
returns table (track text, videos int)
language sql stable security definer set search_path = '' as $$
  select v.media_meta ->> 'music_baked', count(*)::int
  from public.spotlight_videos v
  where v.status = 'published' and v.created_at > now() - interval '14 days' and v.media_meta ? 'music_baked'
  group by 1 order by 2 desc limit least(greatest(p_limit, 1), 30);
$$;

create or replace function public.creator_stats()
returns table (videos int, views bigint, likes bigint, comments bigint, saves bigint, followers int, views_7d bigint)
language sql stable security definer set search_path = '' as $$
  select count(*)::int, coalesce(sum(v.view_count), 0), coalesce(sum(v.like_count), 0), coalesce(sum(v.comment_count), 0), coalesce(sum(v.save_count), 0),
         (select count(*)::int from public.follows f where f.followee_id = auth.uid()),
         (select count(*) from public.video_views w join public.spotlight_videos x on x.id = w.video_id where x.user_id = auth.uid() and w.created_at > now() - interval '7 days')
  from public.spotlight_videos v
  where v.user_id = auth.uid() and v.status <> 'removed';
$$;

revoke all on function public.story_heat(double precision, double precision, double precision, double precision), public.stories_near(double precision, double precision, double precision),
  public.search_memories(text, int), public.trending_hashtags(int), public.trending_sounds(int), public.creator_stats() from public, anon;
grant execute on function public.story_heat(double precision, double precision, double precision, double precision), public.stories_near(double precision, double precision, double precision),
  public.search_memories(text, int), public.trending_hashtags(int), public.trending_sounds(int), public.creator_stats() to authenticated;
