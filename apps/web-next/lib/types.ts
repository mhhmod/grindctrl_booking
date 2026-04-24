export type JsonObject = Record<string, unknown>;

export type SearchParams = Record<string, string | string[] | undefined>;

export interface Workspace {
  id: string;
  name: string;
  created_at?: string;
}

export interface WidgetSite {
  id: string;
  workspace_id: string;
  name: string;
  embed_key: string;
  status: string;
  settings_json: JsonObject | null;
  settings_version?: number;
  created_at?: string;
  updated_at?: string;
}

export interface WidgetDomain {
  id: string;
  widget_site_id: string;
  domain: string;
  verification_status: string;
  created_at?: string;
}

export interface WidgetIntent {
  id: string;
  widget_site_id: string;
  label: string;
  icon?: string;
  action_type?: string;
  message_text?: string | null;
  external_url?: string | null;
  sort_order?: number;
}

export interface WidgetLead {
  id: string;
  workspace_id: string;
  widget_site_id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source_domain?: string | null;
  created_at?: string;
}

export interface WidgetInstallVerification {
  last_heartbeat_at?: string | null;
  last_seen_origin?: string | null;
  last_seen_domain?: string | null;
}

export type WidgetEventsWindow = '24h' | '7d' | '30d';

export interface WidgetEventTimeseriesPoint {
  bucket_start: string;
  heartbeat_count: number;
  widget_open_count: number;
  widget_close_count: number;
  conversation_start_count: number;
  message_sent_count: number;
  intent_click_count: number;
  lead_captured_count: number;
  lead_capture_skipped_count: number;
  escalation_trigger_count: number;
  other_count: number;
  total_count: number;
}

export interface WidgetEventBreakdownRow {
  event_name: string;
  total_count: number;
}

export interface WidgetEventFunnelSummary {
  widget_open_count: number;
  conversation_start_count: number;
  message_sent_count: number;
  lead_captured_count: number;
  escalation_trigger_count: number;
  open_to_conversation_rate: number | null;
  conversation_to_message_rate: number | null;
  message_to_lead_rate: number | null;
}

export interface WidgetEventAnalyticsBundle {
  timeseries: WidgetEventTimeseriesPoint[];
  breakdown: WidgetEventBreakdownRow[];
  funnel: WidgetEventFunnelSummary | null;
}

export type WidgetAnalyticsWindow = '24h' | '7d' | '30d';

export interface WidgetEventTimeseriesPoint {
  bucket_start: string;
  heartbeat_count: number;
  widget_open_count: number;
  widget_close_count: number;
  conversation_start_count: number;
  message_sent_count: number;
  intent_click_count: number;
  lead_captured_count: number;
  lead_capture_skipped_count: number;
  escalation_trigger_count: number;
  other_count: number;
  total_count: number;
}

export interface WidgetEventBreakdownItem {
  event_name: string;
  total_count: number;
}

export interface WidgetEventFunnelSummary {
  widget_open_count: number;
  conversation_start_count: number;
  message_sent_count: number;
  lead_captured_count: number;
  escalation_trigger_count: number;
  open_to_conversation_rate: number | null;
  conversation_to_message_rate: number | null;
  message_to_lead_rate: number | null;
}

export interface WorkspaceBundle {
  workspace: Workspace | null;
  sites: WidgetSite[];
  role: string | null;
}

export interface SettingsJson {
  branding: {
    brand_name: string;
    assistant_name: string;
    logo_url: string;
    avatar_url: string;
    launcher_label: string;
    launcher_icon: string;
    theme_mode: string;
    radius_style: string;
    attribution: {
      mode: string;
      show_powered_by: boolean;
    };
  };
  widget: {
    position: string;
    default_open: boolean;
    show_intents: boolean;
    rtl_supported: boolean;
    locale: string;
  };
  leads: {
    enabled: boolean;
    capture_timing: string;
    fields: string[];
    required_fields: string[];
    prompt_title: string;
    prompt_subtitle: string;
    skippable: boolean;
    dedupe: { mode: string };
    consent: { mode: string; text: string; privacy_url: string };
  };
  routing: {
    default_intent_behavior: string;
    handoff: { enabled: boolean; channel: string; target: string };
    availability: { enabled: boolean; timezone: string; hours: unknown[] };
  };
  security: {
    allow_localhost: boolean;
    allowed_iframe_parents: string[];
    rate_limits: { bootstrap_per_min: number; messages_per_min: number; leads_per_hour: number };
  };
}
