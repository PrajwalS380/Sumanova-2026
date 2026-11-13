-- SUMANOVA Phase 2 (part 2): functions and policies that remove rows.
-- Split out because statements containing DELETE need explicit owner approval to apply.
-- STATUS: not yet applied to the hosted project.

create or replace function public.remove_friend(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  delete from public.friendships where user_a = least(v_me, p_user) and user_b = greatest(v_me, p_user);
end;
$$;

create or replace function public.block_user(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null or p_user is null or p_user = v_me then raise exception 'invalid user'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (v_me, p_user) on conflict do nothing;
  delete from public.friendships where user_a = least(v_me, p_user) and user_b = greatest(v_me, p_user);
  update public.friend_requests set status = 'cancelled', responded_at = now()
    where status = 'pending' and ((sender_id = v_me and receiver_id = p_user) or (sender_id = p_user and receiver_id = v_me));
end;
$$;

create or replace function public.unblock_user(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_user;
end;
$$;

create or replace function public.remove_group_member(p_conversation uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_my_role text := public.member_role(p_conversation); v_their_role text;
begin
  select role into v_their_role from public.conversation_members where conversation_id = p_conversation and user_id = p_user;
  if v_my_role not in ('owner','admin') or v_their_role = 'owner' or (v_their_role = 'admin' and v_my_role <> 'owner') then
    raise exception 'not allowed';
  end if;
  delete from public.conversation_members where conversation_id = p_conversation and user_id = p_user;
end;
$$;

create or replace function public.leave_conversation(p_conversation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_role text; v_kind text; v_next uuid; v_name text;
begin
  select role into v_role from public.conversation_members where conversation_id = p_conversation and user_id = v_me;
  select kind into v_kind from public.conversations where id = p_conversation;
  if v_role is null then return; end if;
  if v_kind = 'direct' then raise exception 'direct chats can be cleared, not left'; end if;
  delete from public.conversation_members where conversation_id = p_conversation and user_id = v_me;
  if not exists (select 1 from public.conversation_members where conversation_id = p_conversation) then
    delete from public.conversations where id = p_conversation;
    return;
  end if;
  if v_role = 'owner' then
    select user_id into v_next from public.conversation_members where conversation_id = p_conversation
      order by (role = 'admin') desc, joined_at limit 1;
    update public.conversation_members set role = 'owner' where conversation_id = p_conversation and user_id = v_next;
  end if;
  select display_name into v_name from public.profiles where id = v_me;
  perform public.post_system_message(p_conversation, v_name || ' left the group');
end;
$$;

create or replace function public.delete_group(p_conversation uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.member_role(p_conversation) <> 'owner' then raise exception 'only the owner can delete the group'; end if;
  delete from public.conversations where id = p_conversation and kind = 'group';
end;
$$;

create or replace function public.delete_message(p_message uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_path text;
begin
  update public.messages set deleted_at = now(), body = null, media_meta = '{}'::jsonb
    where id = p_message and sender_id = auth.uid() and deleted_at is null
    returning media_path into v_path;
  if not found then raise exception 'cannot delete this message'; end if;
  update public.messages set media_path = null where id = p_message;
  delete from public.message_reactions where message_id = p_message;
  return v_path;   -- client removes the storage object
end;
$$;



do $$
declare f text;
begin
  foreach f in array array['remove_friend(uuid)','block_user(uuid)','unblock_user(uuid)',
    'remove_group_member(uuid,uuid)','leave_conversation(uuid)','delete_group(uuid)','delete_message(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
