-- Owners can remove their own snap and Spotlight files (used by account deletion
-- and by removing a Spotlight video), so nothing public lingers after deletion.
create policy "snap senders remove own files" on storage.objects for delete to authenticated
  using (bucket_id = 'snaps' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "spotlight creators remove own files" on storage.objects for delete to authenticated
  using (bucket_id = 'spotlight' and (storage.foldername(name))[1] = (select auth.uid())::text);
