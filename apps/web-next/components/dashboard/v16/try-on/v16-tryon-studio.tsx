'use client';

import * as React from 'react';
import { ActionIcon, Button, ColorInput, SegmentedControl, Switch, TextInput, Textarea } from '@mantine/core';
import { GcIcon } from '@/components/icons';
import { WidgetPreview, type PreviewTab } from '@/components/try-on/widget-preview';
import type { TryOnWidgetSettings } from '@/components/try-on/settings-controls';
import { getTryOnStudioCopy, type TryOnStudioCopy } from '@/lib/dashboard/tryon-studio-copy';
import {
  ACTION_KEYS,
  LABEL_MAX,
  NOTE_MAX,
  PILL_MAX,
  changedFields,
  draftFrom,
  missingEnglish,
  nextCorner,
  settingsFromDraft,
  studioFormData,
  themeEditorUrl,
  type StudioDraft,
} from '@/lib/dashboard/tryon-studio-model';
import { getSettingsFormCopy } from '@/lib/try-on/settings-copy';
import { getSheetCopy } from '@/lib/try-on/sheet-copy';
import { actionFailureLabel, getTryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';
import type { MerchantActionFailure } from '@/lib/request-rate-limit';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import classes from './v16-tryon-studio.module.css';

/* The v16 Try-On Set up tab (04-dashboard.md, the TryOnStudio board) on
   today's settings and today's save, which is live within a minute. Each
   change shows in the preview first and counts in the bar until Save or
   Discard. The board's new parts wait for their back ends: Where it shows
   and its products (N28 to N30), the button style (N31), Match my theme
   (N27), the promise under the button (N32) and Limits (N33, N34). */

export type SaveTryOnSettings = (formData: FormData) => Promise<{ ok: true } | MerchantActionFailure>;

type Status = 'idle' | 'saving' | 'saved' | 'error';

function Counted({ label, used, max, copy }: { label: string; used: number; max: number; copy: TryOnStudioCopy }) {
  return (
    <span className={classes.fieldLabel}>
      <span>{label}</span>
      <span className={classes.count} aria-hidden="true">
        {copy.count(used, max)}
      </span>
    </span>
  );
}

function Section({ id, title, body, children }: { id: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={classes.card}>
      <div className={classes.head}>
        <h2 id={id} className={classes.h2}>
          {title}
        </h2>
        <p className={classes.muted}>{body}</p>
      </div>
      {children}
    </section>
  );
}

/** The settings could not be read, so nothing is offered to save over them. */
export function V16TryOnStudioError({ locale }: { locale: SiteLocale }) {
  return (
    <p role="status" className={`${classes.card} ${classes.muted}`}>
      {getTryOnStudioCopy(locale).couldNotLoad}
    </p>
  );
}

export function V16TryOnStudio({
  locale,
  shop,
  settings,
  saveSettings,
}: {
  locale: SiteLocale;
  shop: string;
  settings: TryOnWidgetSettings;
  saveSettings: SaveTryOnSettings;
}) {
  const copy = getTryOnStudioCopy(locale);
  const id = React.useId();
  const [saved, setSaved] = React.useState(settings);
  const savedDraft = React.useMemo(() => draftFrom(saved), [saved]);
  const [draft, setDraft] = React.useState<StudioDraft>(() => draftFrom(settings));
  const [status, setStatus] = React.useState<Status>('idle');
  const [failure, setFailure] = React.useState<string | null>(null);
  const [previewTab, setPreviewTab] = React.useState<PreviewTab>('button');
  const previewRef = React.useRef<HTMLElement>(null);
  /* Save and Discard leave with the changes; focus goes to what is left,
     not to the page's start. */
  const studioRef = React.useRef<HTMLDivElement>(null);
  const barRef = React.useRef<HTMLDivElement>(null);

  const changes = changedFields(savedDraft, draft).length;
  const missing = missingEnglish(draft);
  const dirty = changes > 0;

  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = <K extends keyof StudioDraft>(key: K, value: StudioDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setStatus((current) => (current === 'saving' ? current : 'idle'));
  };
  const setStep = (index: number, value: string) =>
    set(
      'loadingSteps',
      draft.loadingSteps.map((step, i) => (i === index ? value : step)),
    );

  const save = async () => {
    setStatus('saving');
    setFailure(null);
    try {
      const result = await saveSettings(studioFormData(shop, draft, saved));
      if (!result.ok) {
        setFailure(actionFailureLabel(getTryOnDashboardCopy(locale), result));
        setStatus('error');
        return;
      }
      const next = settingsFromDraft(draft, saved);
      setSaved(next);
      setDraft(draftFrom(next));
      setStatus('saved');
      requestAnimationFrame(() => barRef.current?.focus());
    } catch {
      setFailure(getTryOnDashboardCopy(locale).saveFailed);
      setStatus('error');
    }
  };
  const discard = () => {
    setDraft(savedDraft);
    setStatus('idle');
    setFailure(null);
    requestAnimationFrame(() => studioRef.current?.focus());
  };
  const seeWhatTheySee = () => {
    setPreviewTab('upload');
    previewRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  /* The preview draws the labels and note the page's language shows,
     falling back as the widget does. */
  const shown = settingsFromDraft(draft, saved);
  const previewSettings =
    locale === 'ar'
      ? {
          ...shown,
          buttonLabel: shown.buttonLabelAr ?? shown.buttonLabel,
          catalogLabel: shown.catalogLabelAr ?? shown.catalogLabel,
          disclaimerText: shown.disclaimerTextAr ?? shown.disclaimerText,
        }
      : shown;
  const standardSteps = getSheetCopy(locale === 'ar' ? 'ar' : 'en').makingSteps;
  const editor = themeEditorUrl(shop);
  const ltr = locale === 'ar' ? 'ltr' : undefined;
  const rtl = 'rtl';

  return (
    <div ref={studioRef} tabIndex={-1} className={classes.studio}>
      {(dirty || status !== 'idle') && (
        <div ref={barRef} tabIndex={-1} role="region" aria-label={copy.unsavedLabel} className={classes.bar} data-state={dirty ? 'dirty' : status}>
          <span className={classes.barMessage}>
            <span role="status" className={classes.barText}>
              {status === 'saving' ? copy.saving : dirty ? copy.unsaved(changes) : status === 'saved' ? copy.saved : ''}
            </span>
            {status === 'error' && failure && (
              <span role="alert" className={classes.barError}>
                <GcIcon name="alert" size={16} />
                {failure}
              </span>
            )}
          </span>
          {dirty && (
            <span className={classes.barActions}>
              <Button variant="default" radius="pill" onClick={discard} disabled={status === 'saving'}>
                {copy.discard}
              </Button>
              <Button
                radius="pill"
                className={classes.saveButton}
                onClick={() => void save()}
                loading={status === 'saving'}
                disabled={missing.buttonLabel || missing.catalogLabel}
              >
                {copy.save}
              </Button>
            </span>
          )}
        </div>
      )}

      <div className={classes.layout}>
        <div className={classes.form}>
          <Section id={`${id}-button`} title={copy.button} body={copy.buttonBody}>
            <div className={classes.block}>
              <h3 className={classes.h3}>{copy.colours}</h3>
              <p className={classes.muted}>{copy.coloursBody}</p>
              <div className={classes.pair}>
                <ColorInput label={copy.buttonColour} value={draft.accentBg} onChange={(value) => set('accentBg', value)} format="hex" withEyeDropper={false} dir={ltr} />
                <ColorInput label={copy.textColour} value={draft.accentFg} onChange={(value) => set('accentFg', value)} format="hex" withEyeDropper={false} dir={ltr} />
              </div>
            </div>

            <div className={classes.row}>
              <div className={classes.rowText}>
                <h3 id={`${id}-corners`} className={classes.h3}>
                  {copy.corners}
                </h3>
                <p className={classes.muted}>{copy.cornersBody}</p>
              </div>
              <div role="group" aria-labelledby={`${id}-corners`} className={classes.stepper}>
                <ActionIcon
                  variant="default"
                  radius="xl"
                  size={40}
                  aria-label={copy.lessRound}
                  disabled={draft.radiusPx <= 0}
                  onClick={() => set('radiusPx', nextCorner(draft.radiusPx, -1))}
                >
                  <GcIcon name="minus" size={16} />
                </ActionIcon>
                <span className={classes.stepperValue} aria-live="polite" dir="auto">
                  {copy.cornerValue(draft.radiusPx)}
                </span>
                <ActionIcon
                  variant="default"
                  radius="xl"
                  size={40}
                  aria-label={copy.moreRound}
                  disabled={draft.radiusPx >= 999}
                  onClick={() => set('radiusPx', nextCorner(draft.radiusPx, 1))}
                >
                  <GcIcon name="plus" size={16} />
                </ActionIcon>
              </div>
            </div>

            <div className={`${classes.block} ${classes.labels}`}>
              <h3 className={classes.h3}>{copy.labels}</h3>
              <fieldset className={classes.fieldset}>
                <legend className={classes.legend}>{copy.productButton}</legend>
                <div className={classes.pair}>
                  <TextInput
                    label={<Counted label={copy.english} used={draft.buttonLabel.length} max={LABEL_MAX} copy={copy} />}
                    value={draft.buttonLabel}
                    maxLength={LABEL_MAX}
                    dir="ltr"
                    error={missing.buttonLabel ? copy.englishNeeded : undefined}
                    onChange={(event) => set('buttonLabel', event.currentTarget.value)}
                  />
                  <TextInput
                    label={<Counted label={copy.arabic} used={draft.buttonLabelAr.length} max={LABEL_MAX} copy={copy} />}
                    value={draft.buttonLabelAr}
                    maxLength={LABEL_MAX}
                    dir={rtl}
                    lang="ar"
                    onChange={(event) => set('buttonLabelAr', event.currentTarget.value)}
                  />
                </div>
              </fieldset>
              <fieldset className={classes.fieldset}>
                <legend className={classes.legend}>{copy.cardPill}</legend>
                <p className={classes.muted}>{copy.cardPillBody}</p>
                <div className={classes.pair}>
                  <TextInput
                    label={<Counted label={copy.english} used={draft.catalogLabel.length} max={PILL_MAX} copy={copy} />}
                    value={draft.catalogLabel}
                    maxLength={PILL_MAX}
                    dir="ltr"
                    error={missing.catalogLabel ? copy.englishNeeded : undefined}
                    onChange={(event) => set('catalogLabel', event.currentTarget.value)}
                  />
                  <TextInput
                    label={<Counted label={copy.arabic} used={draft.catalogLabelAr.length} max={PILL_MAX} copy={copy} />}
                    value={draft.catalogLabelAr}
                    maxLength={PILL_MAX}
                    dir={rtl}
                    lang="ar"
                    onChange={(event) => set('catalogLabelAr', event.currentTarget.value)}
                  />
                </div>
              </fieldset>
              <p className={classes.muted}>{copy.reuseOther}</p>
            </div>

            <div className={classes.row}>
              <div className={classes.rowText}>
                <h3 className={classes.h3}>{copy.position}</h3>
                <p className={classes.muted}>{copy.positionBody}</p>
              </div>
              {editor && (
                <Button
                  component="a"
                  href={editor}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="default"
                  radius="pill"
                  rightSection={<GcIcon name="ext" size={14} />}
                >
                  {copy.moveInThemeEditor}
                </Button>
              )}
            </div>
          </Section>

          <Section id={`${id}-panel`} title={copy.panel} body={copy.panelBody}>
            <div className={classes.row}>
              <h3 className={classes.h3}>{copy.background}</h3>
              <SegmentedControl
                aria-label={copy.panelBackground}
                value={draft.widgetTheme}
                onChange={(value) => set('widgetTheme', value === 'dark' ? 'dark' : 'light')}
                data={[
                  { value: 'light', label: copy.light },
                  { value: 'dark', label: copy.dark },
                ]}
              />
            </div>
            <div className={classes.block}>
              <h3 id={`${id}-animation`} className={classes.h3}>
                {copy.loadingAnimation}
              </h3>
              <p className={classes.muted}>{copy.loadingAnimationBody}</p>
              <SegmentedControl
                aria-labelledby={`${id}-animation`}
                className={classes.animations}
                value={draft.loadingStyle}
                onChange={(value) => set('loadingStyle', value === 'pulse' || value === 'bar' ? value : 'steps')}
                data={(['steps', 'pulse', 'bar'] as const).map((value) => ({ value, label: copy.animations[value] }))}
              />
            </div>
            <div className={classes.block}>
              <h3 className={classes.h3}>{copy.loadingSteps}</h3>
              <p className={classes.muted}>{copy.loadingStepsBody}</p>
              <ol className={classes.steps}>
                {draft.loadingSteps.map((step, index) => (
                  <li key={index} className={classes.step}>
                    <span className={classes.stepNumber} aria-hidden="true">
                      {index + 1}
                    </span>
                    <TextInput
                      aria-label={copy.step(index + 1)}
                      className={classes.stepInput}
                      dir="auto"
                      value={step}
                      placeholder={standardSteps[index] ?? ''}
                      onChange={(event) => setStep(index, event.currentTarget.value)}
                    />
                  </li>
                ))}
              </ol>
            </div>
          </Section>

          <Section id={`${id}-look`} title={copy.onTheLook} body={copy.onTheLookBody}>
            <ul className={classes.toggles}>
              {ACTION_KEYS.map((key) => (
                <li key={key} className={classes.row}>
                  <div className={classes.rowText}>
                    <label htmlFor={`${id}-${key}`} className={classes.h3}>
                      {copy.actions[key].label}
                    </label>
                    <p id={`${id}-${key}-body`} className={classes.muted}>
                      {copy.actions[key].body}
                    </p>
                  </div>
                  <Switch
                    id={`${id}-${key}`}
                    size="md"
                    checked={draft[key]}
                    aria-describedby={`${id}-${key}-body`}
                    onChange={(event) => set(key, event.currentTarget.checked)}
                  />
                </li>
              ))}
            </ul>
            <div className={classes.block}>
              <fieldset className={classes.fieldset}>
                <legend className={classes.legend}>{copy.note}</legend>
                <p className={classes.muted}>{copy.noteBody}</p>
                <div className={classes.pair}>
                  <Textarea
                    label={<Counted label={copy.english} used={draft.disclaimerText.length} max={NOTE_MAX} copy={copy} />}
                    value={draft.disclaimerText}
                    maxLength={NOTE_MAX}
                    rows={4}
                    resize="vertical"
                    dir="ltr"
                    placeholder={getSheetCopy('en').disclaimer}
                    onChange={(event) => set('disclaimerText', event.currentTarget.value)}
                  />
                  <Textarea
                    label={<Counted label={copy.arabic} used={draft.disclaimerTextAr.length} max={NOTE_MAX} copy={copy} />}
                    value={draft.disclaimerTextAr}
                    maxLength={NOTE_MAX}
                    rows={4}
                    resize="vertical"
                    dir={rtl}
                    lang="ar"
                    placeholder={getSheetCopy('ar').disclaimer}
                    onChange={(event) => set('disclaimerTextAr', event.currentTarget.value)}
                  />
                </div>
              </fieldset>
            </div>
          </Section>

          <Section id={`${id}-privacy`} title={copy.privacy} body={copy.privacyBody}>
            <div className={classes.promise}>
              <span className={classes.promiseIcon} aria-hidden="true">
                <GcIcon name="lock" size={18} />
              </span>
              <div className={classes.rowText}>
                <h3 className={classes.h3}>{copy.promiseTitle}</h3>
                <p className={classes.muted}>{copy.promiseBody}</p>
              </div>
              <Button variant="default" radius="pill" onClick={seeWhatTheySee}>
                {copy.seeWhatTheySee}
              </Button>
            </div>
          </Section>
        </div>

        <section ref={previewRef} aria-labelledby={`${id}-preview`} className={classes.preview}>
          <h2 id={`${id}-preview`} className={classes.h2}>
            {copy.preview}
          </h2>
          <WidgetPreview s={previewSettings} copy={getSettingsFormCopy(locale)} tab={previewTab} onTabChange={setPreviewTab} />
        </section>
      </div>
    </div>
  );
}
