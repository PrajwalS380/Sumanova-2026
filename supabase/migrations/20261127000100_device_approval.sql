-- New-device approval (opt-in, Settings → Security). When it's on, a sign-in from a device that
-- hasn't been trusted yet can't read or send messages, snaps, memories or locations (enforced here,
-- at the database, not only in the app) until one of the person's trusted devices approves it,
-- the session passes two-step login, or 24 hours pass without a "Not me".
create table if not exists public.device_trust (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  enabled     boolean not null default false,
  enabled_at  timestamptz
);
alter table public.device_trust enable row level security;
create policy "own trust setting" on public.device_trust for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.device_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  session_id  text not null check (char_length(session_id) between 8 and 64),
  device_key  text not null check (char_length(device_key) between 8 and 64),
  device      text not null check (char_length(device) between 1 and 80),
  status      text not null default 'pending' check (status in ('pending','approved','denied')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  unique (user_id, session_id)
);
create index if not exists device_sessions_user on public.device_sessions (user_id, created_at desc);
alter table public.device_sessions enable row level security;
create policy "own device sessions" on public.device_sessions for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.device_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select not coalesce((select enabled from public.device_trust where user_id = auth.uid()), false)
      or coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
      or exists (
        select 1 from public.device_sessions d
        where d.user_id = auth.uid() and d.session_id = (auth.jwt() ->> 'session_id')
          and (d.status = 'approved' or (d.status = 'pending' and d.created_at < now() - interval '24 hours'))
      );
$$;

-- Called by the app after every sign-in / start. Returns approved | pending | denied.
create or replace function public.device_check(p_device_key text, p_device text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_on boolean; v_at timestamptz; v_sid text := auth.jwt() ->> 'session_id'; v_row public.device_sessions; v_known boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select enabled, enabled_at into v_on, v_at from public.device_trust where user_id = auth.uid();
  if not coalesce(v_on, false) or v_sid is null then return 'approved'; end if;
  select * into v_row from public.device_sessions where user_id = auth.uid() and session_id = v_sid;
  if found then
    if v_row.status = 'pending' and v_row.created_at < now() - interval '24 hours' then
      update public.device_sessions set status = 'approved', decided_at = now() where id = v_row.id;
      return 'approved';
    end if;
    return v_row.status;
  end if;
  -- a device that was already in use before approval was turned on, or was approved before, is trusted
  v_known := exists (select 1 from public.device_sessions where user_id = auth.uid() and device_key = p_device_key and status = 'approved')
          or exists (select 1 from public.login_events where user_id = auth.uid() and device_key = p_device_key and created_at < v_at);
  if (select count(*) from public.device_sessions where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'too many sign-ins — try again later';
  end if;
  insert into public.device_sessions (user_id, session_id, device_key, device, status, decided_at)
  values (auth.uid(), v_sid, left(p_device_key, 64), left(btrim(p_device), 80), case when v_known then 'approved' else 'pending' end, case when v_known then now() end);
  if not v_known then
    perform public.notify(auth.uid(), 'system', 'Approve sign-in on ' || left(btrim(p_device), 60) || '?',
      'Someone signed in to your account. Approve it in Settings → Security if it was you.', '/settings', null);
  end if;
  return case when v_known then 'approved' else 'pending' end;
end;
$$;

create or replace function public.device_requests()
returns table (id uuid, device text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select id, device, created_at from public.device_sessions
  where public.device_ok() and user_id = auth.uid() and status = 'pending'
    and session_id <> coalesce(auth.jwt() ->> 'session_id', '') and created_at > now() - interval '24 hours'
  order by created_at desc limit 20;
$$;

create or replace function public.device_decide(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.device_ok() then raise exception 'not allowed from this device'; end if;
  update public.device_sessions set status = case when p_approve then 'approved' else 'denied' end, decided_at = now()
  where id = p_id and user_id = auth.uid() and status = 'pending' and session_id <> coalesce(auth.jwt() ->> 'session_id', '');
  if not found then raise exception 'request not found'; end if;
end;
$$;

create or replace function public.set_device_approval(p_on boolean, p_device_key text, p_device text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_sid text := auth.jwt() ->> 'session_id';
begin
  if auth.uid() is null or not public.device_ok() then raise exception 'not allowed from this device'; end if;
  insert into public.device_trust (user_id, enabled, enabled_at) values (auth.uid(), p_on, case when p_on then now() end)
  on conflict (user_id) do update set enabled = p_on, enabled_at = case when p_on then now() else null end;
  if p_on and v_sid is not null then
    insert into public.device_sessions (user_id, session_id, device_key, device, status, decided_at)
    values (auth.uid(), v_sid, left(p_device_key, 64), left(btrim(p_device), 80), 'approved', now())
    on conflict (user_id, session_id) do update set status = 'approved', decided_at = now();
  end if;
end;
$$;

revoke all on function public.device_ok(), public.device_check(text, text), public.device_requests(), public.device_decide(uuid, boolean), public.set_device_approval(boolean, text, text) from public, anon;
grant execute on function public.device_ok(), public.device_check(text, text), public.device_requests(), public.device_decide(uuid, boolean), public.set_device_approval(boolean, text, text) to authenticated;

create policy "device approval gate" on public.messages as restrictive for all to authenticated using ((select public.device_ok())) with check ((select public.device_ok()));
create policy "device approval gate" on public.memories as restrictive for all to authenticated using ((select public.device_ok())) with check ((select public.device_ok()));
create policy "device approval gate" on public.snap_recipients as restrictive for all to authenticated using ((select public.device_ok())) with check ((select public.device_ok()));
create policy "device approval gate" on public.location_shares as restrictive for all to authenticated using ((select public.device_ok())) with check ((select public.device_ok()));
