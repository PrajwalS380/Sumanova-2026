-- SUMANOVA Phase 4: photo/video snaps.
-- Files live in the private "snaps" bucket at <sender_id>/<snap_id>.<ext> (+ optional
-- <snap_id>-overlay.png for video text/drawings). Recipients can only fetch the file
-- while the snap is unopened, or during a short window right after opening/replaying.
-- All state transitions happen in SECURITY DEFINER RPCs with server timestamps.

create table public.snaps (
  id              uuid primary key,
  sender_id       uuid not null references auth.users (id) on delete cascade,
  kind            text not null check (kind in ('image','video')),
  media_path      text not null check (char_length(media_path) <= 200),
  overlay_path    text check (char_length(overlay_path) <= 200),
  media_meta      jsonb not null default '{}'::jsonb,
  duration_seconds smallint check (duration_seconds is null or duration_seconds between 1 and 60), -- null = no limit (photos)
  allow_replay    boolean not null default true,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '30 days'
);
create index snaps_sender on public.snaps (sender_id, created_at desc);

create table public.snap_recipients (
  snap_id          uuid not null references public.snaps (id) on delete cascade,
  recipient_id     uuid not null references auth.users (id) on delete cascade,
  conversation_id  uuid references public.conversations (id) on delete set null,
  status           text not null default 'sent' check (status in ('sent','delivered','opened','replayed','expired')),
  delivered_at     timestamptz,
  opened_at        timestamptz,
  replayed_at      timestamptz,
  screenshot_at    timestamptz,
  primary key (snap_id, recipient_id)
);
create index snap_recipients_recipient on public.snap_recipients (recipient_id, status);

create or replace function public.is_snap_sender(p_snap uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.snaps where id = p_snap and sender_id = auth.uid());
$$;

alter table public.snaps enable row level security;
alter table public.snap_recipients enable row level security;

create policy "sender and recipients see snap" on public.snaps for select to authenticated
  using (sender_id = (select auth.uid())
         or exists (select 1 from public.snap_recipients r where r.snap_id = id and r.recipient_id = (select auth.uid())));

create policy "sender sees all recipients, recipient sees own row" on public.snap_recipients for select to authenticated
  using (recipient_id = (select auth.uid()) or public.is_snap_sender(snap_id));

-- ---------------------------------------------------------------------------
create or replace function public.send_snap(
  p_snap uuid, p_kind text, p_media_path text, p_overlay_path text, p_meta jsonb,
  p_duration int, p_allow_replay boolean, p_recipients uuid[]
) returns int language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  r uuid;
  v_conv uuid;
  v_key text;
  v_n int := 0;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if coalesce(array_length(p_recipients, 1), 0) = 0 then raise exception 'pick at least one friend'; end if;
  if array_length(p_recipients, 1) > 100 then raise exception 'too many recipients'; end if;
  if p_media_path not like v_me::text || '/' || p_snap::text || '.%' then raise exception 'invalid media path'; end if;
  if p_overlay_path is not null and p_overlay_path <> v_me::text || '/' || p_snap::text || '-overlay.png' then raise exception 'invalid overlay path'; end if;
  if (select count(*) from public.snaps where sender_id = v_me and created_at > now() - interval '1 hour') >= 200 then
    raise exception 'too many snaps, slow down';
  end if;

  insert into public.snaps (id, sender_id, kind, media_path, overlay_path, media_meta, duration_seconds, allow_replay)
  values (p_snap, v_me, p_kind, p_media_path, p_overlay_path, coalesce(p_meta, '{}'::jsonb),
          case when p_duration is null or p_duration <= 0 then null else least(p_duration, 60) end, coalesce(p_allow_replay, true));

  foreach r in array p_recipients loop
    continue when r = v_me or not public.are_friends(v_me, r) or public.is_blocked_between(v_me, r);
    v_key := least(v_me, r)::text || ':' || greatest(v_me, r)::text;
    select id into v_conv from public.conversations where direct_key = v_key;
    if v_conv is null then
      insert into public.conversations (kind, direct_key, created_by) values ('direct', v_key, v_me)
        on conflict (direct_key) do nothing returning id into v_conv;
      if v_conv is null then select id into v_conv from public.conversations where direct_key = v_key; end if;
      insert into public.conversation_members (conversation_id, user_id) values (v_conv, v_me), (v_conv, r) on conflict do nothing;
    end if;
    insert into public.snap_recipients (snap_id, recipient_id, conversation_id) values (p_snap, r, v_conv) on conflict do nothing;
    -- A chat entry so the snap shows up in the conversation.
    insert into public.messages (conversation_id, client_id, kind, body, media_meta)
      values (v_conv, gen_random_uuid(), 'snap', p_kind, jsonb_build_object('snap_id', p_snap));
    v_n := v_n + 1;
  end loop;
  if v_n = 0 then raise exception 'you can only send snaps to friends'; end if;
  return v_n;
end;
$$;

create or replace function public.mark_snaps_delivered()
returns void language sql security definer set search_path = '' as $$
  update public.snap_recipients set status = 'delivered', delivered_at = now()
    where recipient_id = auth.uid() and status = 'sent';
$$;

-- Returns what the viewer needs; marks the snap opened. Call AFTER creating the signed URL.
create or replace function public.open_snap(p_snap uuid)
returns table (kind text, duration_seconds int, allow_replay boolean, media_meta jsonb)
language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  select r.status into v_status from public.snap_recipients r join public.snaps s on s.id = r.snap_id
    where r.snap_id = p_snap and r.recipient_id = auth.uid() and s.expires_at > now() for update of r;
  if v_status is null then raise exception 'this snap is no longer available'; end if;
  if v_status in ('sent','delivered') then
    update public.snap_recipients set status = 'opened', opened_at = now(), delivered_at = coalesce(delivered_at, now())
      where snap_id = p_snap and recipient_id = auth.uid();
  elsif v_status <> 'opened' or (select opened_at from public.snap_recipients where snap_id = p_snap and recipient_id = auth.uid()) < now() - interval '2 minutes' then
    raise exception 'this snap has already been opened';
  end if;
  return query select s.kind, s.duration_seconds::int, s.allow_replay, s.media_meta from public.snaps s where s.id = p_snap;
end;
$$;

-- One replay, within 5 minutes of opening, if the sender allowed it.
create or replace function public.replay_snap(p_snap uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.snap_recipients r set status = 'replayed', replayed_at = now()
    from public.snaps s
    where s.id = r.snap_id and r.snap_id = p_snap and r.recipient_id = auth.uid()
      and r.status = 'opened' and s.allow_replay and r.opened_at > now() - interval '5 minutes';
  if not found then raise exception 'replay isn’t available for this snap'; end if;
end;
$$;

-- Reported by the Android app (Android 14+ screen-capture callback). Web can't detect screenshots.
create or replace function public.report_snap_screenshot(p_snap uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_conv uuid; v_name text;
begin
  update public.snap_recipients set screenshot_at = coalesce(screenshot_at, now())
    where snap_id = p_snap and recipient_id = auth.uid() and screenshot_at is null
    returning conversation_id into v_conv;
  if v_conv is not null then
    select display_name into v_name from public.profiles where id = auth.uid();
    perform public.post_system_message(v_conv, '📸 ' || v_name || ' took a screenshot of a snap');
  end if;
end;
$$;

create or replace function public.expire_snaps()
returns void language sql security definer set search_path = '' as $$
  update public.snap_recipients r set status = 'expired'
    from public.snaps s
    where s.id = r.snap_id and r.status in ('sent','delivered') and s.expires_at <= now();
$$;

-- Storage access check for the "snaps" bucket.
create or replace function public.can_read_snap_object(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_snap uuid;
begin
  begin
    v_snap := substring(storage.filename(p_name) from 1 for 36)::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1 from public.snap_recipients r join public.snaps s on s.id = r.snap_id
    where r.snap_id = v_snap and r.recipient_id = auth.uid() and s.expires_at > now()
      and (r.status in ('sent','delivered')
           or (r.status = 'opened' and r.opened_at > now() - interval '5 minutes')
           or (r.status = 'replayed' and r.replayed_at > now() - interval '2 minutes'))
  );
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('snaps', 'snaps', false, 31457280, array['image/jpeg','image/webp','image/png','video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

create policy "snap senders upload own files" on storage.objects for insert to authenticated
  with check (bucket_id = 'snaps' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "snap senders and live recipients read" on storage.objects for select to authenticated
  using (bucket_id = 'snaps' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.can_read_snap_object(name)));

revoke all on function public.expire_snaps() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['is_snap_sender(uuid)','send_snap(uuid,text,text,text,jsonb,int,boolean,uuid[])','mark_snaps_delivered()',
                           'open_snap(uuid)','replay_snap(uuid)','report_snap_screenshot(uuid)','can_read_snap_object(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

alter publication supabase_realtime add table public.snap_recipients;
