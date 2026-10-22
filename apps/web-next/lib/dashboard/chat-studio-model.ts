/* The v16 Store Chat Set up tab (the ChatStudio board) on today's draft and
   publish: what changed against the published version, the review list,
   the page lists and alert addresses, and the opening hours in words. Every
   card maps to MessengerConfig (lib/messenger/types.ts); nothing here
   writes. */

import type { MessengerConfig } from '@/lib/messenger/types';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import type { ChatStudioCopy } from './chat-studio-copy';
import { describeHours } from './team-model';
import { getTeamCopy } from './team-copy';

export type StudioSection = keyof MessengerConfig;
export const STUDIO_SECTIONS: StudioSection[] = [
  'appearance',
  'behaviour',
  'ai',
  'notifications',
  'contactCapture',
  'attachments',
  'orderLookup',
];

/** As lib/messenger/config.ts keeps them. */
export const MAX_RECIPIENTS = 5;
export const MAX_PATTERNS = 50;
export const INSTRUCTIONS_MAX = 4000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Field = { section: StudioSection; key: string; before: unknown; after: unknown };

/** Every field that differs from the published version, compared as stored. */
export function changedFields(published: MessengerConfig, draft: MessengerConfig): Field[] {
  return STUDIO_SECTIONS.flatMap((section) => {
    const before = published[section] as unknown as Record<string, unknown>;
    const after = draft[section] as unknown as Record<string, unknown>;
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys]
      .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .map((key) => ({ section, key, before: before[key], after: after[key] }));
  });
}

export function changedSections(published: MessengerConfig, draft: MessengerConfig): StudioSection[] {
  return [...new Set(changedFields(published, draft).map((field) => field.section))];
}

/** A page address part for "Hide on some pages": lower case, as the widget compares. */
export function withPattern(patterns: string[], raw: string): string[] | null {
  const value = raw.trim().toLowerCase().slice(0, 200);
  if (!value || patterns.includes(value) || patterns.length >= MAX_PATTERNS) return null;
  return [...patterns, value];
}

/** The widget hides itself only in custom mode, so the list decides the mode. */
export function hidePatch(patterns: string[]): Pick<MessengerConfig['behaviour'], 'excludePatterns' | 'targetingMode'> {
  return { excludePatterns: patterns, targetingMode: patterns.length > 0 ? 'custom' : 'everywhere' };
}

export function withRecipient(
  recipients: string[],
  raw: string,
): { ok: true; recipients: string[] } | { ok: false; reason: 'bad' | 'full' } {
  const value = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(value)) return { ok: false, reason: 'bad' };
  if (recipients.includes(value)) return { ok: true, recipients };
  if (recipients.length >= MAX_RECIPIENTS) return { ok: false, reason: 'full' };
  return { ok: true, recipients: [...recipients, value] };
}

/** "Saturday to Thursday 10 am to 10 pm, Cairo time.", as Settings says it. */
export function hoursLine(behaviour: MessengerConfig['behaviour'], locale: SiteLocale): string {
  const team = getTeamCopy(locale);
  if (behaviour.availabilityMode === 'always') return team.hoursAlways;
  if (behaviour.availabilityHours.length === 0) return team.hoursNone;
  return describeHours(behaviour.availabilityHours, behaviour.availabilityTimezone, team, locale);
}

export function minutesSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  return Number.isFinite(at) ? Math.max(0, Math.floor((now - at) / 60_000)) : null;
}

/** The preview draws the draft as the shopper would get it. */
export function previewPayload(payload: PublicMessengerPayload, draft: MessengerConfig): PublicMessengerPayload {
  const b = draft.behaviour;
  return {
    ...payload,
    aiEnabled: payload.active && draft.ai.enabled,
    attachmentsEnabled: payload.active && draft.attachments.enabled,
    contactCapture: payload.contactCapture === undefined ? undefined : draft.contactCapture.enabled,
    appearance: draft.appearance,
    behaviour: {
      ...payload.behaviour,
      welcomeTitle: b.welcomeTitle,
      welcomeSubtitle: b.welcomeSubtitle,
      inputPlaceholder: b.inputPlaceholder,
      greetingEnabled: b.greetingEnabled,
      targetingMode: b.targetingMode,
      excludePatterns: b.excludePatterns,
    },
  };
}

export type ReviewRow = { key: string; label: string; before: string; after: string };

/** The review list: one row per change, named as the cards name it. */
export function reviewRows(
  published: MessengerConfig,
  draft: MessengerConfig,
  copy: ChatStudioCopy,
  locale: SiteLocale,
): ReviewRow[] {
  const fields = changedFields(published, draft);
  const hide = fields.some((field) => field.key === 'excludePatterns');
  const hours = new Set(['availabilityMode', 'availabilityTimezone', 'availabilityHours']);
  let hoursShown = false;
  const rows: ReviewRow[] = [];
  for (const field of fields) {
    const id = `${field.section}.${field.key}`;
    // The mode follows the page list, and the hours read as one sentence.
    if (id === 'behaviour.targetingMode' && hide) continue;
    if (field.section === 'behaviour' && hours.has(field.key)) {
      if (hoursShown) continue;
      hoursShown = true;
      rows.push({ key: 'behaviour.hours', label: copy.hours, before: hoursLine(published.behaviour, locale), after: hoursLine(draft.behaviour, locale) });
      continue;
    }
    rows.push({
      key: id,
      label: LABELS[id]?.(copy) ?? humanize(field.key),
      before: formatValue(id, field.before, copy, locale),
      after: formatValue(id, field.after, copy, locale),
    });
  }
  return rows;
}

const LABELS: Record<string, (c: ChatStudioCopy) => string> = {
  'appearance.position': (c) => c.chatBubble.label,
  'appearance.launcherIcon': (c) => c.launcherIcon,
  'appearance.accentColor': (c) => c.brandColour.label,
  'appearance.radiusStyle': (c) => c.corners,
  'appearance.themeMode': (c) => c.theme,
  'appearance.launcherLabel': (c) => c.launcherLabel.label,
  'behaviour.excludePatterns': (c) => c.hidePages.label,
  'behaviour.targetingMode': (c) => c.hidePages.label,
  'behaviour.greetingEnabled': (c) => c.firstHello,
  'behaviour.welcomeTitle': (c) => `${c.welcome.label}: ${c.welcomeTitle}`,
  'behaviour.welcomeSubtitle': (c) => `${c.welcome.label}: ${c.welcomeMessage}`,
  'behaviour.inputPlaceholder': (c) => c.inputHint.label,
  'ai.enabled': (c) => c.assistantReplies.label,
  'ai.tone': (c) => c.tone,
  'ai.languageMode': (c) => c.replyLanguage,
  'ai.arabicDialect': (c) => c.dialect,
  'ai.instructions': (c) => c.instructions.label,
  'ai.escalationEnabled': (c) => c.offerPerson.label,
  'ai.handoffRules': (c) => c.person.label,
  'notifications.emailOnHandoff': (c) => c.emailAlerts.label,
  'notifications.recipients': (c) => c.alertEmails,
  'contactCapture.enabled': (c) => c.askWhere.label,
  'contactCapture.askOutsideHours': (c) => c.askOutsideHours,
  'attachments.enabled': (c) => c.photos.label,
  'attachments.triageEnabled': (c) => c.describePhotos.label,
  'orderLookup.enabled': (c) => c.orderLookup.label,
};

const OPTIONS: Record<string, (c: ChatStudioCopy) => Record<string, string>> = {
  'appearance.position': (c) => c.sides,
  'appearance.launcherIcon': (c) => c.icons,
  'appearance.radiusStyle': (c) => c.radii,
  'appearance.themeMode': (c) => c.themes,
  'ai.tone': (c) => c.tones,
  'ai.languageMode': (c) => c.replyLanguages,
  'ai.arabicDialect': (c) => c.dialects,
};

function humanize(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
}

function formatValue(id: string, value: unknown, copy: ChatStudioCopy, locale: SiteLocale): string {
  if (value == null || value === '') return copy.empty;
  if (typeof value === 'boolean') return value ? copy.on : copy.off;
  if (typeof value === 'string' && OPTIONS[id]) return OPTIONS[id](copy)[value] ?? value;
  if (Array.isArray(value)) return value.length ? value.join(', ') : copy.empty;
  if (typeof value === 'object' && 'en' in value && 'ar' in value) {
    const text = (value as { en: string; ar: string })[locale === 'ar' ? 'ar' : 'en'] || (value as { en: string; ar: string })[locale === 'ar' ? 'en' : 'ar'];
    return text ? clip(text) : copy.empty;
  }
  if (id === 'ai.handoffRules' && typeof value === 'object') {
    const rules = value as MessengerConfig['ai']['handoffRules'];
    const on = [rules.orderChanges && copy.ruleOrderChanges.label, rules.upset && copy.ruleUpset, rules.bigOrder.enabled && copy.ruleBigOrder].filter(Boolean);
    return on.length ? on.join(', ') : copy.off;
  }
  return clip(String(value));
}

function clip(text: string): string {
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}
