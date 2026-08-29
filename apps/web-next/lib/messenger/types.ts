import 'server-only';

import type { WidgetSite } from '@/lib/types';

/* GRINDCTRL Support Messenger — domain types.
   The merchant-facing configuration lives inside widget_sites.settings_json
   under the "messenger" key; everything else (visitors, conversations,
   messages, events) reuses the existing widget_* production tables. */

export type MessengerLocale = 'en' | 'ar';

export type LocalizedText = { en: string; ar: string };

export type LauncherIcon = 'chat' | 'message' | 'help';
export type LauncherPosition = 'bottom-right' | 'bottom-left';

/* Tone presets are named prompt fragments resolved server-side; merchants
   never see or write prompt text directly. */
export type AssistantTone = 'friendly' | 'professional' | 'concise' | 'warm';

export type AvailabilityMode = 'always' | 'hours';

export interface AvailabilityHours {
  day: number;
  startMinute: number;
  endMinute: number;
}

export interface MessengerAppearance {
  accentColor: string;
  launcherIcon: LauncherIcon;
  /** Absolute https URL to a merchant-uploaded icon/logo (overrides preset). */
  launcherCustomIconUrl: string | null;
  launcherLabel: LocalizedText;
  launcherSizePx: number;
  position: LauncherPosition;
  radiusStyle: 'soft' | 'rounded' | 'sharp';
  themeMode: 'light' | 'dark' | 'auto';
  assistantAvatarUrl: string | null;
}

export interface MessengerBehaviour {
  welcomeTitle: LocalizedText;
  welcomeSubtitle: LocalizedText;
  inputPlaceholder: LocalizedText;
  greetingEnabled: boolean;
  greetingDelaySeconds: number;
  greeting: LocalizedText | null;
  proactiveEnabled: boolean;
  proactiveDelaySeconds: number;
  /* Proactive nudge shows at most this many times per visitor, ever. */
  proactiveCapPerVisitor: number;
  targetingMode: 'everywhere' | 'custom';
  /* Substring match patterns (lowercased at save time); empty = show nowhere
     in custom mode unless an allow pattern matches. */
  excludePatterns: string[];
  availabilityMode: AvailabilityMode;
  availabilityTimezone: string;
  availabilityHours: AvailabilityHours[];
}

export interface MessengerAi {
  enabled: boolean;
  tone: AssistantTone;
  /* Free-form "anything the assistant should always know" — folded into the
     system prompt server-side behind structured guardrails. */
  instructions: string;
  /* 'auto' detects between en/ar per message; otherwise pinned. */
  languageMode: 'auto' | MessengerLocale;
  escalationEnabled: boolean;
}

export interface MessengerNotifications {
  emailOnHandoff: boolean;
  /** Overrides the workspace-member recipients when non-empty. */
  recipients: string[];
}

/** Asking a shopper for an email is only defensible at a moment where a
 *  reply is genuinely owed, so both triggers are handoff-or-offline. */
export interface MessengerContactCapture {
  enabled: boolean;
  askOutsideHours: boolean;
}

/** Off by default: uploading photos into a merchant's storage is a
 *  deliberate opt-in, not something a store inherits on upgrade. */
export interface MessengerAttachments {
  enabled: boolean;
  /** Vision triage runs per upload; disabling keeps uploads working. */
  triageEnabled: boolean;
}

/** Off by default: this one hands shopper-supplied identifiers to the
 *  merchant's real order data, so the merchant opts in explicitly. */
export interface MessengerOrderLookup {
  enabled: boolean;
}

export interface MessengerConfig {
  appearance: MessengerAppearance;
  behaviour: MessengerBehaviour;
  ai: MessengerAi;
  notifications: MessengerNotifications;
  contactCapture: MessengerContactCapture;
  attachments: MessengerAttachments;
  orderLookup: MessengerOrderLookup;
}

export type MessengerSettingsRow = {
  shop: string;
  button_label: string | null;
  button_label_ar: string | null;
  accent_bg: string | null;
  accent_fg: string | null;
  radius_px: number | null;
  widget_theme: string | null;
  icon_bg_from: string | null;
  icon_bg_to: string | null;
  loading_style: string | null;
  catalog_label: string | null;
  catalog_label_ar: string | null;
  catalog_icon_px: number | null;
  catalog_font_px: number | null;
  catalog_pad_px: number | null;
  button_icon_px: number | null;
  show_download: boolean | null;
  show_whatsapp: boolean | null;
  show_add_to_cart: boolean | null;
  show_try_again: boolean | null;
  disclaimer_text: string | null;
  disclaimer_text_ar: string | null;
  loading_steps: string[] | null;
};

export type WidgetSiteRow = Pick<
  WidgetSite,
  'id' | 'workspace_id' | 'name' | 'embed_key' | 'status' | 'settings_json'
> & {
  settings_version: number;
  settings_draft: Record<string, unknown> | null;
  domain: string | null;
};

export type ConversationStatus =
  | 'open'
  | 'closed'
  | 'handoff_requested'
  | 'handoff_active';

export interface VisitorRecord {
  id: string;
  anonymous_id: string;
  user_email: string | null;
  user_name: string | null;
}

export interface ConversationRecord {
  id: string;
  widget_site_id: string;
  visitor_id: string;
  status: ConversationStatus;
  started_at: string;
  last_message_at: string | null;
  assigned_profile_id: string | null;
  handoff_reason: string | null;
  handoff_summary: string | null;
  handoff_notified_at: string | null;
  metadata: {
    shopper_locale?: MessengerLocale;
    identity?: {
      customer_id?: string;
      email?: string;
      name?: string;
      verified: boolean;
    } | null;
    last_page_url?: string | null;
    /** Set the moment the contact block is offered, so it is offered once
     *  per conversation whether the shopper answers, skips, or ignores it. */
    contact_prompted_at?: string;
    /** Email the shopper typed into the contact block (unverified — it is a
     *  reply-to hint for staff, never an identity claim). */
    contact_email?: string;
    /** Lifetime order-lookup attempts. Counted on attempts, not successes,
     *  so guessing order numbers is what exhausts the budget. */
    order_lookup_attempts?: number;
  };
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface MessageRecord {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  content_type: 'text' | 'intent' | 'event';
  created_at: string;
  metadata: {
    /** 'ai' | 'human' — who produced an assistant-role message. */
    author?: 'ai' | 'human' | 'system';
    locale?: MessengerLocale;
    escalated?: boolean;
    feedback?: 'up' | 'down';
    /** Present on the message an image was posted with. The URL is minted
     *  per-view and never stored — see attachments.ts. */
    attachment?: { id: string; mime: string; bytes: number };
  };
}
