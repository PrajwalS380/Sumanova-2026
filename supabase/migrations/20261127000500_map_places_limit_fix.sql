-- The insert policy's count over favourite_places recursed into itself; keep the policy simple and
-- enforce the 200-place limit in a trigger instead.
drop policy if exists "own places add" on public.favourite_places;
create policy "own places add" on public.favourite_places for insert to authenticated with check (user_id = (select auth.uid()));
create or replace function public.favourite_places_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.favourite_places where user_id = new.user_id and removed_at is null) >= 200 then
    raise exception 'up to 200 saved places';
  end if;
  return new;
end;
$$;
drop trigger if exists favourite_places_limit on public.favourite_places;
create trigger favourite_places_limit before insert on public.favourite_places for each row execute function public.favourite_places_limit();
revoke all on function public.favourite_places_limit() from public, anon, authenticated;
