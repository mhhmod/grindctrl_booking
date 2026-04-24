import 'server-only';

import { callRpc } from '@/lib/adapters/rpc';
import type {
  WidgetEventAnalyticsBundle,
  WidgetEventBreakdownRow,
  WidgetEventFunnelSummary,
  WidgetEventTimeseriesPoint,
  WidgetEventsWindow,
} from '@/lib/types';

const DEFAULT_WINDOW: WidgetEventsWindow = '7d';
const ALLOWED_WINDOWS = new Set<WidgetEventsWindow>(['24h', '7d', '30d']);

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: unknown) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTimeseriesPoint(value: Partial<WidgetEventTimeseriesPoint>): WidgetEventTimeseriesPoint {
  return {
    bucket_start: value.bucket_start ? String(value.bucket_start) : '',
    heartbeat_count: toNumber(value.heartbeat_count),
    widget_open_count: toNumber(value.widget_open_count),
    widget_close_count: toNumber(value.widget_close_count),
    conversation_start_count: toNumber(value.conversation_start_count),
    message_sent_count: toNumber(value.message_sent_count),
    intent_click_count: toNumber(value.intent_click_count),
    lead_captured_count: toNumber(value.lead_captured_count),
    lead_capture_skipped_count: toNumber(value.lead_capture_skipped_count),
    escalation_trigger_count: toNumber(value.escalation_trigger_count),
    other_count: toNumber(value.other_count),
    total_count: toNumber(value.total_count),
  };
}

function normalizeBreakdownRow(value: Partial<WidgetEventBreakdownRow>): WidgetEventBreakdownRow {
  return {
    event_name: value.event_name ? String(value.event_name) : 'other',
    total_count: toNumber(value.total_count),
  };
}

function normalizeFunnel(value: Partial<WidgetEventFunnelSummary> | null | undefined): WidgetEventFunnelSummary | null {
  if (!value) return null;

  return {
    widget_open_count: toNumber(value.widget_open_count),
    conversation_start_count: toNumber(value.conversation_start_count),
    message_sent_count: toNumber(value.message_sent_count),
    lead_captured_count: toNumber(value.lead_captured_count),
    escalation_trigger_count: toNumber(value.escalation_trigger_count),
    open_to_conversation_rate: toNullableNumber(value.open_to_conversation_rate),
    conversation_to_message_rate: toNullableNumber(value.conversation_to_message_rate),
    message_to_lead_rate: toNullableNumber(value.message_to_lead_rate),
  };
}

export function normalizeWidgetEventsWindow(value: string | string[] | null | undefined): WidgetEventsWindow {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && ALLOWED_WINDOWS.has(raw as WidgetEventsWindow)) {
    return raw as WidgetEventsWindow;
  }

  return DEFAULT_WINDOW;
}

export async function listWidgetEventsTimeseries(clerkUserId: string, siteId: string, window: WidgetEventsWindow = DEFAULT_WINDOW) {
  const rows = await callRpc<WidgetEventTimeseriesPoint[]>('dashboard_widget_events_timeseries', {
    p_clerk_user_id: clerkUserId,
    p_site_id: siteId,
    p_window: window,
  });

  return Array.isArray(rows) ? rows.map((row) => normalizeTimeseriesPoint(row)) : [];
}

export async function listWidgetEventsBreakdown(clerkUserId: string, siteId: string, window: WidgetEventsWindow = DEFAULT_WINDOW) {
  const rows = await callRpc<WidgetEventBreakdownRow[]>('dashboard_widget_events_breakdown', {
    p_clerk_user_id: clerkUserId,
    p_site_id: siteId,
    p_window: window,
  });

  return Array.isArray(rows) ? rows.map((row) => normalizeBreakdownRow(row)) : [];
}

export async function getWidgetEventFunnelSummary(clerkUserId: string, siteId: string, window: WidgetEventsWindow = DEFAULT_WINDOW) {
  const row = await callRpc<WidgetEventFunnelSummary | null>('dashboard_widget_funnel_summary', {
    p_clerk_user_id: clerkUserId,
    p_site_id: siteId,
    p_window: window,
  });

  return normalizeFunnel(row);
}

export async function getWidgetEventAnalyticsBundle(clerkUserId: string, siteId: string, window: WidgetEventsWindow = DEFAULT_WINDOW): Promise<WidgetEventAnalyticsBundle> {
  const [timeseries, breakdown, funnel] = await Promise.all([
    listWidgetEventsTimeseries(clerkUserId, siteId, window),
    listWidgetEventsBreakdown(clerkUserId, siteId, window),
    getWidgetEventFunnelSummary(clerkUserId, siteId, window),
  ]);

  return {
    timeseries,
    breakdown,
    funnel,
  };
}
