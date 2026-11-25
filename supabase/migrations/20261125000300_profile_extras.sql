-- Bento round (owner-approved 2026-11-25): profile scene, selfie-or-avatar picture,
-- birthdays & zodiac.
--
-- * profiles.profile_scene — backdrop behind the full-body avatar on the profile.
-- * profiles.avatar_face_url — the rendered avatar face, kept even when the person
--   uses a selfie as their picture (profiles.avatar_url is "what friends see").
-- * profiles.photo_mode — true while avatar_url is a selfie / gallery photo.
-- * privacy_settings.show_birthday — friends may see day + month (never the year).
-- * friend_birthdays() — friends' day/month only; the date of birth itself stays
--   in the owner-only user_settings table.

alter table public.profiles
  add column if not exists profile_scene text not null default 'dusk'
    check (profile_scene in ('dusk', 'mural', 'beach', 'night')),
  add column if not exists avatar_face_url text check (char_length(avatar_face_url) <= 500),
  add column if not exists photo_mode boolean not null default false;

-- Existing avatars: the current picture is the rendered face.
update public.profiles set avatar_face_url = avatar_url
where avatar_face_url is null and avatar_url is not null and not photo_mode;

alter table public.privacy_settings
  add column if not exists show_birthday boolean not null default true;

create or replace function public.friend_birthdays()
returns table(user_id uuid, username text, display_name text, avatar_url text, aura_color text, month int, day int)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.username::text, p.display_name, p.avatar_url, p.aura_color,
         extract(month from s.date_of_birth)::int, extract(day from s.date_of_birth)::int
  from public.user_settings s
  join public.profiles p on p.id = s.user_id
  join public.privacy_settings ps on ps.user_id = s.user_id
  where s.date_of_birth is not null
    and ps.show_birthday
    and s.user_id <> auth.uid()
    and public.are_friends(auth.uid(), s.user_id)
    and not public.is_blocked_between(auth.uid(), s.user_id);
$$;
revoke all on function public.friend_birthdays() from public, anon;
grant execute on function public.friend_birthdays() to authenticated;
