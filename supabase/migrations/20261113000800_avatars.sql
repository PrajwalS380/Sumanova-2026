-- SUMANOVA Phase 5: avatar studio.
-- The avatar is stored as structured data (jsonb config), not a flattened image.
-- A rendered PNG can optionally be published as the profile photo.

create table public.avatars (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  config      jsonb not null check (pg_column_size(config) < 8192),
  version     smallint not null default 1,
  updated_at  timestamptz not null default now()
);

create trigger avatars_set_updated_at before update on public.avatars
  for each row execute function public.set_updated_at();

create table public.avatar_outfits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 30),
  outfit      jsonb not null check (pg_column_size(outfit) < 4096),
  created_at  timestamptz not null default now()
);
create index avatar_outfits_user on public.avatar_outfits (user_id, created_at desc);

alter table public.avatars enable row level security;
alter table public.avatar_outfits enable row level security;

-- Avatars are public within the app (like a profile photo) so they can appear in chats and duo stickers.
create policy "signed-in users see avatars" on public.avatars for select to authenticated using (true);
create policy "owners create their avatar" on public.avatars for insert to authenticated with check (user_id = (select auth.uid()));
create policy "owners update their avatar" on public.avatars for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "owners see outfits" on public.avatar_outfits for select to authenticated using (user_id = (select auth.uid()));
create policy "owners add outfits" on public.avatar_outfits for insert to authenticated with check (user_id = (select auth.uid()));

-- Cap saved outfits per user.
create or replace function public.avatar_outfits_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.avatar_outfits where user_id = new.user_id) >= 20 then
    raise exception 'you can save up to 20 outfits';
  end if;
  return new;
end;
$$;
create trigger avatar_outfits_limit before insert on public.avatar_outfits
  for each row execute function public.avatar_outfits_limit();
