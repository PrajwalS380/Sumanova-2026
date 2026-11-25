-- Two-step login (TOTP, Supabase Auth built-in). For people who turned it on, core private data
-- is locked at the database until the session has passed the code check (aal2) — not just hidden
-- in the app. People without two-step login are unaffected.
create or replace function public.mfa_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke all on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;

create policy "two-step gate" on public.messages as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()));
create policy "two-step gate" on public.memories as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()));
create policy "two-step gate" on public.snap_recipients as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()));
create policy "two-step gate" on public.user_settings as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()));
create policy "two-step gate" on public.location_shares as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()));
