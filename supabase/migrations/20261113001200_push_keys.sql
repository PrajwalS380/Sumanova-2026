-- Lets the push Edge Function create its VAPID key pair once, server-side.
-- The private key is generated inside the function and stored straight into
-- Supabase Vault — it never appears in the app, the repo or any log.
create or replace function public.init_push_keys(p_public text, p_private text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from vault.secrets where name = 'vapid_private_key') then return; end if;
  perform vault.create_secret(p_public, 'vapid_public_key');
  perform vault.create_secret(p_private, 'vapid_private_key');
  if not exists (select 1 from vault.secrets where name = 'vapid_subject') then
    perform vault.create_secret('mailto:noreply@sumanova.app', 'vapid_subject');
  end if;
end;
$$;
revoke all on function public.init_push_keys(text, text) from public, anon, authenticated;
grant execute on function public.init_push_keys(text, text) to service_role;
