'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from './textarea';
import { PillToggle } from './appearance-editor';
import { PreviewFrame } from './preview-frame';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import { saveDraftSection } from '@/app/dashboard/messenger/actions';
import type { MessengerBehaviour, MessengerLocale } from '@/lib/messenger/types';

/* Behaviour: greeting, welcome copy, proactive nudge, availability,
   page targeting. Defaults are deliberately calm; proactive is OFF until a
   merchant consciously enables it. */

const COPY = {
  en: {
    title: 'Behaviour',
    subtitle: 'How the messenger greets and when it appears.',
    welcome: 'Welcome screen',
    welcomeTitle: 'Title',
    welcomeSub: 'Subtitle',
    placeholder: 'Input placeholder',
    greetingSection: 'Greeting bubble',
    greetingToggle: 'Show a small hello after a few seconds',
    greetingDelay: 'After (seconds)',
    greetingText: 'Greeting text',
    greetingPh: 'Leave empty for the default hello',
    proactiveSection: 'Proactive nudge',
    proactiveToggle: 'Open a one-time nudge after a while',
    proactiveDelay: 'After (seconds)',
    proactiveNote:
      'Shows at most once per visitor and never after they dismiss it. Off by default.',
    availability: 'Availability',
    always: 'Always available',
    hours: 'Business hours',
    timezone: 'Timezone (IANA)',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    from: 'From',
    to: 'To',
    targeting: 'Page targeting',
    everywhere: 'Show everywhere',
    custom: 'Exclude pages',
    patternsLabel: 'Hide the launcher on URLs containing (one per line)',
    save: 'Save draft',
    saving: 'Saving…',
    saved: 'Draft saved',
  },
  ar: {
    title: 'السلوك',
    subtitle: 'كيف يرحّب الماسنجر ومتى يظهر.',
    welcome: 'شاشة الترحيب',
    welcomeTitle: 'العنوان',
    welcomeSub: 'الوصف',
    placeholder: 'نص حقل الكتابة',
    greetingSection: 'فقاعة الترحيب',
    greetingToggle: 'إظهار تحية صغيرة بعد ثوانٍ',
    greetingDelay: 'بعد (ثوانٍ)',
    greetingText: 'نص الترحيب',
    greetingPh: 'اتركه فارغاً للتحية الافتراضية',
    proactiveSection: 'تنبيه استباقي',
    proactiveToggle: 'فتح تنبيه لمرة واحدة بعد فترة',
    proactiveDelay: 'بعد (ثوانٍ)',
    proactiveNote: 'يظهر مرة واحدة لكل زائر ولا يظهر بعد تجاهله. معطّل افتراضياً.',
    availability: 'أوقات العمل',
    always: 'متاح دائماً',
    hours: 'ساعات العمل',
    timezone: 'المنطقة الزمنية (IANA)',
    days: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
    from: 'من',
    to: 'إلى',
    targeting: 'استهداف الصفحات',
    everywhere: 'الظهور في كل الصفحات',
    custom: 'استثناء صفحات',
    patternsLabel: 'إخفاء الزر في الروابط التي تحتوي (سطر لكل نمط)',
    save: 'حفظ المسودة',
    saving: 'جارٍ الحفظ…',
    saved: 'تم حفظ المسودة',
  },
};

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function hhmmToMinutes(value: string, fallback: number): number {
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return fallback;
  return Math.max(0, Math.min(1440, h * 60 + m));
}

export function BehaviourEditor({
  locale,
  siteId,
  initial,
  publishedPayload,
}: {
  locale: MessengerLocale;
  siteId: string;
  initial: MessengerBehaviour;
  publishedPayload: PublicMessengerPayload;
}) {
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
  const [value, setValue] = useState<MessengerBehaviour>(initial);
  const [pending, startTransition] = useTransition();
  /* Outcome, not just text: an error rendered in success green reads as a
     save that worked. */
  const [savedNote, setSavedNote] = useState<{ ok: boolean; text: string } | null>(null);

  const patch = (partial: Partial<MessengerBehaviour>) => {
    setValue((prev) => ({ ...prev, ...partial }));
    setSavedNote(null);
  };

  const previewPayload = useMemo<PublicMessengerPayload>(
    () => ({ ...publishedPayload, behaviour: { ...publishedPayload.behaviour, ...value } }),
    [publishedPayload, value],
  );

  // Single daily window model for the UI (stored per-day server-side).
  const firstWindow = value.availabilityHours[0];
  const activeDays = new Set(value.availabilityHours.map((h) => h.day));

  function setHours(day: number, enabled: boolean) {
    const rest = value.availabilityHours.filter((h) => h.day !== day);
    patch({
      availabilityHours: enabled
        ? [...rest, { day, startMinute: 9 * 60, endMinute: 17 * 60 }].sort((a, b) => a.day - b.day)
        : rest,
    });
  }
  function setWindowBounds(startMinute: number, endMinute: number) {
    patch({
      availabilityHours: value.availabilityHours.map((h) => ({ ...h, startMinute, endMinute })),
    });
  }

  function save() {
    startTransition(async () => {
      const result = await saveDraftSection(siteId, 'behaviour', value);
      setSavedNote(result.ok ? { ok: true, text: t.saved } : { ok: false, text: result.error });
    });
  }

  return (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <form
        className="grid min-w-0 gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <header>
          <h2 className="text-lg font-semibold tracking-tight">{t.title}</h2>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </header>

        <section className="grid gap-3 rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold">{t.welcome}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="wt-en">{`${t.welcomeTitle} · EN`}</Label>
              <Textarea
                id="wt-en"
                rows={2}
                value={value.welcomeTitle.en}
                onChange={(e) => patch({ welcomeTitle: { ...value.welcomeTitle, en: e.target.value } })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="wt-ar">{`${t.welcomeTitle} · AR`}</Label>
              <Textarea
                id="wt-ar"
                dir="rtl"
                rows={2}
                value={value.welcomeTitle.ar}
                onChange={(e) => patch({ welcomeTitle: { ...value.welcomeTitle, ar: e.target.value } })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="ws-en">{`${t.welcomeSub} · EN`}</Label>
              <Textarea
                id="ws-en"
                rows={2}
                value={value.welcomeSubtitle.en}
                onChange={(e) => patch({ welcomeSubtitle: { ...value.welcomeSubtitle, en: e.target.value } })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="ws-ar">{`${t.welcomeSub} · AR`}</Label>
              <Textarea
                id="ws-ar"
                dir="rtl"
                rows={2}
                value={value.welcomeSubtitle.ar}
                onChange={(e) => patch({ welcomeSubtitle: { ...value.welcomeSubtitle, ar: e.target.value } })}
              />
            </div>
            <div className="grid gap-1 sm:col-span-2">
              <Label htmlFor="ph">{t.placeholder}</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  aria-label={`${t.placeholder} EN`}
                  value={value.inputPlaceholder.en}
                  onChange={(e) =>
                    patch({ inputPlaceholder: { ...value.inputPlaceholder, en: e.target.value } })
                  }
                />
                <Input
                  aria-label={`${t.placeholder} AR`}
                  dir="rtl"
                  value={value.inputPlaceholder.ar}
                  onChange={(e) =>
                    patch({ inputPlaceholder: { ...value.inputPlaceholder, ar: e.target.value } })
                  }
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold">{t.greetingSection}</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.greetingEnabled}
              onChange={(e) => patch({ greetingEnabled: e.target.checked })}
              className="size-4 accent-primary"
            />
            {t.greetingToggle}
          </label>
          {value.greetingEnabled && (
            <>
              <div className="max-w-[200px]">
                <Label htmlFor="gdelay">{t.greetingDelay}</Label>
                <Input
                  id="gdelay"
                  type="number"
                  min={0}
                  max={120}
                  value={value.greetingDelaySeconds}
                  onChange={(e) => patch({ greetingDelaySeconds: Number(e.target.value) })}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  aria-label={`${t.greetingText} EN`}
                  placeholder={t.greetingPh}
                  value={value.greeting?.en ?? ''}
                  onChange={(e) =>
                    patch({
                      greeting: { en: e.target.value, ar: value.greeting?.ar ?? '' },
                    })
                  }
                />
                <Input
                  aria-label={`${t.greetingText} AR`}
                  dir="rtl"
                  placeholder={t.greetingPh}
                  value={value.greeting?.ar ?? ''}
                  onChange={(e) =>
                    patch({
                      greeting: { en: value.greeting?.en ?? '', ar: e.target.value },
                    })
                  }
                />
              </div>
            </>
          )}
        </section>

        <section className="grid gap-3 rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold">{t.proactiveSection}</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.proactiveEnabled}
              onChange={(e) => patch({ proactiveEnabled: e.target.checked })}
              className="size-4 accent-primary"
            />
            {t.proactiveToggle}
          </label>
          {value.proactiveEnabled && (
            <div className="max-w-[200px]">
              <Label htmlFor="pdelay">{t.proactiveDelay}</Label>
              <Input
                id="pdelay"
                type="number"
                min={5}
                max={300}
                value={value.proactiveDelaySeconds}
                onChange={(e) => patch({ proactiveDelaySeconds: Number(e.target.value) })}
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t.proactiveNote}</p>
        </section>

        <section className="grid gap-3 rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold">{t.availability}</h3>
          <div className="flex flex-wrap gap-2">
            <PillToggle
              active={value.availabilityMode === 'always'}
              onClick={() => patch({ availabilityMode: 'always' })}
            >
              {t.always}
            </PillToggle>
            <PillToggle
              active={value.availabilityMode === 'hours'}
              onClick={() => patch({ availabilityMode: 'hours' })}
            >
              {t.hours}
            </PillToggle>
          </div>
          {value.availabilityMode === 'hours' && (
            <div className="grid gap-3">
              <div className="max-w-[280px]">
                <Label htmlFor="tz">{t.timezone}</Label>
                <Input
                  id="tz"
                  value={value.availabilityTimezone}
                  onChange={(e) => patch({ availabilityTimezone: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {t.days.map((dayName, dayIndex) => (
                  <button
                    key={dayName}
                    type="button"
                    aria-pressed={activeDays.has(dayIndex)}
                    onClick={() => setHours(dayIndex, !activeDays.has(dayIndex))}
                    className={`rounded-full px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                      activeDays.has(dayIndex)
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border hover:bg-accent'
                    }`}
                  >
                    {dayName}
                  </button>
                ))}
              </div>
              {value.availabilityHours.length > 0 && (
                <div className="flex max-w-[320px] items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t.from}</span>
                  <Input
                    type="time"
                    aria-label={t.from}
                    value={minutesToHHMM(firstWindow?.startMinute ?? 540)}
                    onChange={(e) => setWindowBounds(hhmmToMinutes(e.target.value, 540), firstWindow?.endMinute ?? 1020)}
                  />
                  <span className="text-xs text-muted-foreground">{t.to}</span>
                  <Input
                    type="time"
                    aria-label={t.to}
                    value={minutesToHHMM(firstWindow?.endMinute ?? 1020)}
                    onChange={(e) => setWindowBounds(firstWindow?.startMinute ?? 540, hhmmToMinutes(e.target.value, 1020))}
                  />
                </div>
              )}
            </div>
          )}
        </section>

        <section className="grid gap-3 rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold">{t.targeting}</h3>
          <div className="flex flex-wrap gap-2">
            <PillToggle
              active={value.targetingMode === 'everywhere'}
              onClick={() => patch({ targetingMode: 'everywhere' })}
            >
              {t.everywhere}
            </PillToggle>
            <PillToggle
              active={value.targetingMode === 'custom'}
              onClick={() => patch({ targetingMode: 'custom', excludePatterns: value.excludePatterns.length ? value.excludePatterns : ['/checkout'] })}
            >
              {t.custom}
            </PillToggle>
          </div>
          {value.targetingMode === 'custom' && (
            <div className="grid gap-1">
              <Label htmlFor="patterns">{t.patternsLabel}</Label>
              <Textarea
                id="patterns"
                rows={4}
                value={value.excludePatterns.join('\n')}
                onChange={(e) =>
                  patch({ excludePatterns: e.target.value.split('\n').map((line) => line.trim()) })
                }
              />
            </div>
          )}
        </section>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? t.saving : t.save}
          </Button>
          {savedNote && (
            <span
              role={savedNote.ok ? 'status' : 'alert'}
              className={`text-sm ${savedNote.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
            >
              {savedNote.text}
            </span>
          )}
        </div>
      </form>

      <aside className="xl:sticky xl:top-6">
        <PreviewFrame payload={previewPayload} initialLocale={locale} />
      </aside>
    </div>
  );
}
