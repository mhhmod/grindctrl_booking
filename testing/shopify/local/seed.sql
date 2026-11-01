-- Synthetic LOCAL fixtures only. Never apply to an existing hosted project.
-- The unchanged application activation RPC issues the grant and action audit.
begin;
insert into public.tryon_shops(shop_domain) values
 ('m1-local-x.myshopify.com'),('m1-local-y.myshopify.com');
-- Prevent accidental free enrollment/top-ups or paid catalog activation.
update public.tryon_plans set active=false;
update public.tryon_credit_packs set active=false;
insert into public.tryon_plans(plan_key,name,price_minor,renders_included,
 model_key,period_unit,period_count,grace_days,is_free,active)
values ('m1-local-12','Synthetic 12-credit local pilot',0,12,'lite','day',1,0,false,true);
select public.activate_tryon_plan('m1-local-x.myshopify.com','m1-local-12',
 'Synthetic local pilot, no renewal/payment','11111111-1111-4111-8111-111111111111');
select public.activate_tryon_plan('m1-local-y.myshopify.com','m1-local-12',
 'Synthetic local pilot, no renewal/payment','22222222-2222-4222-8222-222222222222');
commit;
