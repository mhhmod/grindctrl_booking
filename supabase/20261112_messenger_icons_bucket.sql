-- Additive: one new bucket, nothing existing is touched. Auth, RLS and the other
-- buckets (all private) are unchanged.
-- Public read is the point and applies to this bucket only: the widget draws a
-- merchant's launcher icon from a plain https URL on the merchant's storefront.
-- No storage.objects policies are created, so browsers cannot list, write or delete;
-- only the service role (the dashboard's upload action, after an owner/admin check) can.
-- Limits enforced by the bucket itself: 256 KB, png / svg / webp.
-- Apply before deploying; until then "Upload icon" answers that it could not save.
-- Rollback (only after clearing icons from published widgets; deletes the files):
--   delete from storage.objects where bucket_id = 'messenger-icons';
--   delete from storage.buckets where id = 'messenger-icons';
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('messenger-icons', 'messenger-icons', true, 262144, array['image/png', 'image/svg+xml', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
commit;
