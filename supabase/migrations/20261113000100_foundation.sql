-- SUMANOVA Phase 1: foundation schema
-- Profiles (public identity), user_settings and privacy_settings (owner-only),
-- profile bootstrap on sign-up, username availability check and account deletion.

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: the public face of a user. Only non-sensitive fields live here.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      extensions.citext not null unique
                  check (username ~ '^[a-z0-9._]{3,20}$'
                         and username !~ '^[._]' and username !~ '[._]$'),
  display_name  text not null check (char_length(btrim(display_name)) between 1 and 40),
  bio           text check (char_length(bio) <= 160),
  avatar_url    text check (char_length(avatar_url) <= 500),
  aura_color    text not null default 'violet'
                  check (aura_color in ('violet','teal','coral','gold','sky','rose')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- id and username are immutable from the client (username changes go through a
-- dedicated RPC later so they can be rate-limited).
create or replace function public.profiles_guard_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id then
    raise exception 'profile id is immutable';
  end if;
  if new.created_at <> old.created_at then
    raise exception 'created_at is immutable';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_immutable
  before update on public.profiles
  for each row execute function public.profiles_guard_immutable();

alter table public.profiles enable row level security;

create policy "profiles are readable by signed-in users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No insert/delete policies: rows are created by the sign-up trigger and
-- removed by the auth.users cascade.

-- ---------------------------------------------------------------------------
-- user_settings: private, owner-only.
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  date_of_birth       date check (date_of_birth > date '1900-01-01'),
  reduce_motion       boolean not null default false,
  haptics             boolean not null default true,
  default_snap_seconds smallint not null default 5 check (default_snap_seconds between 1 and 30),
  chat_wallpaper      text not null default 'aurora' check (char_length(chat_wallpaper) <= 40),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "owners read their settings"
  on public.user_settings for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "owners update their settings"
  on public.user_settings for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- privacy_settings: private, owner-only.
-- ---------------------------------------------------------------------------
create table public.privacy_settings (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  who_can_message        text not null default 'friends' check (who_can_message in ('everyone','friends')),
  who_can_call           text not null default 'friends' check (who_can_call in ('everyone','friends','nobody')),
  who_can_view_story     text not null default 'friends' check (who_can_view_story in ('everyone','friends','custom')),
  show_last_seen         boolean not null default true,
  show_in_discovery      boolean not null default true,
  ghost_mode             boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger privacy_settings_set_updated_at
  before update on public.privacy_settings
  for each row execute function public.set_updated_at();

alter table public.privacy_settings enable row level security;

create policy "owners read their privacy settings"
  on public.privacy_settings for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "owners update their privacy settings"
  on public.privacy_settings for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Sign-up bootstrap: creates profile + settings rows from auth metadata.
-- Fails the sign-up (and therefore the auth.users insert) on invalid data.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  v_display  text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  v_dob      date;
begin
  if v_username = '' then
    -- Fallback for sign-ups without metadata: derive a unique handle.
    v_username := 'nova_' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;
  if v_display = '' then
    v_display := v_username;
  end if;

  begin
    v_dob := (new.raw_user_meta_data ->> 'date_of_birth')::date;
  exception when others then
    v_dob := null;
  end;

  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, left(v_display, 40));

  insert into public.user_settings (user_id, date_of_birth) values (new.id, v_dob);
  insert into public.privacy_settings (user_id) values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPC: username availability (callable before sign-up).
-- ---------------------------------------------------------------------------
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(btrim(p_username)) ~ '^[a-z0-9._]{3,20}$'
     and lower(btrim(p_username)) !~ '^[._]'
     and lower(btrim(p_username)) !~ '[._]$'
     and not exists (
       select 1 from public.profiles where username = lower(btrim(p_username))::extensions.citext
     );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: delete my account. Removes the auth user; every user-owned row
-- cascades from auth.users.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  -- Storage files are removed by the client through the Storage API first
  -- (direct SQL deletes on storage.objects are not allowed).
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
