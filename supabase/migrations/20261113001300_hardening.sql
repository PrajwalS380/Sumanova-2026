-- Hardening after the security advisor review.
-- 1) Relationship helpers only answer about the caller (no probing other people's
--    friendships/blocks). Server contexts (cron, auth.uid() is null) are allowed.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (auth.uid() is null or auth.uid() in (a, b))
     and exists (select 1 from public.friendships where user_a = least(a, b) and user_b = greatest(a, b));
$$;

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (auth.uid() is null or auth.uid() in (a, b))
     and exists (select 1 from public.blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- 2) Trigger functions are never meant to be called through the API.
do $$
declare f text;
begin
  foreach f in array array['avatar_outfits_limit()','messages_after_insert()','messages_before_insert()','snaps_streak_trigger()',
    'trg_message_push()','trg_notify_calls()','trg_notify_comment()','trg_notify_follow()','trg_notify_friend_requests()',
    'trg_notify_snaps()','trg_notify_story_reaction()','trg_push_incoming_call()','set_updated_at()','profiles_guard_immutable()',
    'handle_new_user()','spotlight_counters()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- 3) Viewers may read their own Spotlight watch records (nothing else).
create policy "own video views" on public.video_views for select to authenticated using (user_id = (select auth.uid()));
