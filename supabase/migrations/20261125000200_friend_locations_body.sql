-- UI v2: the map shows friends as full-body avatars, so return avatar_body_url too.
-- Return type changes, so the function is recreated (same rules as before).
drop function if exists public.friend_locations();
create function public.friend_locations()
returns table(user_id uuid, username text, display_name text, avatar_url text, avatar_body_url text, aura_color text,
              lat double precision, lng double precision, precise boolean, updated_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.username::text, p.display_name, p.avatar_url, p.avatar_body_url, p.aura_color,
         case when l.precise then l.lat else round(l.lat::numeric, 2)::double precision end,
         case when l.precise then l.lng else round(l.lng::numeric, 2)::double precision end,
         l.precise, l.updated_at, l.expires_at
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
