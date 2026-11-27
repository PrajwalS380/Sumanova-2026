-- Map batch E: favourite places, trips (route points while the app is open). Owner-only data.
-- Memories on the map use media_meta.place {lat,lng} saved with the memory (opt-in, rounded ~100 m).

create table if not exists public.favourite_places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  emoji       text not null default 'star' check (char_length(emoji) <= 20),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  created_at  timestamptz not null default now(),
  removed_at  timestamptz
);
create index if not exists favourite_places_user on public.favourite_places (user_id, created_at desc) where removed_at is null;
alter table public.favourite_places enable row level security;
create policy "own places read" on public.favourite_places for select to authenticated using (user_id = (select auth.uid()));
create policy "own places add" on public.favourite_places for insert to authenticated
  with check (user_id = (select auth.uid()) and (select count(*) from public.favourite_places f where f.user_id = (select auth.uid()) and f.removed_at is null) < 200);
-- (replaced in 20261127000500: the count inside the policy recursed; the limit moved to a trigger)
create policy "own places edit" on public.favourite_places for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 60),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  removed_at  timestamptz
);
create index if not exists trips_user on public.trips (user_id, started_at desc);
alter table public.trips enable row level security;
create policy "own trips read" on public.trips for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.trip_points (
  trip_id  uuid not null references public.trips (id) on delete cascade,
  at       timestamptz not null default now(),
  lat      double precision not null check (lat between -90 and 90),
  lng      double precision not null check (lng between -180 and 180),
  primary key (trip_id, at)
);
alter table public.trip_points enable row level security;
create policy "own trip points" on public.trip_points for select to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())));

create or replace function public.start_trip(p_title text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.trips set ended_at = now() where user_id = auth.uid() and ended_at is null;
  insert into public.trips (user_id, title) values (auth.uid(), btrim(p_title)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.end_trip(p_trip uuid)
returns void language sql security definer set search_path = '' as $$
  update public.trips set ended_at = now() where id = p_trip and user_id = auth.uid() and ended_at is null;
$$;

create or replace function public.remove_trip(p_trip uuid)
returns void language sql security definer set search_path = '' as $$
  update public.trips set removed_at = now(), ended_at = coalesce(ended_at, now()) where id = p_trip and user_id = auth.uid();
$$;

-- One point per minute at most, only on my running trip, at most 2000 points per trip.
create or replace function public.add_trip_point(p_trip uuid, p_lat double precision, p_lng double precision)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.trips where id = p_trip and user_id = auth.uid() and ended_at is null and removed_at is null) then return false; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then return false; end if;
  if exists (select 1 from public.trip_points where trip_id = p_trip and at > now() - interval '55 seconds') then return false; end if;
  if (select count(*) from public.trip_points where trip_id = p_trip) >= 2000 then return false; end if;
  insert into public.trip_points (trip_id, lat, lng) values (p_trip, round(p_lat::numeric, 5)::float8, round(p_lng::numeric, 5)::float8);
  return true;
end;
$$;

revoke all on function public.start_trip(text), public.end_trip(uuid), public.remove_trip(uuid), public.add_trip_point(uuid, double precision, double precision) from public, anon;
grant execute on function public.start_trip(text), public.end_trip(uuid), public.remove_trip(uuid), public.add_trip_point(uuid, double precision, double precision) to authenticated;
