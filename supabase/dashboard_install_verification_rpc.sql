begin;

create or replace function public.dashboard_get_install_verification(
  p_clerk_user_id text,
  p_site_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verification jsonb;
begin
  select jsonb_build_object(
    'last_heartbeat_at', we.created_at,
    'last_seen_origin', nullif(we.payload->>'origin', ''),
    'last_seen_domain', nullif(split_part(coalesce(we.payload->>'host', ''), ':', 1), '')
  )
  into v_verification
  from public.widget_events we
  where we.widget_site_id = p_site_id
    and we.event_name = 'widget_heartbeat'
  order by we.created_at desc
  limit 1;

  return v_verification;
end;
$$;

grant execute on function public.dashboard_get_install_verification(text, uuid) to anon, authenticated;

commit;
