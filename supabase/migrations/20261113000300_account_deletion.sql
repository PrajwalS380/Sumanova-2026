-- Account deletion RPC. Kept separate from the foundation migration because
-- it deletes from auth.users and needs explicit approval to apply.
-- STATUS: not yet applied to the hosted project.

-- Deletes the auth user; every user-owned row cascades from auth.users.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  -- Storage files are removed by the client through the Storage API first
  -- (direct SQL deletes on storage.objects are not allowed).
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

