'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PreviewFrame } from './preview-frame';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import { saveDraftSection } from '@/app/dashboard/messenger/actions';
import type {
  LauncherIcon,
  MessengerAppearance,
  MessengerLocale,
} from '@/lib/messenger/types';

/* Appearance editor: brand color, launcher, shape, theme. Every change is
   reflected instantly in the live preview (the real widget component);
   "Save" stores a draft; publishing goes live from the header bar. */

const COPY = {
  en: {
    title: 'Appearance',
    subtitle: 'Make the messenger feel at home in your store.',
    accent: 'Brand color',
    accentHelp: 'Used for the launcher and your replies.',
    icon: 'Launcher icon',
    icons: { chat: 'Chat', message: 'Message', help: 'Help' },
    customIcon: 'Custom icon URL (optional)',
    customIconPh: 'https://cdn.yourstore.com/icon.png',
    label: 'Launcher label',
    labelEn: 'English',
    labelAr: 'Arabic',
    labelHelp: 'Leave empty for an icon-only button.',
    position: 'Position',
    posBr: 'Bottom right',
    posBl: 'Bottom left',
    size: 'Launcher size',
    radius: 'Corners',
    radii: { soft: 'Soft', rounded: 'Round', sharp: 'Sharp' },
    theme: 'Theme',
    themes: { auto: 'Automatic', light: 'Light', dark: 'Dark' },
    avatar: 'Assistant avatar URL (optional)',
    save: 'Save draft',
    saving: 'Saving…',
    saved: 'Draft saved',
  },
  ar: {
    title: 'المظهر',
    subtitle: 'اجعل الماسنجر جزءاً طبيعياً من متجرك.',
    accent: 'لون العلامة',
    accentHelp: 'يُستخدم لزر الماسنجر وردودك.',
    icon: 'أيقونة الزر',
    icons: { chat: 'دردشة', message: 'رسالة', help: 'مساعدة' },
    customIcon: 'رابط أيقونة مخصصة (اختياري)',
    customIconPh: 'https://cdn.yourstore.com/icon.png',
    label: 'نص الزر',
    labelEn: 'الإنجليزية',
    labelAr: 'العربية',
    labelHelp: 'اتركه فارغاً لزر بأيقونة فقط.',
    position: 'الموضع',
    posBr: 'أسفل اليمين',
    posBl: 'أسفل اليسار',
    size: 'حجم الزر',
    radius: 'الزوايا',
    radii: { soft: 'ناعمة', rounded: 'دائرية', sharp: 'حادة' },
    theme: 'الثيم',
    themes: { auto: 'تلقائي', light: 'فاتح', dark: 'داكن' },
    avatar: 'رابط صورة المساعد (اختياري)',
    save: 'حفظ المسودة',
    saving: 'جارٍ الحفظ…',
    saved: 'تم حفظ المسودة',
  },
};

export function AppearanceEditor({
  locale,
  siteId,
  initial,
  publishedPayload,
}: {
  locale: MessengerLocale;
  siteId: string;
  initial: MessengerAppearance;
  publishedPayload: PublicMessengerPayload;
}) {
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
  const [value, setValue] = useState<MessengerAppearance>(initial);
  const [pending, startTransition] = useTransition();
  /* Outcome, not just text: an error rendered in success green reads as a
     save that worked. */
  const [savedNote, setSavedNote] = useState<{ ok: boolean; text: string } | null>(null);

  const patch = (partial: Partial<MessengerAppearance>) => {
    setValue((prev) => ({ ...prev, ...partial }));
    setSavedNote(null);
  };

  const previewPayload = useMemo<PublicMessengerPayload>(
    () => ({ ...publishedPayload, appearance: value }),
    [publishedPayload, value],
  );

  function save() {
    startTransition(async () => {
      const result = await saveDraftSection(siteId, 'appearance', value);
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

        <div className="grid gap-2">
          <Label htmlFor="accent">{t.accent}</Label>
          <div className="flex items-center gap-3">
            <input
              id="accent"
              type="color"
              value={value.accentColor}
              onChange={(e) => patch({ accentColor: e.target.value })}
              className="size-10 cursor-pointer rounded-lg border border-border bg-transparent p-1"
            />
            <Input
              aria-label={t.accent}
              value={value.accentColor}
              onChange={(e) => patch({ accentColor: e.target.value })}
              className="w-28 font-mono text-xs"
              maxLength={7}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t.accentHelp}</p>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{t.icon}</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(t.icons) as LauncherIcon[]).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={value.launcherIcon === kind && !value.launcherCustomIconUrl}
                onClick={() => patch({ launcherIcon: kind, launcherCustomIconUrl: null })}
                className={`rounded-xl border px-4 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                  value.launcherIcon === kind && !value.launcherCustomIconUrl
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-accent'
                }`}
              >
                {t.icons[kind]}
              </button>
            ))}
          </div>
          <Label htmlFor="custom-icon" className="pt-1 text-xs text-muted-foreground">
            {t.customIcon}
          </Label>
          <Input
            id="custom-icon"
            placeholder={t.customIconPh}
            value={value.launcherCustomIconUrl ?? ''}
            onChange={(e) => patch({ launcherCustomIconUrl: e.target.value || null })}
          />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="label-en">{`${t.label} · ${t.labelEn}`}</Label>
            <Input
              id="label-en"
              value={value.launcherLabel.en}
              placeholder=""
              onChange={(e) => patch({ launcherLabel: { ...value.launcherLabel, en: e.target.value } })}
            />
            <Label htmlFor="label-ar" className="pt-1">
              {`${t.label} · ${t.labelAr}`}
            </Label>
            <Input
              id="label-ar"
              dir="rtl"
              value={value.launcherLabel.ar}
              onChange={(e) => patch({ launcherLabel: { ...value.launcherLabel, ar: e.target.value } })}
            />
            <p className="text-xs text-muted-foreground">{t.labelHelp}</p>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>{t.position}</Label>
              <div className="flex gap-2">
                <PillToggle active={value.position === 'bottom-right'} onClick={() => patch({ position: 'bottom-right' })}>
                  {t.posBr}
                </PillToggle>
                <PillToggle active={value.position === 'bottom-left'} onClick={() => patch({ position: 'bottom-left' })}>
                  {t.posBl}
                </PillToggle>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="size">{`${t.size} · ${value.launcherSizePx}px`}</Label>
              <input
                id="size"
                type="range"
                min={44}
                max={72}
                step={2}
                value={value.launcherSizePx}
                onChange={(e) => patch({ launcherSizePx: Number(e.target.value) })}
                className="accent-primary"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>{t.radius}</Label>
            <div className="flex flex-wrap gap-1.5">
              {(['soft', 'rounded', 'sharp'] as const).map((r) => (
                <PillToggle key={r} active={value.radiusStyle === r} onClick={() => patch({ radiusStyle: r })}>
                  {t.radii[r]}
                </PillToggle>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t.theme}</Label>
            <div className="flex flex-wrap gap-1.5">
              {(['auto', 'light', 'dark'] as const).map((mode) => (
                <PillToggle key={mode} active={value.themeMode === mode} onClick={() => patch({ themeMode: mode })}>
                  {t.themes[mode]}
                </PillToggle>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="avatar">{t.avatar}</Label>
            <Input
              id="avatar"
              value={value.assistantAvatarUrl ?? ''}
              onChange={(e) => patch({ assistantAvatarUrl: e.target.value || null })}
            />
          </div>
        </div>

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

export function PillToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 ${
        active ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-accent'
      }`}
    >
      {children}
    </button>
  );
}
