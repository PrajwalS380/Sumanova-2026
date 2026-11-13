-- SUMANOVA Phase 2: friends, blocks, reports, conversations, messages, reactions,
-- presence and private chat media. All writes that need cross-user checks go
-- through SECURITY DEFINER RPCs that validate auth.uid(); everything else is RLS.

-- ---------------------------------------------------------------------------
-- Friendships, requests, blocks, reports
-- ---------------------------------------------------------------------------
create table public.friend_requests (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references auth.users (id) on delete cascade,
  receiver_id   uuid not null references auth.users (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  check (sender_id <> receiver_id)
);
create unique index friend_requests_one_pending on public.friend_requests (sender_id, receiver_id) where status = 'pending';
create index friend_requests_receiver on public.friend_requests (receiver_id, status);

-- One row per pair, stored with user_a < user_b.
create table public.friendships (
  user_a      uuid not null references auth.users (id) on delete cascade,
  user_b      uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_user_b on public.friendships (user_b);

create table public.blocks (
  blocker_id  uuid not null references auth.users (id) on delete cascade,
  blocked_id  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked on public.blocks (blocked_id);

create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid not null references auth.users (id) on delete cascade,
  target_user_id  uuid references auth.users (id) on delete set null,
  target_message_id uuid,
  reason          text not null check (reason in ('spam','harassment','inappropriate','impersonation','other')),
  details         text check (char_length(details) <= 1000),
  status          text not null default 'open' check (status in ('open','reviewed','actioned')),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper predicates (SECURITY DEFINER to avoid RLS recursion)
-- ---------------------------------------------------------------------------
create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships where user_a = least(a, b) and user_b = greatest(a, b));
$$;

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------
create table public.conversations (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('direct','group')),
  title            text check (char_length(btrim(title)) between 1 and 50),
  avatar_url       text check (char_length(avatar_url) <= 500),
  direct_key       text unique,                       -- "<least uuid>:<greatest uuid>" for direct chats
  created_by       uuid references auth.users (id) on delete set null,
  disappear_mode   text not null default 'never' check (disappear_mode in ('never','after_view','24h')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now(),
  check ((kind = 'direct' and direct_key is not null) or (kind = 'group' and title is not null))
);

create trigger conversations_set_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.conversation_members (
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  role             text not null default 'member' check (role in ('owner','admin','member')),
  joined_at        timestamptz not null default now(),
  last_read_at     timestamptz not null default now(),
  last_delivered_at timestamptz not null default now(),
  pinned           boolean not null default false,
  muted            boolean not null default false,
  favourite        boolean not null default false,
  theme            text not null default 'aurora' check (theme in ('aurora','sunset','ocean','forest','mono','rose')),
  cleared_at       timestamptz,
  primary key (conversation_id, user_id)
);
create index conversation_members_user on public.conversation_members (user_id);

create or replace function public.is_member(p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_members
                 where conversation_id = p_conversation and user_id = auth.uid());
$$;

create or replace function public.member_role(p_conversation uuid)
returns text language sql stable security definer set search_path = '' as $$
  select role from public.conversation_members where conversation_id = p_conversation and user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  sender_id        uuid references auth.users (id) on delete set null,
  client_id        uuid not null,                      -- idempotency key from the sender's device
  kind             text not null default 'text' check (kind in ('text','image','video','voice','sticker','system','snap')),
  body             text check (char_length(body) <= 4000),
  media_path       text check (char_length(media_path) <= 300),
  media_meta       jsonb not null default '{}'::jsonb,
  reply_to_id      uuid references public.messages (id) on delete set null,
  forwarded        boolean not null default false,
  disappear_mode   text not null default 'never' check (disappear_mode in ('never','after_view','24h')),
  expires_at       timestamptz,
  edited_at        timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  unique (sender_id, client_id),
  check (kind in ('system') or body is not null or media_path is not null or deleted_at is not null)
);
create index messages_conversation_created on public.messages (conversation_id, created_at desc);
create index messages_expires on public.messages (expires_at) where expires_at is not null;

create table public.message_reactions (
  message_id  uuid not null references public.messages (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  emoji       text not null check (char_length(emoji) between 1 and 16),
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- Server controls timestamps, sender and expiry. Clients can't backdate or spoof.
create or replace function public.messages_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_conv public.conversations;
  v_other uuid;
begin
  new.created_at := now();
  new.edited_at := null;
  new.deleted_at := null;
  if new.kind = 'system' then
    -- Only post_system_message() sets this transaction-local flag.
    if coalesce(current_setting('sumanova.system_message', true), '') <> 'on' then
      raise exception 'system messages are server-only';
    end if;
    new.sender_id := null;
    return new;
  end if;
  new.sender_id := auth.uid();
  select * into v_conv from public.conversations where id = new.conversation_id;
  if v_conv.kind = 'direct' then
    select user_id into v_other from public.conversation_members
      where conversation_id = new.conversation_id and user_id <> new.sender_id limit 1;
    if v_other is not null and public.is_blocked_between(new.sender_id, v_other) then
      raise exception 'cannot message this user';
    end if;
  end if;
  new.disappear_mode := v_conv.disappear_mode;
  new.expires_at := case when v_conv.disappear_mode = '24h' then now() + interval '24 hours' else null end;
  return new;
end;
$$;

create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at, last_delivered_at = new.created_at
    where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end;
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

-- ---------------------------------------------------------------------------
-- Presence: last seen (visible to friends only when they allow it)
-- ---------------------------------------------------------------------------
create table public.user_presence (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  last_seen_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.user_presence enable row level security;

create policy "see own requests" on public.friend_requests for select to authenticated
  using ((select auth.uid()) in (sender_id, receiver_id));

create policy "see own friendships" on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create policy "see own blocks" on public.blocks for select to authenticated
  using ((select auth.uid()) = blocker_id);

create policy "see own reports" on public.reports for select to authenticated
  using ((select auth.uid()) = reporter_id);

create policy "members see conversation" on public.conversations for select to authenticated
  using (public.is_member(id));

create policy "members see members" on public.conversation_members for select to authenticated
  using (public.is_member(conversation_id));

create policy "members update own membership prefs" on public.conversation_members for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "members read live messages" on public.messages for select to authenticated
  using (
    public.is_member(conversation_id)
    and (expires_at is null or expires_at > now())
    and created_at > coalesce((select cm.cleared_at from public.conversation_members cm
                               where cm.conversation_id = messages.conversation_id and cm.user_id = (select auth.uid())), '-infinity')
  );

create policy "members send messages" on public.messages for insert to authenticated
  with check (public.is_member(conversation_id) and sender_id = (select auth.uid()));

create policy "members see reactions" on public.message_reactions for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and public.is_member(m.conversation_id)));

create policy "members react" on public.message_reactions for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.messages m where m.id = message_id and public.is_member(m.conversation_id)));

create policy "members change own reaction" on public.message_reactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));


create policy "presence visible to self and permitted friends" on public.user_presence for select to authenticated
  using (
    user_id = (select auth.uid())
    or (public.are_friends(user_id, (select auth.uid()))
        and exists (select 1 from public.privacy_settings ps where ps.user_id = user_presence.user_id and ps.show_last_seen))
  );

-- Column-level hardening: members may only toggle their own preferences.
revoke update on public.conversation_members from authenticated;
grant update (last_delivered_at, pinned, muted, favourite, theme) on public.conversation_members to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs: friends
-- ---------------------------------------------------------------------------
create or replace function public.search_users(p_query text)
returns table (id uuid, username text, display_name text, avatar_url text, aura_color text, relation text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  q text := lower(btrim(coalesce(p_query, '')));
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if char_length(q) < 2 then return; end if;
  return query
    select p.id, p.username::text, p.display_name, p.avatar_url, p.aura_color,
      case
        when public.are_friends(v_me, p.id) then 'friend'
        when exists (select 1 from public.friend_requests r where r.status = 'pending' and r.sender_id = v_me and r.receiver_id = p.id) then 'outgoing'
        when exists (select 1 from public.friend_requests r where r.status = 'pending' and r.sender_id = p.id and r.receiver_id = v_me) then 'incoming'
        else 'none'
      end
    from public.profiles p
    left join public.privacy_settings ps on ps.user_id = p.id
    where p.id <> v_me
      and not public.is_blocked_between(v_me, p.id)
      and (p.username = q::extensions.citext
           or (coalesce(ps.show_in_discovery, true)
               and (p.username::text like q || '%' or lower(p.display_name) like '%' || q || '%')))
    order by (p.username = q::extensions.citext) desc, p.username
    limit 20;
end;
$$;

create or replace function public.send_friend_request(p_user uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_reverse uuid;
  v_recent int;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if p_user is null or p_user = v_me then raise exception 'invalid user'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'user not found'; end if;
  if public.is_blocked_between(v_me, p_user) then raise exception 'cannot add this user'; end if;
  if public.are_friends(v_me, p_user) then return 'already_friends'; end if;

  -- Abuse guard: max 50 requests per rolling hour.
  select count(*) into v_recent from public.friend_requests where sender_id = v_me and created_at > now() - interval '1 hour';
  if v_recent >= 50 then raise exception 'too many requests, slow down'; end if;

  select id into v_reverse from public.friend_requests
    where sender_id = p_user and receiver_id = v_me and status = 'pending';
  if v_reverse is not null then
    update public.friend_requests set status = 'accepted', responded_at = now() where id = v_reverse;
    insert into public.friendships (user_a, user_b) values (least(v_me, p_user), greatest(v_me, p_user))
      on conflict do nothing;
    return 'accepted';
  end if;

  insert into public.friend_requests (sender_id, receiver_id) values (v_me, p_user) on conflict do nothing;
  return 'sent';
end;
$$;

create or replace function public.respond_friend_request(p_request uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  r public.friend_requests;
begin
  select * into r from public.friend_requests where id = p_request for update;
  if r.id is null or r.receiver_id <> v_me or r.status <> 'pending' then raise exception 'request not found'; end if;
  update public.friend_requests set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
    where id = p_request;
  if p_accept then
    insert into public.friendships (user_a, user_b) values (least(r.sender_id, v_me), greatest(r.sender_id, v_me))
      on conflict do nothing;
  end if;
end;
$$;

create or replace function public.cancel_friend_request(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.friend_requests set status = 'cancelled', responded_at = now()
    where id = p_request and sender_id = auth.uid() and status = 'pending';
  if not found then raise exception 'request not found'; end if;
end;
$$;




create or replace function public.report_user(p_user uuid, p_reason text, p_details text default null, p_message uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_recent int;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  select count(*) into v_recent from public.reports where reporter_id = v_me and created_at > now() - interval '1 hour';
  if v_recent >= 20 then raise exception 'too many reports, slow down'; end if;
  insert into public.reports (reporter_id, target_user_id, target_message_id, reason, details)
    values (v_me, p_user, p_message, p_reason, left(p_details, 1000));
end;
$$;

create or replace function public.list_friends()
returns table (id uuid, username text, display_name text, avatar_url text, aura_color text, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name, p.avatar_url, p.aura_color, f.created_at
  from public.friendships f
  join public.profiles p on p.id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
  where auth.uid() in (f.user_a, f.user_b)
  order by p.display_name;
$$;

-- ---------------------------------------------------------------------------
-- RPCs: conversations
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_direct(p_user uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_key text;
  v_id uuid;
  v_allow text;
begin
  if v_me is null or p_user is null or p_user = v_me then raise exception 'invalid user'; end if;
  if public.is_blocked_between(v_me, p_user) then raise exception 'cannot message this user'; end if;
  v_key := least(v_me, p_user)::text || ':' || greatest(v_me, p_user)::text;
  select id into v_id from public.conversations where direct_key = v_key;
  if v_id is not null then return v_id; end if;

  select who_can_message into v_allow from public.privacy_settings where user_id = p_user;
  if coalesce(v_allow, 'friends') = 'friends' and not public.are_friends(v_me, p_user) then
    raise exception 'this user only accepts messages from friends';
  end if;

  insert into public.conversations (kind, direct_key, created_by) values ('direct', v_key, v_me)
    on conflict (direct_key) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.conversations where direct_key = v_key; end if;
  insert into public.conversation_members (conversation_id, user_id, role)
    values (v_id, v_me, 'member'), (v_id, p_user, 'member') on conflict do nothing;
  return v_id;
end;
$$;

create or replace function public.post_system_message(p_conversation uuid, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('sumanova.system_message', 'on', true);
  insert into public.messages (conversation_id, sender_id, client_id, kind, body)
    values (p_conversation, null, gen_random_uuid(), 'system', left(p_body, 300));
  perform set_config('sumanova.system_message', 'off', true);
end;
$$;
revoke all on function public.post_system_message(uuid, text) from public, anon, authenticated;

create or replace function public.create_group(p_title text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  m uuid;
  v_name text;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 50 then raise exception 'group name must be 1-50 characters'; end if;
  if coalesce(array_length(p_members, 1), 0) < 1 then raise exception 'add at least one friend'; end if;
  if array_length(p_members, 1) > 49 then raise exception 'groups are limited to 50 people'; end if;
  foreach m in array p_members loop
    if not public.are_friends(v_me, m) then raise exception 'you can only add friends to a group'; end if;
  end loop;
  insert into public.conversations (kind, title, created_by) values ('group', btrim(p_title), v_me) returning id into v_id;
  insert into public.conversation_members (conversation_id, user_id, role) values (v_id, v_me, 'owner');
  insert into public.conversation_members (conversation_id, user_id, role)
    select v_id, x, 'member' from unnest(p_members) x where x <> v_me on conflict do nothing;
  select display_name into v_name from public.profiles where id = v_me;
  perform public.post_system_message(v_id, v_name || ' created the group');
  return v_id;
end;
$$;

create or replace function public.update_group(p_conversation uuid, p_title text default null, p_avatar_url text default null, p_disappear_mode text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_role text := public.member_role(p_conversation); v_kind text;
begin
  select kind into v_kind from public.conversations where id = p_conversation;
  if v_role is null then raise exception 'not a member'; end if;
  if v_kind = 'group' and (p_title is not null or p_avatar_url is not null) and v_role = 'member' then
    raise exception 'only admins can edit the group';
  end if;
  update public.conversations set
    title = case when v_kind = 'group' then coalesce(nullif(btrim(p_title), ''), title) else title end,
    avatar_url = case when v_kind = 'group' and p_avatar_url is not null then nullif(p_avatar_url, '') else avatar_url end,
    disappear_mode = coalesce(p_disappear_mode, disappear_mode)
  where id = p_conversation;
end;
$$;

create or replace function public.add_group_members(p_conversation uuid, p_members uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); m uuid; v_count int;
begin
  if public.member_role(p_conversation) not in ('owner','admin') then raise exception 'only admins can add people'; end if;
  foreach m in array p_members loop
    if not public.are_friends(v_me, m) then raise exception 'you can only add your friends'; end if;
  end loop;
  insert into public.conversation_members (conversation_id, user_id, role)
    select p_conversation, x, 'member' from unnest(p_members) x on conflict do nothing;
  select count(*) into v_count from public.conversation_members where conversation_id = p_conversation;
  if v_count > 50 then raise exception 'groups are limited to 50 people'; end if;
end;
$$;


create or replace function public.set_member_role(p_conversation uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.member_role(p_conversation) <> 'owner' then raise exception 'only the owner can change roles'; end if;
  if p_role not in ('admin','member') then raise exception 'invalid role'; end if;
  update public.conversation_members set role = p_role
    where conversation_id = p_conversation and user_id = p_user and role <> 'owner';
end;
$$;



create or replace function public.clear_conversation(p_conversation uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.conversation_members set cleared_at = now()
    where conversation_id = p_conversation and user_id = auth.uid();
end;
$$;

-- Marks everything up to now as read; starts the countdown for "after view" messages.
create or replace function public.mark_read(p_conversation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid();
begin
  if not public.is_member(p_conversation) then return; end if;
  update public.conversation_members set last_read_at = now(), last_delivered_at = now()
    where conversation_id = p_conversation and user_id = v_me;
  -- "After view" messages vanish 30s after every other member has read them.
  update public.messages m set expires_at = now() + interval '30 seconds'
    where m.conversation_id = p_conversation
      and m.disappear_mode = 'after_view'
      and m.expires_at is null
      and m.sender_id <> v_me
      and not exists (select 1 from public.conversation_members cm
                      where cm.conversation_id = m.conversation_id and cm.user_id <> m.sender_id
                        and cm.last_read_at < m.created_at);
end;
$$;

create or replace function public.mark_delivered()
returns void language sql security definer set search_path = '' as $$
  update public.conversation_members set last_delivered_at = now() where user_id = auth.uid();
$$;

create or replace function public.edit_message(p_message uuid, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then raise exception 'message must be 1-4000 characters'; end if;
  update public.messages set body = p_body, edited_at = now()
    where id = p_message and sender_id = auth.uid() and kind = 'text' and deleted_at is null
      and created_at > now() - interval '24 hours';
  if not found then raise exception 'cannot edit this message'; end if;
end;
$$;


-- Inbox: one query for the chat list (no N+1).
create or replace function public.list_conversations()
returns table (
  id uuid, kind text, title text, avatar_url text, disappear_mode text, last_message_at timestamptz,
  pinned boolean, muted boolean, favourite boolean, theme text, role text,
  other_user_id uuid, other_username text, other_display_name text, other_avatar_url text, other_aura text,
  member_count int, unread_count int,
  last_body text, last_kind text, last_sender_id uuid, last_deleted boolean, last_created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select cm.* from public.conversation_members cm where cm.user_id = auth.uid()
  )
  select c.id, c.kind, c.title, c.avatar_url, c.disappear_mode, c.last_message_at,
         mine.pinned, mine.muted, mine.favourite, mine.theme, mine.role,
         o.id, o.username::text, o.display_name, o.avatar_url, o.aura_color,
         (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
         (select count(*)::int from public.messages m
            where m.conversation_id = c.id and m.created_at > mine.last_read_at
              and m.sender_id is distinct from auth.uid() and m.deleted_at is null
              and (m.expires_at is null or m.expires_at > now())),
         lm.body, lm.kind, lm.sender_id, lm.deleted_at is not null, lm.created_at
  from mine
  join public.conversations c on c.id = mine.conversation_id
  left join lateral (
    select p.* from public.conversation_members om join public.profiles p on p.id = om.user_id
    where c.kind = 'direct' and om.conversation_id = c.id and om.user_id <> auth.uid() limit 1
  ) o on true
  left join lateral (
    select m.body, m.kind, m.sender_id, m.deleted_at, m.created_at from public.messages m
    where m.conversation_id = c.id and (m.expires_at is null or m.expires_at > now())
      and m.created_at > coalesce(mine.cleared_at, '-infinity')
    order by m.created_at desc limit 1
  ) lm on true
  order by mine.pinned desc, c.last_message_at desc
  limit 200;
$$;

create or replace function public.touch_presence()
returns void language sql security definer set search_path = '' as $$
  insert into public.user_presence (user_id, last_seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set last_seen_at = now();
$$;

-- ---------------------------------------------------------------------------
-- Grants: RPCs are for signed-in users only
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'are_friends(uuid,uuid)','is_blocked_between(uuid,uuid)','is_member(uuid)','member_role(uuid)',
    'search_users(text)','send_friend_request(uuid)','respond_friend_request(uuid,boolean)','cancel_friend_request(uuid)',
    'report_user(uuid,text,text,uuid)','list_friends()',
    'get_or_create_direct(uuid)','create_group(text,uuid[])','update_group(uuid,text,text,text)',
    'add_group_members(uuid,uuid[])','set_member_role(uuid,uuid,text)',
    'clear_conversation(uuid)','mark_read(uuid)','mark_delivered()',
    'edit_message(uuid,text)','list_conversations()','touch_presence()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.message_reactions,
  public.conversation_members, public.friend_requests, public.friendships;

-- ---------------------------------------------------------------------------
-- Private chat media: chat-media/<conversation_id>/<user_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 26214400,
        array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime',
              'audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/aac'])
on conflict (id) do nothing;

create policy "chat members read media" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and public.is_member(((storage.foldername(name))[1])::uuid));

create policy "chat members upload own media" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media'
              and public.is_member(((storage.foldername(name))[1])::uuid)
              and (storage.foldername(name))[2] = (select auth.uid())::text);

