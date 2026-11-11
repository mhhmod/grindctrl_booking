-- Store-owned product metadata only, never shopper photos or generated looks.
begin;

alter table public.tryon_jobs
  add column if not exists product_title text,
  add column if not exists product_image_url text;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.tryon_jobs'::regclass and conname = 'tryon_jobs_product_title_length') then
    alter table public.tryon_jobs add constraint tryon_jobs_product_title_length
      check (char_length(product_title) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.tryon_jobs'::regclass and conname = 'tryon_jobs_product_image_url_shape') then
    alter table public.tryon_jobs add constraint tryon_jobs_product_image_url_shape
      check (char_length(product_image_url) <= 2048 and product_image_url like 'https://%');
  end if;
end $$;

comment on column public.tryon_jobs.product_title is 'Store product title from the signed storefront context.';
comment on column public.tryon_jobs.product_image_url is 'Store-owned garment image URL from the signed storefront context; never a shopper photo or result.';

commit;

-- Rollback (discards stored product metadata only):
-- begin;
-- alter table public.tryon_jobs drop column if exists product_title, drop column if exists product_image_url;
-- commit;
