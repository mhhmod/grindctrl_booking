begin;

create or replace function public.dashboard_widget_events_timeseries(
  p_clerk_user_id text,
  p_site_id uuid,
  p_window text default '7d'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window interval;
  v_bucket interval;
  v_grain text;
  v_start timestamptz;
begin
  if p_window = '24h' then
    v_window := interval '24 hours';
    v_bucket := interval '1 hour';
    v_grain := 'hour';
  elsif p_window = '30d' then
    v_window := interval '30 days';
    v_bucket := interval '1 day';
    v_grain := 'day';
  else
    v_window := interval '7 days';
    v_bucket := interval '1 day';
    v_grain := 'day';
  end if;

  if not exists (
    select 1
    from public.widget_sites ws
    inner join public.workspace_members wm on wm.workspace_id = ws.workspace_id
    inner join public.profiles p on p.id = wm.profile_id
    where ws.id = p_site_id
      and p.clerk_user_id = p_clerk_user_id
  ) then
    return '[]'::jsonb;
  end if;

  v_start := date_trunc(v_grain, now() - v_window);

  return (
    with buckets as (
      select generate_series(
        v_start,
        date_trunc(v_grain, now()),
        v_bucket
      ) as bucket_start
    ),
    events as (
      select
        date_trunc(v_grain, we.created_at) as bucket_start,
        we.event_name
      from public.widget_events we
      where we.widget_site_id = p_site_id
        and we.created_at >= now() - v_window
    ),
    rollup as (
      select
        b.bucket_start,
        count(*) filter (where e.event_name = 'widget_heartbeat') as heartbeat_count,
        count(*) filter (where e.event_name = 'widget_open') as widget_open_count,
        count(*) filter (where e.event_name = 'widget_close') as widget_close_count,
        count(*) filter (where e.event_name = 'conversation_start') as conversation_start_count,
        count(*) filter (where e.event_name = 'message_sent') as message_sent_count,
        count(*) filter (where e.event_name = 'intent_click') as intent_click_count,
        count(*) filter (where e.event_name = 'lead_captured') as lead_captured_count,
        count(*) filter (where e.event_name = 'lead_capture_skipped') as lead_capture_skipped_count,
        count(*) filter (where e.event_name = 'escalation_trigger') as escalation_trigger_count,
        count(*) filter (
          where e.event_name not in (
            'widget_heartbeat',
            'widget_open',
            'widget_close',
            'conversation_start',
            'message_sent',
            'intent_click',
            'lead_captured',
            'lead_capture_skipped',
            'escalation_trigger'
          )
        ) as other_count
      from buckets b
      left join events e
        on e.bucket_start = b.bucket_start
      group by b.bucket_start
      order by b.bucket_start asc
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'bucket_start', r.bucket_start,
          'heartbeat_count', r.heartbeat_count,
          'widget_open_count', r.widget_open_count,
          'widget_close_count', r.widget_close_count,
          'conversation_start_count', r.conversation_start_count,
          'message_sent_count', r.message_sent_count,
          'intent_click_count', r.intent_click_count,
          'lead_captured_count', r.lead_captured_count,
          'lead_capture_skipped_count', r.lead_capture_skipped_count,
          'escalation_trigger_count', r.escalation_trigger_count,
          'other_count', r.other_count,
          'total_count', (
            r.heartbeat_count
            + r.widget_open_count
            + r.widget_close_count
            + r.conversation_start_count
            + r.message_sent_count
            + r.intent_click_count
            + r.lead_captured_count
            + r.lead_capture_skipped_count
            + r.escalation_trigger_count
            + r.other_count
          )
        )
        order by r.bucket_start asc
      ),
      '[]'::jsonb
    )
    from rollup r
  );
end;
$$;

create or replace function public.dashboard_widget_events_breakdown(
  p_clerk_user_id text,
  p_site_id uuid,
  p_window text default '7d'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window interval;
begin
  if p_window = '24h' then
    v_window := interval '24 hours';
  elsif p_window = '30d' then
    v_window := interval '30 days';
  else
    v_window := interval '7 days';
  end if;

  if not exists (
    select 1
    from public.widget_sites ws
    inner join public.workspace_members wm on wm.workspace_id = ws.workspace_id
    inner join public.profiles p on p.id = wm.profile_id
    where ws.id = p_site_id
      and p.clerk_user_id = p_clerk_user_id
  ) then
    return '[]'::jsonb;
  end if;

  return (
    with grouped as (
      select
        case
          when we.event_name in (
            'widget_heartbeat',
            'widget_open',
            'widget_close',
            'conversation_start',
            'message_sent',
            'intent_click',
            'lead_captured',
            'lead_capture_skipped',
            'escalation_trigger'
          ) then we.event_name
          else 'other'
        end as event_name,
        count(*)::bigint as total_count
      from public.widget_events we
      where we.widget_site_id = p_site_id
        and we.created_at >= now() - v_window
      group by 1
    ),
    base as (
      select *
      from (
        values
          ('widget_open'::text, 1),
          ('conversation_start'::text, 2),
          ('message_sent'::text, 3),
          ('intent_click'::text, 4),
          ('lead_captured'::text, 5),
          ('lead_capture_skipped'::text, 6),
          ('escalation_trigger'::text, 7),
          ('widget_close'::text, 8),
          ('widget_heartbeat'::text, 9),
          ('other'::text, 10)
      ) as t(event_name, sort_order)
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'event_name', b.event_name,
          'total_count', coalesce(g.total_count, 0)
        )
        order by b.sort_order asc
      ),
      '[]'::jsonb
    )
    from base b
    left join grouped g on g.event_name = b.event_name
  );
end;
$$;

create or replace function public.dashboard_widget_funnel_summary(
  p_clerk_user_id text,
  p_site_id uuid,
  p_window text default '7d'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window interval;
  v_widget_open_count bigint := 0;
  v_conversation_start_count bigint := 0;
  v_message_sent_count bigint := 0;
  v_lead_captured_count bigint := 0;
  v_escalation_trigger_count bigint := 0;
begin
  if p_window = '24h' then
    v_window := interval '24 hours';
  elsif p_window = '30d' then
    v_window := interval '30 days';
  else
    v_window := interval '7 days';
  end if;

  if not exists (
    select 1
    from public.widget_sites ws
    inner join public.workspace_members wm on wm.workspace_id = ws.workspace_id
    inner join public.profiles p on p.id = wm.profile_id
    where ws.id = p_site_id
      and p.clerk_user_id = p_clerk_user_id
  ) then
    return jsonb_build_object(
      'widget_open_count', 0,
      'conversation_start_count', 0,
      'message_sent_count', 0,
      'lead_captured_count', 0,
      'escalation_trigger_count', 0,
      'open_to_conversation_rate', null,
      'conversation_to_message_rate', null,
      'message_to_lead_rate', null
    );
  end if;

  select
    count(*) filter (where we.event_name = 'widget_open'),
    count(*) filter (where we.event_name = 'conversation_start'),
    count(*) filter (where we.event_name = 'message_sent'),
    count(*) filter (where we.event_name = 'lead_captured'),
    count(*) filter (where we.event_name = 'escalation_trigger')
  into
    v_widget_open_count,
    v_conversation_start_count,
    v_message_sent_count,
    v_lead_captured_count,
    v_escalation_trigger_count
  from public.widget_events we
  where we.widget_site_id = p_site_id
    and we.created_at >= now() - v_window;

  return jsonb_build_object(
    'widget_open_count', v_widget_open_count,
    'conversation_start_count', v_conversation_start_count,
    'message_sent_count', v_message_sent_count,
    'lead_captured_count', v_lead_captured_count,
    'escalation_trigger_count', v_escalation_trigger_count,
    'open_to_conversation_rate', case
      when v_widget_open_count > 0 then round((v_conversation_start_count::numeric / v_widget_open_count::numeric) * 100, 2)
      else null
    end,
    'conversation_to_message_rate', case
      when v_conversation_start_count > 0 then round((v_message_sent_count::numeric / v_conversation_start_count::numeric) * 100, 2)
      else null
    end,
    'message_to_lead_rate', case
      when v_message_sent_count > 0 then round((v_lead_captured_count::numeric / v_message_sent_count::numeric) * 100, 2)
      else null
    end
  );
end;
$$;

grant execute on function public.dashboard_widget_events_timeseries(text, uuid, text) to anon, authenticated;
grant execute on function public.dashboard_widget_events_breakdown(text, uuid, text) to anon, authenticated;
grant execute on function public.dashboard_widget_funnel_summary(text, uuid, text) to anon, authenticated;

commit;
