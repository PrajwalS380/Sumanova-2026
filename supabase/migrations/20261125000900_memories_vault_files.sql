-- "My Eyes Only": encrypted memories are stored as opaque binary files (encrypted on the phone).
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/webp','image/png','video/mp4','video/webm','video/quicktime','application/octet-stream']
where id = 'memories';
