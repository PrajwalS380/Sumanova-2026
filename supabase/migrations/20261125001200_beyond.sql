-- Batch 7 (owner-approved 2026-11-25, "beyond Snapchat"): Hangouts, chat mini-games, safety
-- check-in, mood status, shared albums, end-to-end encryption keys.

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text','image','video','voice','sticker','system','snap','poll','location','hangout','game'));

-- ---------------------------------------------------------------------------
-- Hangouts: plan a meetup in a chat, RSVP, check in when you're there.
-- The chat message (kind 'hangout') carries media_meta.hangout_id.
-- ---------------------------------------------------------------------------
create table if not exists public.hangouts (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  creator_id       uuid not null references auth.users (id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 1 and 80),
  place_name       text check (char_length(place_name) <= 120),
  lat              double precision check (lat between -90 and 90),
  lng              double precision check (lng between -180 and 180),
  starts_at        timestamptz not null,
  created_at       timestamptz not null default now(),
  cancelled_at     timestamptz
);
create table if not exists public.hangout_rsvps (
  hangout_id     uuid not null references public.hangouts (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  status         text not null check (status in ('going','maybe','no')),
  checked_in_at  timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (hangout_id, user_id)
);
alter table public.hangouts enable row level security;
alter table public.hangout_rsvps enable row level security;
create policy "members see hangouts" on public.hangouts for select to authenticated using (public.is_member(conversation_id));
create policy "members see rsvps" on public.hangout_rsvps for select to authenticated
  using (exists (select 1 from public.hangouts h where h.id = hangout_id and public.is_member(h.conversation_id)));
alter publication supabase_realtime add table public.hangout_rsvps;

create or replace function public.create_hangout(p_conversation uuid, p_title text, p_place text, p_lat double precision, p_lng double precision, p_starts_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_member(p_conversation) then raise exception 'not in this chat'; end if;
  if p_starts_at < now() - interval '1 hour' or p_starts_at > now() + interval '180 days' then raise exception 'pick a time in the next 6 months'; end if;
  insert into public.hangouts (conversation_id, creator_id, title, place_name, lat, lng, starts_at)
    values (p_conversation, auth.uid(), btrim(p_title), nullif(btrim(coalesce(p_place, '')), ''), p_lat, p_lng, p_starts_at) returning id into v_id;
  insert into public.hangout_rsvps (hangout_id, user_id, status) values (v_id, auth.uid(), 'going');
  insert into public.messages (conversation_id, client_id, kind, body, media_meta)
    values (p_conversation, gen_random_uuid(), 'hangout', btrim(p_title), jsonb_build_object('hangout_id', v_id));
  return v_id;
end;
$$;

create or replace function public.rsvp_hangout(p_hangout uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare h public.hangouts;
begin
  select * into h from public.hangouts where id = p_hangout;
  if not found or not public.is_member(h.conversation_id) then raise exception 'hangout not found'; end if;
  if h.cancelled_at is not null then raise exception 'this hangout was cancelled'; end if;
  if p_status not in ('going','maybe','no') then raise exception 'invalid answer'; end if;
  insert into public.hangout_rsvps (hangout_id, user_id, status) values (p_hangout, auth.uid(), p_status)
    on conflict (hangout_id, user_id) do update set status = excluded.status, updated_at = now();
end;
$$;

-- Check in: within 2 h of the start, and (if the hangout has a place) within ~400 m of it.
create or replace function public.checkin_hangout(p_hangout uuid, p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = '' as $$
declare h public.hangouts; v_dist double precision;
begin
  select * into h from public.hangouts where id = p_hangout;
  if not found or not public.is_member(h.conversation_id) then raise exception 'hangout not found'; end if;
  if now() not between h.starts_at - interval '2 hours' and h.starts_at + interval '6 hours' then raise exception 'check-in opens 2 hours before it starts'; end if;
  if h.lat is not null then
    v_dist := 6371000 * sqrt(power(radians(p_lat - h.lat), 2) + power(radians(p_lng - h.lng) * cos(radians(h.lat)), 2));
    if v_dist > 400 then raise exception 'you’re % m away — check in when you get there', round(v_dist); end if;
  end if;
  insert into public.hangout_rsvps (hangout_id, user_id, status, checked_in_at) values (p_hangout, auth.uid(), 'going', now())
    on conflict (hangout_id, user_id) do update set status = 'going', checked_in_at = now(), updated_at = now();
  perform public.post_system_message(h.conversation_id, public.display_name_of(auth.uid()) || ' checked in at ' || h.title);
end;
$$;

create or replace function public.cancel_hangout(p_hangout uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare h public.hangouts;
begin
  update public.hangouts set cancelled_at = now() where id = p_hangout and creator_id = auth.uid() and cancelled_at is null returning * into h;
  if not found then raise exception 'only the planner can cancel'; end if;
  perform public.post_system_message(h.conversation_id, h.title || ' was cancelled');
end;
$$;

-- ---------------------------------------------------------------------------
-- Chat mini-games (tic-tac-toe, four-in-a-row). State lives on the message; moves are validated here.
-- ---------------------------------------------------------------------------
create or replace function public.start_game(p_conversation uuid, p_game text, p_opponent uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_board jsonb;
begin
  if auth.uid() is null or not public.is_member(p_conversation) then raise exception 'not in this chat'; end if;
  if p_game not in ('ttt','c4') then raise exception 'unknown game'; end if;
  if p_opponent is null or p_opponent = auth.uid()
     or not exists (select 1 from public.conversation_members where conversation_id = p_conversation and user_id = p_opponent) then
    raise exception 'pick someone in this chat';
  end if;
  v_board := case when p_game = 'ttt' then to_jsonb(array_fill(0, array[9])) else to_jsonb(array_fill(0, array[42])) end;
  insert into public.messages (conversation_id, client_id, kind, body, media_meta)
    values (p_conversation, gen_random_uuid(), 'game', case when p_game = 'ttt' then 'Tic-tac-toe' else 'Four in a row' end,
            jsonb_build_object('game', p_game, 'players', jsonb_build_array(auth.uid(), p_opponent), 'board', v_board, 'turn', 0, 'winner', null, 'moves', 0))
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.game_winner(p_game text, b int[])
returns int language plpgsql immutable set search_path = '' as $$
declare
  lines int[][] := array[[1,2,3],[4,5,6],[7,8,9],[1,4,7],[2,5,8],[3,6,9],[1,5,9],[3,5,7]];
  i int; r int; c int; dr int; dc int; k int; p int; ok boolean; dirs int[][] := array[[0,1],[1,0],[1,1],[1,-1]];
begin
  if p_game = 'ttt' then
    for i in 1..8 loop
      if b[lines[i][1]] <> 0 and b[lines[i][1]] = b[lines[i][2]] and b[lines[i][2]] = b[lines[i][3]] then return b[lines[i][1]]; end if;
    end loop;
    return case when 0 = any(b) then 0 else 3 end;
  end if;
  -- four in a row on a 6×7 grid (index = row*7 + col + 1, row 0 = top)
  for r in 0..5 loop for c in 0..6 loop
    p := b[r * 7 + c + 1];
    continue when p = 0;
    for i in 1..4 loop
      dr := dirs[i][1]; dc := dirs[i][2]; ok := true;
      for k in 1..3 loop
        if r + dr * k not between 0 and 5 or c + dc * k not between 0 and 6 or b[(r + dr * k) * 7 + c + dc * k + 1] <> p then ok := false; exit; end if;
      end loop;
      if ok then return p; end if;
    end loop;
  end loop; end loop;
  return case when 0 = any(b) then 0 else 3 end;
end;
$$;

-- p_cell: tic-tac-toe 0–8; four-in-a-row = column 0–6 (the piece drops).
create or replace function public.game_move(p_message uuid, p_cell int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.messages; meta jsonb; b int[]; me_idx int; turn int; g text; r int; idx int; w int;
begin
  select * into m from public.messages where id = p_message and kind = 'game' for update;
  if not found or not public.is_member(m.conversation_id) then raise exception 'game not found'; end if;
  meta := m.media_meta;
  if meta ->> 'winner' is not null then raise exception 'this game is over'; end if;
  g := meta ->> 'game';
  me_idx := case when (meta -> 'players' ->> 0)::uuid = auth.uid() then 0 when (meta -> 'players' ->> 1)::uuid = auth.uid() then 1 else null end;
  if me_idx is null then raise exception 'you’re not playing this one'; end if;
  turn := (meta ->> 'turn')::int;
  if turn <> me_idx then raise exception 'not your turn'; end if;
  select array_agg(x::int order by o) into b from jsonb_array_elements_text(meta -> 'board') with ordinality as t(x, o);
  if g = 'ttt' then
    if p_cell not between 0 and 8 or b[p_cell + 1] <> 0 then raise exception 'pick an empty square'; end if;
    b[p_cell + 1] := me_idx + 1;
  else
    if p_cell not between 0 and 6 then raise exception 'pick a column'; end if;
    idx := null;
    for r in reverse 5..0 loop
      if b[r * 7 + p_cell + 1] = 0 then idx := r * 7 + p_cell + 1; exit; end if;
    end loop;
    if idx is null then raise exception 'that column is full'; end if;
    b[idx] := me_idx + 1;
  end if;
  w := public.game_winner(g, b);
  meta := meta || jsonb_build_object('board', to_jsonb(b), 'turn', 1 - me_idx, 'moves', (meta ->> 'moves')::int + 1,
                                     'winner', case when w = 0 then null when w = 3 then 'draw' else meta -> 'players' ->> (w - 1) end);
  update public.messages set media_meta = meta where id = p_message;
  return meta;
end;
$$;

-- ---------------------------------------------------------------------------
-- Safety check-in: "I'll check in by 11 pm". Friends get an alert with your last shared
-- location if you don't. Your location is shared with them while it's on.
-- ---------------------------------------------------------------------------
create table if not exists public.safety_checkins (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  friends        uuid[] not null,
  note           text check (char_length(note) <= 140),
  due_at         timestamptz not null,
  created_at     timestamptz not null default now(),
  checked_in_at  timestamptz,
  alerted_at     timestamptz
);
create index if not exists safety_due on public.safety_checkins (due_at) where checked_in_at is null and alerted_at is null;
alter table public.safety_checkins enable row level security;
create policy "own or watching check-ins" on public.safety_checkins for select to authenticated
  using (user_id = (select auth.uid()) or (select auth.uid()) = any (friends));

create or replace function public.start_safety_checkin(p_friends uuid[], p_due timestamptz, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_friends uuid[]; f uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select coalesce(array_agg(x), '{}') into v_friends from unnest(coalesce(p_friends, '{}')) x where public.are_friends(auth.uid(), x);
  if coalesce(array_length(v_friends, 1), 0) = 0 then raise exception 'pick at least one friend'; end if;
  if p_due < now() + interval '5 minutes' or p_due > now() + interval '24 hours' then raise exception 'pick a time from 5 minutes to 24 hours from now'; end if;
  update public.safety_checkins set checked_in_at = now() where user_id = auth.uid() and checked_in_at is null and alerted_at is null;
  insert into public.safety_checkins (user_id, friends, note, due_at) values (auth.uid(), v_friends, left(btrim(coalesce(p_note, '')), 140), p_due) returning id into v_id;
  foreach f in array v_friends loop
    perform public.notify(f, 'system', public.display_name_of(auth.uid()) || ' started a safety check-in',
      'They’ll check in by ' || to_char(p_due at time zone 'Asia/Kolkata', 'HH12:MI AM') || '. We’ll tell you if they don’t.', '/map', auth.uid());
  end loop;
  return v_id;
end;
$$;

create or replace function public.finish_safety_checkin()
returns void language plpgsql security definer set search_path = '' as $$
declare c record; f uuid;
begin
  for c in update public.safety_checkins set checked_in_at = now() where user_id = auth.uid() and checked_in_at is null returning * loop
    foreach f in array c.friends loop
      perform public.notify(f, 'system', public.display_name_of(auth.uid()) || ' checked in safely', coalesce(nullif(c.note, ''), 'All good'), '/map', auth.uid());
    end loop;
  end loop;
end;
$$;

create or replace function public.alert_overdue_checkins()
returns int language plpgsql security definer set search_path = '' as $$
declare c record; f uuid; n int := 0; v_where text;
begin
  for c in update public.safety_checkins set alerted_at = now()
           where checked_in_at is null and alerted_at is null and due_at < now() returning * loop
    select case when l.expires_at > now() then 'Last shared location: ' || round(l.lat::numeric, 4) || ', ' || round(l.lng::numeric, 4) else 'No recent location shared' end
      into v_where from public.location_shares l where l.user_id = c.user_id;
    foreach f in array c.friends loop
      perform public.notify(f, 'system', public.display_name_of(c.user_id) || ' hasn’t checked in',
        coalesce(nullif(c.note, '') || ' · ', '') || coalesce(v_where, 'No recent location shared') || '. Try calling them.', '/map', c.user_id);
      n := n + 1;
    end loop;
  end loop;
  return n;
end;
$$;
revoke all on function public.alert_overdue_checkins() from public, anon, authenticated;
select cron.schedule('sumanova-safety-checkins', '*/5 * * * *', $$select public.alert_overdue_checkins()$$);

-- ---------------------------------------------------------------------------
-- Mood status (Nova emoji + a few words, 24 h), shown on the map and profile.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists mood_emoji text check (char_length(mood_emoji) <= 20),
  add column if not exists mood_text text check (char_length(mood_text) <= 40),
  add column if not exists mood_until timestamptz;

-- ---------------------------------------------------------------------------
-- Shared albums: friends add photos/videos to one album; anyone in it can make a recap.
-- ---------------------------------------------------------------------------
create table if not exists public.shared_albums (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 60),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create table if not exists public.shared_album_members (
  album_id  uuid not null references public.shared_albums (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  added_at  timestamptz not null default now(),
  left_at   timestamptz,
  primary key (album_id, user_id)
);
create table if not exists public.shared_album_items (
  id          uuid primary key default gen_random_uuid(),
  album_id    uuid not null references public.shared_albums (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('image','video')),
  media_path  text not null check (char_length(media_path) <= 200),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists shared_album_items_album on public.shared_album_items (album_id, created_at desc);
alter table public.shared_albums enable row level security;
alter table public.shared_album_members enable row level security;
alter table public.shared_album_items enable row level security;

create or replace function public.is_album_member(p_album uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shared_album_members m join public.shared_albums a on a.id = m.album_id
                 where m.album_id = p_album and m.user_id = auth.uid() and m.left_at is null and a.deleted_at is null);
$$;
create policy "members see albums" on public.shared_albums for select to authenticated using (public.is_album_member(id));
create policy "members see members" on public.shared_album_members for select to authenticated using (public.is_album_member(album_id));
create policy "members see items" on public.shared_album_items for select to authenticated using (deleted_at is null and public.is_album_member(album_id));

create or replace function public.create_shared_album(p_title text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; u uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if (select count(*) from public.shared_albums where owner_id = auth.uid() and deleted_at is null) >= 50 then raise exception 'you can own up to 50 shared albums'; end if;
  insert into public.shared_albums (owner_id, title) values (auth.uid(), btrim(p_title)) returning id into v_id;
  insert into public.shared_album_members (album_id, user_id) values (v_id, auth.uid());
  foreach u in array coalesce(p_members, '{}') loop
    if public.are_friends(auth.uid(), u) then
      insert into public.shared_album_members (album_id, user_id) values (v_id, u) on conflict do nothing;
      perform public.notify(u, 'system', public.display_name_of(auth.uid()) || ' shared an album with you', btrim(p_title), '/albums/' || v_id, auth.uid());
    end if;
  end loop;
  return v_id;
end;
$$;

create or replace function public.add_album_item(p_album uuid, p_kind text, p_path text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_album_member(p_album) then raise exception 'not in this album'; end if;
  if p_path not like p_album::text || '/' || auth.uid()::text || '/%' then raise exception 'invalid path'; end if;
  if (select count(*) from public.shared_album_items where album_id = p_album and deleted_at is null) >= 500 then raise exception 'this album is full (500)'; end if;
  insert into public.shared_album_items (album_id, user_id, kind, media_path) values (p_album, auth.uid(), p_kind, p_path) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.remove_album_item(p_item uuid)
returns void language sql security definer set search_path = '' as $$
  update public.shared_album_items i set deleted_at = now()
  where i.id = p_item and (i.user_id = auth.uid() or exists (select 1 from public.shared_albums a where a.id = i.album_id and a.owner_id = auth.uid()));
$$;

create or replace function public.leave_shared_album(p_album uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.shared_albums where id = p_album and owner_id = auth.uid()) then
    update public.shared_albums set deleted_at = now() where id = p_album;
  else
    update public.shared_album_members set left_at = now() where album_id = p_album and user_id = auth.uid();
  end if;
end;
$$;

-- Album files: bucket "albums", path <album_id>/<user_id>/<file>. Members read, uploader writes own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('albums', 'albums', false, 31457280, array['image/jpeg','image/webp','image/png','video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

create or replace function public.can_read_album_object(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_album uuid;
begin
  begin
    v_album := (storage.foldername(p_name))[1]::uuid;
  exception when others then return false;
  end;
  return public.is_album_member(v_album);
end;
$$;
create policy "album members upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'albums' and (storage.foldername(name))[2] = (select auth.uid())::text and public.can_read_album_object(name));
create policy "album members read" on storage.objects for select to authenticated
  using (bucket_id = 'albums' and public.can_read_album_object(name));

-- ---------------------------------------------------------------------------
-- End-to-end encrypted ("secret") chats: each person's current public key (ECDH P-256).
-- Private keys never leave the phone. Old keys are kept (marked replaced) so history stays readable
-- on the device that has them.
-- ---------------------------------------------------------------------------
create table if not exists public.e2e_keys (
  key_id       uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  public_jwk   jsonb not null,
  created_at   timestamptz not null default now(),
  replaced_at  timestamptz
);
create index if not exists e2e_keys_user on public.e2e_keys (user_id, created_at desc);
alter table public.e2e_keys enable row level security;
create policy "signed-in users read public keys" on public.e2e_keys for select to authenticated using (true);

create or replace function public.publish_e2e_key(p_jwk jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_jwk ->> 'kty' <> 'EC' or p_jwk ->> 'crv' <> 'P-256' or p_jwk ? 'd' then raise exception 'invalid public key'; end if;
  update public.e2e_keys set replaced_at = now() where user_id = auth.uid() and replaced_at is null;
  insert into public.e2e_keys (user_id, public_jwk) values (auth.uid(), p_jwk - 'key_ops' - 'ext') returning key_id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_hangout(uuid, text, text, double precision, double precision, timestamptz), public.rsvp_hangout(uuid, text),
  public.checkin_hangout(uuid, double precision, double precision), public.cancel_hangout(uuid), public.start_game(uuid, text, uuid),
  public.game_move(uuid, int), public.start_safety_checkin(uuid[], timestamptz, text), public.finish_safety_checkin(),
  public.is_album_member(uuid), public.create_shared_album(text, uuid[]), public.add_album_item(uuid, text, text),
  public.remove_album_item(uuid), public.leave_shared_album(uuid), public.can_read_album_object(text), public.publish_e2e_key(jsonb) from public, anon;
grant execute on function public.create_hangout(uuid, text, text, double precision, double precision, timestamptz), public.rsvp_hangout(uuid, text),
  public.checkin_hangout(uuid, double precision, double precision), public.cancel_hangout(uuid), public.start_game(uuid, text, uuid),
  public.game_move(uuid, int), public.start_safety_checkin(uuid[], timestamptz, text), public.finish_safety_checkin(),
  public.is_album_member(uuid), public.create_shared_album(text, uuid[]), public.add_album_item(uuid, text, text),
  public.remove_album_item(uuid), public.leave_shared_album(uuid), public.can_read_album_object(text), public.publish_e2e_key(jsonb) to authenticated;
revoke all on function public.game_winner(text, int[]) from public, anon, authenticated;
