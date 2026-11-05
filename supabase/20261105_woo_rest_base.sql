-- WooCommerce REST base (plain permalinks).
--
-- A WordPress site without pretty permalinks serves REST at /?rest_route=/
-- instead of /wp-json/. The plugin reports rest_url() when it pairs and on
-- every heartbeat; the server stores it and uses it for server-to-plugin
-- calls (order lookup). The code that reads this column falls back to
-- /wp-json/ when the column is missing or empty, so this can be applied after
-- the deploy.
--
-- Additive and idempotent. Apply manually after review. Auth, RLS and storage
-- impact: none (one nullable column on a server-only table, no policy or
-- grant change, no bucket change). Rollback: the column can simply be left
-- unused; dropping it is optional and loses only a routing hint.

begin;

alter table public.woo_site_connections
  add column if not exists rest_base_url text;

comment on column public.woo_site_connections.rest_base_url is
  'The paired site''s REST root as reported by rest_url(): https, same origin as home_url, either a path ending in / or /?rest_route=/. Routing metadata only.';

commit;
