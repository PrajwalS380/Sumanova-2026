-- Batch 1 (owner-approved 2026-11-25): find friends from phone contacts, people you may know.
--
-- Privacy model
-- * A phone number is never stored in plain text. phone_numbers keeps only the SHA-256 of the
--   E.164 number (to match contacts) and the last 4 digits (to show "•••• 3210" in Settings).
-- * Address books leave the phone only as SHA-256 hashes of E.164 numbers (hashed on device).
--   contact_books keeps the latest set so a contact who joins later is suggested at once
--   (notification + suggestion). Turning sync off empties the set.
-- * privacy_settings.find_by_phone lets anyone opt out of being found by number.
-- * Every read goes through security-definer functions that answer only about the caller,
--   skip blocked people and are rate-limited.

alter table public.privacy_settings
  add column if not exists find_by_phone boolean not null default true;

create table if not exists public.phone_numbers (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  phone_hash  text check (phone_hash ~ '^[0-9a-f]{64}$'),
  last4       text check (last4 ~ '^[0-9]{4}$'),
  updated_at  timestamptz not null default now()
);
create unique index if not exists phone_numbers_hash on public.phone_numbers (phone_hash) where phone_hash is not null;
alter table public.phone_numbers enable row level security;
create policy "own phone" on public.phone_numbers for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.contact_books (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  hashes        text[] not null default '{}',
  synced_at     timestamptz not null default now(),
  window_start  timestamptz not null default now(),
  window_count  int not null default 0
);
create index if not exists contact_books_hashes on public.contact_books using gin (hashes);
alter table public.contact_books enable row level security;
create policy "own contact book" on public.contact_books for select to authenticated using (user_id = (select auth.uid()));

-- E.164-ish normalisation shared by set_phone (the client sends +<country><number>).
create or replace function public.phone_hash_of(p text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest('+' || regexp_replace(p, '\D', '', 'g'), 'sha256'), 'hex');
$$;
revoke all on function public.phone_hash_of(text) from public, anon, authenticated;

create or replace function public.set_phone(p_phone text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_hash text;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if v_digits = '' then
    insert into public.phone_numbers (user_id, phone_hash, last4) values (v_me, null, null)
      on conflict (user_id) do update set phone_hash = null, last4 = null, updated_at = now();
    return null;
  end if;
  if btrim(p_phone) !~ '^\+' or char_length(v_digits) not between 8 and 15 then
    raise exception 'enter the number with its country code, like +91 98765 43210';
  end if;
  v_hash := public.phone_hash_of(v_digits);
  if exists (select 1 from public.phone_numbers where phone_hash = v_hash and user_id <> v_me) then
    raise exception 'this number is already used by another account';
  end if;
  insert into public.phone_numbers (user_id, phone_hash, last4) values (v_me, v_hash, right(v_digits, 4))
    on conflict (user_id) do update set phone_hash = excluded.phone_hash, last4 = excluded.last4, updated_at = now();
  return right(v_digits, 4);
end;
$$;

-- People in my stored address book who are on SUMANOVA (and findable), not friends yet.
create or replace function public.contact_suggestions()
returns table (id uuid, username text, display_name text, avatar_url text, aura_color text, relation text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name, p.avatar_url, p.aura_color,
         case when exists (select 1 from public.friend_requests r where r.status = 'pending' and r.sender_id = auth.uid() and r.receiver_id = p.id)
              then 'outgoing'
              when exists (select 1 from public.friend_requests r where r.status = 'pending' and r.sender_id = p.id and r.receiver_id = auth.uid())
              then 'incoming'
              else 'none' end
  from public.contact_books b
  join public.phone_numbers n on n.phone_hash = any (b.hashes)
  join public.profiles p on p.id = n.user_id
  left join public.privacy_settings ps on ps.user_id = p.id
  where b.user_id = auth.uid()
    and p.id <> auth.uid()
    and coalesce(ps.find_by_phone, true)
    and not public.are_friends(auth.uid(), p.id)
    and not public.is_blocked_between(auth.uid(), p.id)
  order by p.display_name
  limit 100;
$$;

-- Replace my address book (hashes only) and get the matches. Max 5000 contacts, 30 syncs/hour.
create or replace function public.sync_contacts(p_hashes text[])
returns table (id uuid, username text, display_name text, avatar_url text, aura_color text, relation text)
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_clean text[];
  v_row public.contact_books;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if coalesce(array_length(p_hashes, 1), 0) > 5000 then raise exception 'too many contacts'; end if;
  select coalesce(array_agg(distinct h), '{}') into v_clean
    from unnest(coalesce(p_hashes, '{}')) h where h ~ '^[0-9a-f]{64}$';

  select * into v_row from public.contact_books where user_id = v_me;
  if found and v_row.window_start > now() - interval '1 hour' and v_row.window_count >= 30 then
    raise exception 'contacts were synced a lot just now — try again later';
  end if;
  insert into public.contact_books (user_id, hashes, synced_at, window_start, window_count)
    values (v_me, v_clean, now(), now(), 1)
    on conflict (user_id) do update set
      hashes = excluded.hashes,
      synced_at = now(),
      window_start = case when public.contact_books.window_start > now() - interval '1 hour' then public.contact_books.window_start else now() end,
      window_count = case when public.contact_books.window_start > now() - interval '1 hour' then public.contact_books.window_count + 1 else 1 end;
  return query select * from public.contact_suggestions();
end;
$$;

-- Stop syncing: forget my address book.
create or replace function public.clear_contacts()
returns void language sql security definer set search_path = '' as $$
  update public.contact_books set hashes = '{}', synced_at = now() where user_id = auth.uid();
$$;

-- People you may know: friends of my friends, ranked by mutual friends.
create or replace function public.suggest_friends()
returns table (id uuid, username text, display_name text, avatar_url text, aura_color text, mutual int)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select case when f.user_a = auth.uid() then f.user_b else f.user_a end as friend
    from public.friendships f where auth.uid() in (f.user_a, f.user_b)
  ), fof as (
    select case when f.user_a = m.friend then f.user_b else f.user_a end as person, count(*)::int as mutual
    from mine m join public.friendships f on m.friend in (f.user_a, f.user_b)
    group by 1
  )
  select p.id, p.username::text, p.display_name, p.avatar_url, p.aura_color, fof.mutual
  from fof
  join public.profiles p on p.id = fof.person
  left join public.privacy_settings ps on ps.user_id = p.id
  where fof.person <> auth.uid()
    and fof.person not in (select friend from mine)
    and coalesce(ps.show_in_discovery, true)
    and not public.is_blocked_between(auth.uid(), p.id)
    and not exists (select 1 from public.friend_requests r where r.status = 'pending'
                    and ((r.sender_id = auth.uid() and r.receiver_id = p.id) or (r.sender_id = p.id and r.receiver_id = auth.uid())))
  order by fof.mutual desc, p.display_name
  limit 30;
$$;

-- When someone adds their number, tell everyone who has it in their contacts — right away.
create or replace function public.trg_phone_joined()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.phone_hash is null or new.phone_hash is not distinct from (case when tg_op = 'UPDATE' then old.phone_hash end) then
    return null;
  end if;
  if not coalesce((select find_by_phone from public.privacy_settings where user_id = new.user_id), true) then
    return null;
  end if;
  for r in
    select b.user_id from public.contact_books b
    where b.hashes @> array[new.phone_hash] and b.user_id <> new.user_id
      and not exists (select 1 from public.friendships f where f.user_a = least(b.user_id, new.user_id) and f.user_b = greatest(b.user_id, new.user_id))
      and not exists (select 1 from public.blocks k where (k.blocker_id = b.user_id and k.blocked_id = new.user_id) or (k.blocker_id = new.user_id and k.blocked_id = b.user_id))
    limit 500
  loop
    perform public.notify(r.user_id, 'system', public.display_name_of(new.user_id) || ' is on SUMANOVA', 'From your contacts — tap to add', '/friends', new.user_id);
  end loop;
  return null;
end;
$$;
drop trigger if exists phone_joined on public.phone_numbers;
create trigger phone_joined after insert or update of phone_hash on public.phone_numbers
  for each row execute function public.trg_phone_joined();

revoke all on function public.trg_phone_joined() from public, anon, authenticated;
revoke all on function public.set_phone(text), public.contact_suggestions(), public.sync_contacts(text[]),
  public.clear_contacts(), public.suggest_friends() from public, anon;
grant execute on function public.set_phone(text), public.contact_suggestions(), public.sync_contacts(text[]),
  public.clear_contacts(), public.suggest_friends() to authenticated;
