import 'server-only';

import type {
  LauncherIcon,
  LocalizedText,
  MessengerAi,
  MessengerAppearance,
  MessengerAttachments,
  MessengerBehaviour,
  MessengerConfig,
  MessengerContactCapture,
  MessengerNotifications,
  MessengerOrderLookup,
} from './types';

/* Normalization + defaults for the merchant-facing messenger configuration
   stored in widget_sites.settings_json.messenger. Everything the shopper
   surface renders must come out of here fully resolved — no undefined can
   reach the widget. */

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const DEFAULT_WELCOME: Record<'en' | 'ar', LocalizedText> = {
  en: { en: 'Hi 👋 How can we help?', ar: 'مرحباً 👋 كيف نقدر نساعدك؟' },
  ar: { en: 'Ask us anything — we usually reply instantly.', ar: 'اسألنا أي شيء — نرد عادةً فوراً.' },
};

export const DEFAULT_INPUT_PLACEHOLDER: Record<'en' | 'ar', LocalizedText> = {
  en: { en: 'Ask anything…', ar: 'اكتب سؤالك…' },
  ar: { en: 'Ask anything…', ar: 'اكتب سؤالك…' },
};

export const DEFAULT_LAUNCHER_LABEL: Record<'en' | 'ar', LocalizedText> = {
  en: { en: 'Support', ar: 'الدعم' },
  ar: { en: 'Support', ar: 'الدعم' },
};

export const MESSENGER_DEFAULTS: MessengerConfig = {
  appearance: {
    accentColor: '#2a2826',
    launcherIcon: 'chat',
    launcherCustomIconUrl: null,
    launcherLabel: DEFAULT_LAUNCHER_LABEL.en,
    launcherSizePx: 56,
    languageMode: 'auto',
    position: 'bottom-right',
    radiusStyle: 'soft',
    themeMode: 'auto',
    assistantAvatarUrl: null,
  },
  behaviour: {
    welcomeTitle: DEFAULT_WELCOME.en,
    welcomeSubtitle: DEFAULT_WELCOME.ar,
    inputPlaceholder: DEFAULT_INPUT_PLACEHOLDER.en,
    greetingEnabled: true,
    greetingDelaySeconds: 6,
    greeting: null,
    proactiveEnabled: false,
    proactiveDelaySeconds: 30,
    proactiveCapPerVisitor: 1,
    targetingMode: 'everywhere',
    excludePatterns: [],
    availabilityMode: 'always',
    availabilityTimezone: 'UTC',
    availabilityHours: [],
  },
  ai: {
    enabled: false,
    tone: 'friendly',
    instructions: '',
    languageMode: 'auto',
    escalationEnabled: true,
  },
  notifications: {
    emailOnHandoff: true,
    recipients: [],
  },
  /* On by default: it only fires where a reply is already owed. */
  contactCapture: {
    enabled: true,
    askOutsideHours: true,
  },
  /* Off by default: both of these reach data or storage a merchant should
     opt into deliberately rather than inherit on upgrade. */
  attachments: {
    enabled: false,
    triageEnabled: true,
  },
  orderLookup: {
    enabled: false,
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Merchant-entered localized strings; blank side falls back to the other. */
function normalizeLocalized(value: unknown, fallback: LocalizedText): LocalizedText {
  const raw = asRecord(value);
  const en = typeof raw.en === 'string' ? raw.en.trim() : '';
  const ar = typeof raw.ar === 'string' ? raw.ar.trim() : '';
  return { en: en || fallback.en, ar: ar || fallback.ar };
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}

function normalizePatterns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim().toLowerCase().slice(0, 200);
    if (trimmed) seen.add(trimmed);
  }
  return [...seen].slice(0, 50);
}

function normalizeAppearance(raw: unknown): MessengerAppearance {
  const r = asRecord(raw);
  const icon = r.launcherIcon;
  const customUrl =
    typeof r.launcherCustomIconUrl === 'string' &&
    /^https:\/\//.test(r.launcherCustomIconUrl) &&
    r.launcherCustomIconUrl.length <= 500
      ? r.launcherCustomIconUrl
      : null;
  const avatarUrl =
    typeof r.assistantAvatarUrl === 'string' &&
    /^https:\/\//.test(r.assistantAvatarUrl) &&
    r.assistantAvatarUrl.length <= 500
      ? r.assistantAvatarUrl
      : null;
  return {
    accentColor: normalizeColor(r.accentColor, MESSENGER_DEFAULTS.appearance.accentColor),
    launcherIcon:
      icon === 'message' || icon === 'help' || icon === 'chat' ? icon : MESSENGER_DEFAULTS.appearance.launcherIcon,
    launcherCustomIconUrl: customUrl,
    launcherLabel: normalizeLocalized(r.launcherLabel, MESSENGER_DEFAULTS.appearance.launcherLabel),
    launcherSizePx: clampInt(r.launcherSizePx, 44, 72, MESSENGER_DEFAULTS.appearance.launcherSizePx),
    languageMode:
      r.languageMode === 'en' || r.languageMode === 'ar'
        ? r.languageMode
        : MESSENGER_DEFAULTS.appearance.languageMode,
    position: r.position === 'bottom-left' ? 'bottom-left' : MESSENGER_DEFAULTS.appearance.position,
    radiusStyle:
      r.radiusStyle === 'rounded' || r.radiusStyle === 'sharp'
        ? r.radiusStyle
        : MESSENGER_DEFAULTS.appearance.radiusStyle,
    themeMode:
      r.themeMode === 'light' || r.themeMode === 'dark' ? r.themeMode : MESSENGER_DEFAULTS.appearance.themeMode,
    assistantAvatarUrl: avatarUrl,
  };
}

function normalizeBehaviour(raw: unknown): MessengerBehaviour {
  const r = asRecord(raw);
  const availabilityRaw = Array.isArray(r.availabilityHours) ? r.availabilityHours : [];
  const hours = availabilityRaw
    .map((entry) => {
      const h = asRecord(entry);
      return {
        day: clampInt(h.day, 0, 6, -1),
        startMinute: clampInt(h.startMinute, 0, 1440, -1),
        endMinute: clampInt(h.endMinute, 0, 1440, -1),
      };
    })
    .filter((h) => h.day >= 0 && h.startMinute >= 0 && h.endMinute > h.startMinute)
    .slice(0, 7);
  const timezone =
    typeof r.availabilityTimezone === 'string' &&
    r.availabilityTimezone.length > 0 &&
    r.availabilityTimezone.length <= 64
      ? r.availabilityTimezone
      : MESSENGER_DEFAULTS.behaviour.availabilityTimezone;
  return {
    welcomeTitle: normalizeLocalized(r.welcomeTitle, MESSENGER_DEFAULTS.behaviour.welcomeTitle),
    welcomeSubtitle: normalizeLocalized(r.welcomeSubtitle, MESSENGER_DEFAULTS.behaviour.welcomeSubtitle),
    inputPlaceholder: normalizeLocalized(r.inputPlaceholder, MESSENGER_DEFAULTS.behaviour.inputPlaceholder),
    greetingEnabled: r.greetingEnabled !== false,
    greetingDelaySeconds: clampInt(r.greetingDelaySeconds, 0, 120, MESSENGER_DEFAULTS.behaviour.greetingDelaySeconds),
    greeting: r.greeting == null ? null : normalizeLocalized(r.greeting, DEFAULT_WELCOME.ar),
    proactiveEnabled: r.proactiveEnabled === true,
    proactiveDelaySeconds: clampInt(
      r.proactiveDelaySeconds,
      5,
      300,
      MESSENGER_DEFAULTS.behaviour.proactiveDelaySeconds,
    ),
    proactiveCapPerVisitor: clampInt(r.proactiveCapPerVisitor, 1, 3, MESSENGER_DEFAULTS.behaviour.proactiveCapPerVisitor),
    targetingMode: r.targetingMode === 'custom' ? 'custom' : MESSENGER_DEFAULTS.behaviour.targetingMode,
    excludePatterns: normalizePatterns(r.excludePatterns),
    availabilityMode: r.availabilityMode === 'hours' ? 'hours' : MESSENGER_DEFAULTS.behaviour.availabilityMode,
    availabilityTimezone: timezone,
    availabilityHours: hours,
  };
}

function normalizeAi(raw: unknown): MessengerAi {
  const r = asRecord(raw);
  const tone = r.tone;
  return {
    enabled: r.enabled === true,
    tone:
      tone === 'professional' || tone === 'concise' || tone === 'warm'
        ? tone
        : MESSENGER_DEFAULTS.ai.tone,
    instructions:
      typeof r.instructions === 'string' ? r.instructions.slice(0, 4000).trim() : MESSENGER_DEFAULTS.ai.instructions,
    languageMode: r.languageMode === 'en' || r.languageMode === 'ar' ? r.languageMode : MESSENGER_DEFAULTS.ai.languageMode,
    escalationEnabled: r.escalationEnabled !== false,
  };
}

const RECIPIENT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Shared with notify.ts's workspace-member fallback: this is an alert, not
 *  a mailing list, whichever recipient source fills the slot. */
export const MAX_RECIPIENTS = 5;

function normalizeNotifications(raw: unknown): MessengerNotifications {
  const source = asRecord(raw);
  const recipients = Array.isArray(source.recipients) ? source.recipients : [];
  const seen = new Set<string>();
  for (const entry of recipients) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim().toLowerCase();
    if (trimmed.length <= 200 && RECIPIENT_RE.test(trimmed)) seen.add(trimmed);
  }
  return {
    emailOnHandoff: source.emailOnHandoff !== false,
    recipients: [...seen].slice(0, MAX_RECIPIENTS),
  };
}

function normalizeContactCapture(raw: unknown): MessengerContactCapture {
  const r = asRecord(raw);
  return {
    enabled: r.enabled !== false,
    askOutsideHours: r.askOutsideHours !== false,
  };
}

function normalizeAttachments(raw: unknown): MessengerAttachments {
  const r = asRecord(raw);
  return {
    // Opt-in, so an absent key means off — the inverse of the `!== false`
    // reading used by the on-by-default flags above.
    enabled: r.enabled === true,
    triageEnabled: r.triageEnabled !== false,
  };
}

function normalizeOrderLookup(raw: unknown): MessengerOrderLookup {
  const r = asRecord(raw);
  return { enabled: r.enabled === true };
}

/** Published config resolver — total function, never throws, never returns
 *  partial objects to the storefront. */
export function resolveMessengerConfig(settingsJson: unknown): MessengerConfig {
  const root = asRecord(settingsJson);
  return {
    appearance: normalizeAppearance(root.messenger_appearance),
    behaviour: normalizeBehaviour(root.messenger_behaviour),
    ai: normalizeAi(root.messenger_ai),
    notifications: normalizeNotifications(root.messenger_notifications),
    contactCapture: normalizeContactCapture(root.messenger_contact_capture),
    attachments: normalizeAttachments(root.messenger_attachments),
    orderLookup: normalizeOrderLookup(root.messenger_order_lookup),
  };
}

/* One place naming the sections. Listing them by hand in three files is
   what let messenger_notifications sit unmerged on draft merge AND get
   dropped on publish: a section absent from one list looks like a setting
   that silently refuses to save. */
export const CONFIG_SECTIONS = {
  appearance: 'messenger_appearance',
  behaviour: 'messenger_behaviour',
  ai: 'messenger_ai',
  notifications: 'messenger_notifications',
  contactCapture: 'messenger_contact_capture',
  attachments: 'messenger_attachments',
  orderLookup: 'messenger_order_lookup',
} as const;

export type MessengerSection = keyof typeof CONFIG_SECTIONS;

export const MESSENGER_SECTION_NAMES = Object.keys(CONFIG_SECTIONS) as MessengerSection[];

const CONFIG_SECTION_KEYS = Object.values(CONFIG_SECTIONS);

/** The settings_json shape for a resolved config — used on publish so every
 *  section lands, including ones no editor has been built for yet. */
export function toSettingsSections(config: MessengerConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of MESSENGER_SECTION_NAMES) out[CONFIG_SECTIONS[name]] = config[name];
  return out;
}

/** Draft shape uses the same sections as published; unresolved values fall
 *  through to defaults identically, so preview and publish cannot diverge. */
export function mergeDraftOverPublished(
  published: unknown,
  draft: unknown,
): { config: MessengerConfig; hasDraft: boolean } {
  const draftRoot = asRecord(draft);
  const hasDraft = Object.keys(draftRoot).length > 0;
  if (!hasDraft) return { config: resolveMessengerConfig(published), hasDraft };

  const publishedRoot = asRecord(published);
  // Every section merges section-wise (partial edits shouldn't wipe sibling fields).
  const merged: Record<string, unknown> = {};
  for (const section of CONFIG_SECTION_KEYS) {
    merged[section] = { ...asRecord(publishedRoot[section]), ...asRecord(draftRoot[section]) };
  }
  return { config: resolveMessengerConfig(merged), hasDraft };
}
