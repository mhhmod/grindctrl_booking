-- Additive; RLS, policies and grants are unchanged (widget_sites is read and written
-- only through the service-role client). Apply before deploying; the app reads the
-- column defensively, so What it knows simply shows no products line until then.
-- Records what the last catalogue refresh found: {"outcome": "ok|password_page|not_found|unreachable|rate_limited", "count": n, "at": iso}.
-- Rollback (loses only the status line): alter table public.widget_sites drop column products_sync_result;
begin;
alter table public.widget_sites add column if not exists products_sync_result jsonb;
commit;
