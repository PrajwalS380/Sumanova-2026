-- UI v2: full-body avatar image (used on the map, profiles and welcome screen).
-- avatar_url keeps the face/bust image used everywhere as the profile picture.
alter table public.profiles add column if not exists avatar_body_url text;
comment on column public.profiles.avatar_body_url is 'Public URL of the rendered full-body 3D avatar (PNG).';
