import 'server-only';

import type {
  LauncherIcon,
  LocalizedText,
  MessengerAi,
  MessengerAppearance,
  MessengerBehaviour,
  MessengerConfig,
  MessengerNotifications,
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
const MAX_RECIPIENTS = 5;

function resolveNotifications(raw: unknown): MessengerNotifications {
  const source = (raw ?? {}) as Record<string, unknown>;
  const recipients = Array.isArray(source.recipients) ? source.recipients : [];
  return {
    emailOnHandoff: source.emailOnHandoff !== false,
    recipients: recipients
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length <= 200 && RECIPIENT_RE.test(entry))
      .slice(0, MAX_RECIPIENTS),
  };
}

/** Published config resolver — total function, never throws, never returns
 *  partial objects to the storefront. */
export function resolveMessengerConfig(settingsJson: unknown): MessengerConfig {
  const root = asRecord(settingsJson);
  return {
    appearance: normalizeAppearance(root.messenger_appearance),
    behaviour: normalizeBehaviour(root.messenger_behaviour),
    ai: normalizeAi(root.messenger_ai),
    notifications: resolveNotifications(root.messenger_notifications),
  };
}

/** Draft shape uses the same three sections; unresolved values fall through
 *  to defaults identically, so preview and publish cannot diverge. */
export function mergeDraftOverPublished(
  published: unknown,
  draft: unknown,
): { config: MessengerConfig; hasDraft: boolean } {
  const draftRoot = asRecord(draft);
  const hasDraft = Object.keys(draftRoot).length > 0;
  if (!hasDraft) return { config: resolveMessengerConfig(published), hasDraft };

  const publishedRoot = asRecord(published);
  const merged = {
    messenger_appearance: asRecord(draftRoot.messenger_appearance),
    messenger_behaviour: {
      ...asRecord(publishedRoot.messenger_behaviour),
      ...asRecord(draftRoot.messenger_behaviour),
    },
    messenger_ai: { ...asRecord(publishedRoot.messenger_ai), ...asRecord(draftRoot.messenger_ai) },
    messenger_notifications: {
      ...asRecord(publishedRoot.messenger_notifications),
      ...asRecord(draftRoot.messenger_notifications),
    },
  };
  // Appearance merges section-wise too (partial color edits shouldn't wipe icons).
  merged.messenger_appearance = {
    ...asRecord(publishedRoot.messenger_appearance),
    ...asRecord(draftRoot.messenger_appearance),
  };
  return { config: resolveMessengerConfig(merged), hasDraft };
}
