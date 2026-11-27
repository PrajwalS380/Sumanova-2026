-- Chat batch B: pinned messages, shared to-do lists (message kind 'todo'), message reminders,
-- link-preview cache (filled by the link-preview Edge Function with the service role).

-- ---------------------------------------------------------------------------
-- Pinned messages (up to 5 per chat, any member can pin / unpin)
-- ---------------------------------------------------------------------------
create table if not exists public.message_pins (
  message_id       uuid primary key references public.messages (id) on delete cascade,
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  pinned_by        uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  unpinned_at      timestamptz
);
create index if not exists message_pins_conv on public.message_pins (conversation_id, created_at desc) where unpinned_at is null;
alter table public.message_pins enable row level security;
create policy "members see pins" on public.message_pins for select to authenticated using (public.is_member(conversation_id));
alter publication supabase_realtime add table public.message_pins;

create or replace function public.toggle_pin(p_message uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_m public.messages;
begin
  select * into v_m from public.messages where id = p_message and deleted_at is null and kind <> 'system';
  if not found or not public.is_member(v_m.conversation_id) then raise exception 'message not found'; end if;
  if exists (select 1 from public.message_pins where message_id = p_message and unpinned_at is null) then
    update public.message_pins set unpinned_at = now() where message_id = p_message;
    return false;
  end if;
  if (select count(*) from public.message_pins where conversation_id = v_m.conversation_id and unpinned_at is null) >= 5 then
    raise exception 'up to 5 pinned messages — unpin one first';
  end if;
  insert into public.message_pins (message_id, conversation_id, pinned_by) values (p_message, v_m.conversation_id, auth.uid())
  on conflict (message_id) do update set unpinned_at = null, pinned_by = auth.uid(), created_at = now();
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Shared to-do lists: message kind 'todo' (body = title), items in todo_items
-- ---------------------------------------------------------------------------
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text','image','video','voice','sticker','system','snap','poll','location','hangout','game','todo'));

create table if not exists public.todo_items (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages (id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 120),
  done_by     uuid references auth.users (id) on delete set null,
  done_at     timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  removed_at  timestamptz
);
create index if not exists todo_items_msg on public.todo_items (message_id, created_at);
alter table public.todo_items enable row level security;
create policy "members see todo items" on public.todo_items for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and public.is_member(m.conversation_id)));
alter publication supabase_realtime add table public.todo_items;

create or replace function public.todo_add(p_message uuid, p_text text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_m public.messages; v_id uuid;
begin
  select * into v_m from public.messages where id = p_message and kind = 'todo' and deleted_at is null;
  if not found or not public.is_member(v_m.conversation_id) then raise exception 'list not found'; end if;
  if (select count(*) from public.todo_items where message_id = p_message and removed_at is null) >= 50 then raise exception 'a list holds up to 50 items'; end if;
  insert into public.todo_items (message_id, text, created_by) values (p_message, btrim(p_text), auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.todo_toggle(p_item uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_conv uuid; v_done boolean;
begin
  select m.conversation_id, t.done_at is not null into v_conv, v_done
  from public.todo_items t join public.messages m on m.id = t.message_id where t.id = p_item and t.removed_at is null and m.deleted_at is null;
  if v_conv is null or not public.is_member(v_conv) then raise exception 'item not found'; end if;
  update public.todo_items set done_at = case when v_done then null else now() end, done_by = case when v_done then null else auth.uid() end where id = p_item;
  return not v_done;
end;
$$;

create or replace function public.todo_remove(p_item uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_conv uuid;
begin
  select m.conversation_id into v_conv from public.todo_items t join public.messages m on m.id = t.message_id where t.id = p_item;
  if v_conv is null or not public.is_member(v_conv) then raise exception 'item not found'; end if;
  update public.todo_items set removed_at = now() where id = p_item;
end;
$$;

-- title check for to-do messages (added to the extras validator)
create or replace function public.messages_validate_todo()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind = 'todo' and char_length(coalesce(new.body, '')) not between 1 and 80 then
    raise exception 'give the list a title (up to 80 characters)';
  end if;
  return new;
end;
$$;
drop trigger if exists messages_validate_todo on public.messages;
create trigger messages_validate_todo before insert on public.messages for each row execute function public.messages_validate_todo();
revoke all on function public.messages_validate_todo() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Message reminders ("Remind me" → a notification at that time)
-- ---------------------------------------------------------------------------
create table if not exists public.message_reminders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  message_id       uuid not null references public.messages (id) on delete cascade,
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  remind_at        timestamptz not null,
  sent_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists message_reminders_due on public.message_reminders (remind_at) where sent_at is null;
create index if not exists message_reminders_user on public.message_reminders (user_id, remind_at);
alter table public.message_reminders enable row level security;
create policy "own reminders" on public.message_reminders for select to authenticated using (user_id = (select auth.uid()));
create or replace function public.cancel_reminder(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.message_reminders set sent_at = now() where id = p_id and user_id = auth.uid() and sent_at is null;
$$;

create or replace function public.remind_message(p_message uuid, p_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_m public.messages; v_id uuid;
begin
  select * into v_m from public.messages where id = p_message and deleted_at is null;
  if not found or not public.is_member(v_m.conversation_id) then raise exception 'message not found'; end if;
  if p_at < now() + interval '1 minute' or p_at > now() + interval '365 days' then raise exception 'pick a time from a minute to a year ahead'; end if;
  if (select count(*) from public.message_reminders where user_id = auth.uid() and sent_at is null) >= 100 then raise exception 'too many reminders'; end if;
  insert into public.message_reminders (user_id, message_id, conversation_id, remind_at) values (auth.uid(), p_message, v_m.conversation_id, p_at) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.send_message_reminders()
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    update public.message_reminders mr set sent_at = now()
    where mr.id in (select id from public.message_reminders where sent_at is null and remind_at <= now() order by remind_at limit 500)
    returning mr.user_id, mr.message_id, mr.conversation_id
  loop
    perform public.notify(r.user_id, 'system', 'Reminder',
      coalesce((select case when m.body like 'e2e:%' then 'A secret-chat message' when m.kind = 'text' then left(m.body, 120) else 'A message you saved' end
                from public.messages m where m.id = r.message_id and m.deleted_at is null), 'A message you saved'),
      '/chat/' || r.conversation_id, null);
  end loop;
end;
$$;
revoke all on function public.send_message_reminders() from public, anon, authenticated;
select cron.schedule('sumanova-message-reminders', '* * * * *', $$select public.send_message_reminders()$$);

-- ---------------------------------------------------------------------------
-- Link previews cache (written only by the Edge Function, readable by signed-in users)
-- ---------------------------------------------------------------------------
create table if not exists public.link_previews (
  url          text primary key check (char_length(url) <= 2048),
  title        text,
  description  text,
  image        text,
  site         text,
  ok           boolean not null default true,
  fetched_at   timestamptz not null default now()
);
alter table public.link_previews enable row level security;
create policy "signed-in read previews" on public.link_previews for select to authenticated using (true);

revoke all on function public.toggle_pin(uuid), public.todo_add(uuid, text), public.todo_toggle(uuid), public.todo_remove(uuid), public.remind_message(uuid, timestamptz), public.cancel_reminder(uuid) from public, anon;
grant execute on function public.toggle_pin(uuid), public.todo_add(uuid, text), public.todo_toggle(uuid), public.todo_remove(uuid), public.remind_message(uuid, timestamptz), public.cancel_reminder(uuid) to authenticated;
