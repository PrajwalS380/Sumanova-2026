-- SUMANOVA Phase 7: Memories (private library, albums, favourites, quotas) and
-- Spotlight (public short-video feed, likes, comments, saves, follows, reports,
-- simple engagement + recency + interest ranking, auto-hide on reports).
-- Also enables two "remove your own row" policies for chat (reactions, chat media).

-- ---------------------------------------------------------------------------
-- Chat: let people remove their own reaction / uploaded chat media.
-- ---------------------------------------------------------------------------
create policy "members remove own reaction" on public.message_reactions for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "chat senders delete own media" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media' and (storage.foldername(name))[2] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Memories
-- ---------------------------------------------------------------------------
create table public.albums (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 40),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.memories (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('image','video')),
  media_path  text not null check (char_length(media_path) <= 200),
  media_meta  jsonb not null default '{}'::jsonb,
  size_bytes  bigint not null default 0 check (size_bytes >= 0),
  taken_at    timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  favourite   boolean not null default false,
  archived    boolean not null default false,
  album_id    uuid references public.albums (id) on delete set null,
  deleted_at  timestamptz
);
create index memories_user_time on public.memories (user_id, taken_at desc) where deleted_at is null;

alter table public.albums enable row level security;
alter table public.memories enable row level security;
create policy "owners see albums" on public.albums for select to authenticated using (user_id = (select auth.uid()));
create policy "owners add albums" on public.albums for insert to authenticated with check (user_id = (select auth.uid()));
create policy "owners edit albums" on public.albums for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owners see memories" on public.memories for select to authenticated using (user_id = (select auth.uid()) and deleted_at is null);
create policy "owners edit memories" on public.memories for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Only these columns are editable by the owner directly.
revoke update on public.memories from authenticated;
grant update (favourite, archived, album_id, deleted_at) on public.memories to authenticated;

-- Per-user quota keeps the free 1 GB storage healthy: 150 MB / 400 items each.
create or replace function public.add_memory(p_id uuid, p_kind text, p_media_path text, p_meta jsonb, p_size bigint, p_taken_at timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_used bigint; v_n int;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if p_media_path not like v_me::text || '/' || p_id::text || '.%' then raise exception 'invalid media path'; end if;
  select coalesce(sum(size_bytes), 0), count(*) into v_used, v_n from public.memories where user_id = v_me and deleted_at is null;
  if v_n >= 400 then raise exception 'Memories is full (400 items). Remove some to save more.'; end if;
  if v_used + greatest(p_size, 0) > 150 * 1024 * 1024 then raise exception 'Memories storage is full (150 MB). Remove some to save more.'; end if;
  insert into public.memories (id, user_id, kind, media_path, media_meta, size_bytes, taken_at)
    values (p_id, v_me, p_kind, p_media_path, coalesce(p_meta, '{}'::jsonb), greatest(p_size, 0), coalesce(p_taken_at, now()));
end;
$$;

create or replace function public.memory_usage()
returns table (items int, bytes bigint, max_items int, max_bytes bigint)
language sql stable security definer set search_path = '' as $$
  select count(*)::int, coalesce(sum(size_bytes), 0)::bigint, 400, (150 * 1024 * 1024)::bigint
  from public.memories where user_id = auth.uid() and deleted_at is null;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memories', 'memories', false, 31457280, array['image/jpeg','image/webp','image/png','video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;
create policy "memory owners upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'memories' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "memory owners read" on storage.objects for select to authenticated
  using (bucket_id = 'memories' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "memory owners remove" on storage.objects for delete to authenticated
  using (bucket_id = 'memories' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Spotlight
-- ---------------------------------------------------------------------------
alter table public.user_settings add column if not exists interests text[] not null default '{}';

create table public.spotlight_videos (
  id              uuid primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  media_path      text not null check (char_length(media_path) <= 200),
  poster_path     text check (char_length(poster_path) <= 200),
  caption         text check (char_length(caption) <= 300),
  category        text not null default 'everyday' check (category in ('everyday','comedy','music','dance','travel','food','sports','art','pets','tech','learn')),
  media_meta      jsonb not null default '{}'::jsonb,
  status          text not null default 'published' check (status in ('published','hidden','removed')),
  like_count      int not null default 0,
  comment_count   int not null default 0,
  view_count      int not null default 0,
  save_count      int not null default 0,
  report_count    int not null default 0,
  created_at      timestamptz not null default now()
);
create index spotlight_recent on public.spotlight_videos (created_at desc) where status = 'published';
create index spotlight_user on public.spotlight_videos (user_id, created_at desc);

create table public.video_likes (
  video_id uuid not null references public.spotlight_videos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);
create table public.video_saves (
  video_id uuid not null references public.spotlight_videos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);
create table public.video_views (
  video_id uuid not null references public.spotlight_videos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  watched_ms int not null default 0,
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);
create table public.video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.spotlight_videos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index video_comments_video on public.video_comments (video_id, created_at desc);
create table public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee on public.follows (followee_id);

alter table public.reports add column if not exists target_video_id uuid references public.spotlight_videos (id) on delete set null;

alter table public.spotlight_videos enable row level security;
alter table public.video_likes enable row level security;
alter table public.video_saves enable row level security;
alter table public.video_views enable row level security;
alter table public.video_comments enable row level security;
alter table public.follows enable row level security;

create policy "published videos are public to members" on public.spotlight_videos for select to authenticated
  using ((status = 'published' and not public.is_blocked_between((select auth.uid()), user_id)) or user_id = (select auth.uid()));
create policy "likes readable" on public.video_likes for select to authenticated using (true);
create policy "like as yourself" on public.video_likes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "unlike yourself" on public.video_likes for delete to authenticated using (user_id = (select auth.uid()));
create policy "own saves" on public.video_saves for select to authenticated using (user_id = (select auth.uid()));
create policy "save as yourself" on public.video_saves for insert to authenticated with check (user_id = (select auth.uid()));
create policy "unsave yourself" on public.video_saves for delete to authenticated using (user_id = (select auth.uid()));
create policy "comments on visible videos" on public.video_comments for select to authenticated
  using (deleted_at is null and exists (select 1 from public.spotlight_videos v where v.id = video_id));
create policy "follows readable" on public.follows for select to authenticated using (true);
create policy "follow as yourself" on public.follows for insert to authenticated with check (follower_id = (select auth.uid()));
create policy "unfollow yourself" on public.follows for delete to authenticated using (follower_id = (select auth.uid()));

-- Counters maintained by triggers (no client-side counting).
create or replace function public.spotlight_counters()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v uuid := coalesce(new.video_id, old.video_id); d int := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  if tg_table_name = 'video_likes' then update public.spotlight_videos set like_count = greatest(0, like_count + d) where id = v;
  elsif tg_table_name = 'video_saves' then update public.spotlight_videos set save_count = greatest(0, save_count + d) where id = v;
  end if;
  return null;
end;
$$;
create trigger video_likes_count after insert or delete on public.video_likes for each row execute function public.spotlight_counters();
create trigger video_saves_count after insert or delete on public.video_saves for each row execute function public.spotlight_counters();

create or replace function public.publish_spotlight(p_id uuid, p_media_path text, p_poster_path text, p_caption text, p_category text, p_meta jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if p_media_path not like v_me::text || '/' || p_id::text || '.%' then raise exception 'invalid media path'; end if;
  if p_poster_path is not null and p_poster_path <> v_me::text || '/' || p_id::text || '-poster.webp' then raise exception 'invalid poster path'; end if;
  if (select count(*) from public.spotlight_videos where user_id = v_me and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'you can post up to 10 Spotlight videos a day';
  end if;
  insert into public.spotlight_videos (id, user_id, media_path, poster_path, caption, category, media_meta)
    values (p_id, v_me, p_media_path, p_poster_path, left(btrim(p_caption), 300), coalesce(p_category, 'everyday'), coalesce(p_meta, '{}'::jsonb));
end;
$$;

create or replace function public.remove_spotlight(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.spotlight_videos set status = 'removed' where id = p_id and user_id = auth.uid();
$$;

create or replace function public.record_view(p_video uuid, p_ms int)
returns void language plpgsql security definer set search_path = '' as $$
declare v_prev int; v_ms int := least(greatest(coalesce(p_ms, 0), 0), 600000);
begin
  select watched_ms into v_prev from public.video_views where video_id = p_video and user_id = auth.uid();
  insert into public.video_views (video_id, user_id, watched_ms) values (p_video, auth.uid(), v_ms)
  on conflict (video_id, user_id) do update set watched_ms = greatest(public.video_views.watched_ms, excluded.watched_ms);
  -- Count one view per person, the first time they watch past 1.5 s.
  if coalesce(v_prev, 0) < 1500 and v_ms >= 1500 then
    update public.spotlight_videos set view_count = view_count + 1 where id = p_video;
  end if;
end;
$$;

create or replace function public.add_comment(p_video uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_owner uuid;
begin
  select user_id into v_owner from public.spotlight_videos where id = p_video and status = 'published';
  if v_owner is null or public.is_blocked_between(auth.uid(), v_owner) then raise exception 'video not available'; end if;
  if (select count(*) from public.video_comments where user_id = auth.uid() and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'you’re commenting too fast';
  end if;
  insert into public.video_comments (video_id, user_id, body) values (p_video, auth.uid(), btrim(p_body)) returning id into v_id;
  update public.spotlight_videos set comment_count = comment_count + 1 where id = p_video;
  return v_id;
end;
$$;

create or replace function public.remove_comment(p_comment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_video uuid;
begin
  update public.video_comments c set deleted_at = now()
    where c.id = p_comment and c.deleted_at is null
      and (c.user_id = auth.uid() or exists (select 1 from public.spotlight_videos v where v.id = c.video_id and v.user_id = auth.uid()))
    returning video_id into v_video;
  if v_video is not null then update public.spotlight_videos set comment_count = greatest(0, comment_count - 1) where id = v_video; end if;
end;
$$;

-- Moderation: 3 distinct reports hide a video until reviewed.
create or replace function public.report_video(p_video uuid, p_reason text, p_details text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_n int;
begin
  select user_id into v_owner from public.spotlight_videos where id = p_video;
  if v_owner is null then raise exception 'video not found'; end if;
  if exists (select 1 from public.reports where reporter_id = auth.uid() and target_video_id = p_video) then return; end if;
  insert into public.reports (reporter_id, target_user_id, target_video_id, reason, details) values (auth.uid(), v_owner, p_video, p_reason, left(p_details, 1000));
  select count(distinct reporter_id) into v_n from public.reports where target_video_id = p_video;
  update public.spotlight_videos set report_count = v_n, status = case when v_n >= 3 and status = 'published' then 'hidden' else status end where id = p_video;
end;
$$;

-- Feed: simple, transparent ranking — engagement × freshness, boosted by follows and interests.
create or replace function public.spotlight_feed(p_category text default null, p_offset int default 0, p_limit int default 10, p_query text default null)
returns table (id uuid, user_id uuid, username text, display_name text, avatar_url text, aura_color text,
               media_path text, poster_path text, caption text, category text, media_meta jsonb,
               like_count int, comment_count int, view_count int, save_count int, created_at timestamptz,
               liked boolean, saved boolean, following boolean, score double precision)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as uid, coalesce((select interests from public.user_settings where user_id = auth.uid()), '{}') as interests)
  select v.id, v.user_id, p.username::text, p.display_name, p.avatar_url, p.aura_color,
         v.media_path, v.poster_path, v.caption, v.category, v.media_meta,
         v.like_count, v.comment_count, v.view_count, v.save_count, v.created_at,
         exists (select 1 from public.video_likes l where l.video_id = v.id and l.user_id = me.uid),
         exists (select 1 from public.video_saves s where s.video_id = v.id and s.user_id = me.uid),
         exists (select 1 from public.follows f where f.follower_id = me.uid and f.followee_id = v.user_id),
         ((1 + v.like_count * 3 + v.comment_count * 4 + v.save_count * 5 + v.view_count * 0.2)
            / power(extract(epoch from (now() - v.created_at)) / 3600 + 2, 1.35))
           * (case when exists (select 1 from public.follows f where f.follower_id = me.uid and f.followee_id = v.user_id) then 2.0 else 1.0 end)
           * (case when v.category = any(me.interests) then 1.6 else 1.0 end)
           * (case when exists (select 1 from public.video_views w where w.video_id = v.id and w.user_id = me.uid) then 0.25 else 1.0 end) as score
  from public.spotlight_videos v
  join public.profiles p on p.id = v.user_id
  cross join me
  where v.status = 'published'
    and not public.is_blocked_between(me.uid, v.user_id)
    and (p_category is null or v.category = p_category)
    and (p_query is null or v.caption ilike '%' || p_query || '%' or p.username::text ilike p_query || '%' or p.display_name ilike '%' || p_query || '%')
  order by score desc, v.created_at desc
  offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 30);
$$;

create or replace function public.creator_profile(p_username text)
returns table (id uuid, username text, display_name text, bio text, avatar_url text, aura_color text,
               followers int, following int, videos int, likes int, is_following boolean, is_friend boolean, is_me boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name, p.bio, p.avatar_url, p.aura_color,
    (select count(*)::int from public.follows where followee_id = p.id),
    (select count(*)::int from public.follows where follower_id = p.id),
    (select count(*)::int from public.spotlight_videos where user_id = p.id and status = 'published'),
    (select coalesce(sum(like_count), 0)::int from public.spotlight_videos where user_id = p.id and status = 'published'),
    exists (select 1 from public.follows where follower_id = auth.uid() and followee_id = p.id),
    public.are_friends(auth.uid(), p.id),
    p.id = auth.uid()
  from public.profiles p
  where p.username = lower(btrim(p_username))::extensions.citext and not public.is_blocked_between(auth.uid(), p.id);
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('spotlight', 'spotlight', true, 52428800, array['video/mp4','video/webm','video/quicktime','image/webp','image/jpeg'])
on conflict (id) do nothing;
create policy "spotlight creators upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'spotlight' and (storage.foldername(name))[1] = (select auth.uid())::text);

do $$
declare f text;
begin
  foreach f in array array['add_memory(uuid,text,text,jsonb,bigint,timestamptz)','memory_usage()',
    'publish_spotlight(uuid,text,text,text,text,jsonb)','remove_spotlight(uuid)','record_view(uuid,int)',
    'add_comment(uuid,text)','remove_comment(uuid)','report_video(uuid,text,text)',
    'spotlight_feed(text,int,int,text)','creator_profile(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public.spotlight_counters() from public, anon, authenticated;
