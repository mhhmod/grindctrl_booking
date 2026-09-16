'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/brand-logo';
import { AmbientBackground } from '@/components/landing/ambient-background';
import { LandingLocaleToggle, useLandingLocale } from '@/components/landing/landing-locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatNumber } from '@/components/pricing/pricing-page-content';
import { trackClick } from '@/lib/analytics';
import { BOOKING_URL } from '@/lib/booking';
import { CURRENCIES, type Currency } from '@/lib/pricing/currency';
import {
  calculateRoiScenario,
  validateRoiScenario,
  type RoiScenarioField,
  type RoiScenarioInputs,
} from '@/lib/roi-calculator';
import { cn } from '@/lib/utils';
import { getRoiCopy } from './roi-copy';

/* Conservative starting point: a small store's own numbers, not a persona's.
   Every "improvement" control starts at zero so the calculator never opens
   already claiming a GrindCTRL uplift (see roi-copy.ts scenarioBody). */
const DEFAULT_INPUTS: RoiScenarioInputs = {
  monthlySessions: 5_000,
  baselineConversionRate: 1.5,
  averageOrderValue: 50,
  returnRate: 8,
  grossMarginRate: 50,
  monthlyCost: 0,
  supportVolume: 0,
  leadVolume: 0,
  conversionImprovement: 0,
  returnReduction: 0,
  supportAutomationRate: 0,
};

const OPERATING_FIELDS: readonly RoiScenarioField[] = [
  'monthlySessions',
  'baselineConversionRate',
  'averageOrderValue',
  'returnRate',
  'grossMarginRate',
  'monthlyCost',
  'supportVolume',
  'leadVolume',
];

const SCENARIO_FIELDS: readonly RoiScenarioField[] = [
  'conversionImprovement',
  'returnReduction',
  'supportAutomationRate',
];

type FieldKind = 'count' | 'currency' | 'percent' | 'points';

const FIELD_KIND: Record<RoiScenarioField, FieldKind> = {
  monthlySessions: 'count',
  baselineConversionRate: 'percent',
  averageOrderValue: 'currency',
  returnRate: 'percent',
  grossMarginRate: 'percent',
  monthlyCost: 'currency',
  supportVolume: 'count',
  leadVolume: 'count',
  conversionImprovement: 'points',
  returnReduction: 'points',
  supportAutomationRate: 'percent',
};

const FIELD_STEP: Record<FieldKind, string> = {
  count: '1',
  currency: '1',
  percent: '0.1',
  points: '0.1',
};

function unitFor(kind: FieldKind, currency: Currency, percentagePoints: string): string | null {
  switch (kind) {
    case 'currency':
      return currency;
    case 'percent':
      return '%';
    case 'points':
      return percentagePoints;
    default:
      return null;
  }
}

function ScenarioNumberField({
  field,
  value,
  unit,
  label,
  help,
  error,
  onChange,
}: {
  field: RoiScenarioField;
  value: number;
  unit: string | null;
  label: string;
  help: string;
  error?: string;
  onChange: (field: RoiScenarioField, value: number) => void;
}) {
  const id = `roi-${field}`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const kind = FIELD_KIND[field];
  const isBounded = kind === 'percent' || kind === 'points';

  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1.5">
        <Input
          id={id}
          name={field}
          type="number"
          inputMode="decimal"
          min={0}
          max={isBounded ? 100 : undefined}
          step={FIELD_STEP[kind]}
          value={Number.isFinite(value) ? value : ''}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${helpId} ${errorId}` : helpId}
          className={cn('h-11', unit ? 'pe-14' : undefined)}
          onChange={(event) => onChange(field, event.target.valueAsNumber)}
        />
        {unit ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-medium text-muted-foreground"
          >
            {unit}
          </span>
        ) : null}
      </div>
      <p id={helpId} className="mt-1.5 text-xs leading-5 text-muted-foreground">{help}</p>
      {error ? (
        <p id={errorId} className="mt-1 text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ResultRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <dt className="min-w-0 break-words text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'shrink-0 text-end text-base font-semibold tabular-nums',
          muted && 'font-normal text-muted-foreground',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function RoiPageContent({ initialCurrency }: { initialCurrency: Currency }) {
  const { locale } = useLandingLocale();
  const t = getRoiCopy(locale);

  const [inputs, setInputs] = useState<RoiScenarioInputs>(DEFAULT_INPUTS);
  const [currency, setCurrency] = useState<Currency>(initialCurrency);

  const errors = useMemo(() => validateRoiScenario(inputs), [inputs]);
  const errorMessages = useMemo(() => {
    const map = new Map<RoiScenarioField, string>();
    for (const err of errors) {
      if (!map.has(err.field)) map.set(err.field, t.errors[err.code]);
    }
    return map;
  }, [errors, t]);
  const hasErrors = errors.length > 0;

  const result = useMemo(() => calculateRoiScenario(inputs), [inputs]);
  const formatMoney = (value: number) => formatCurrency(value, currency, locale, 0);

  function updateField(field: RoiScenarioField, value: number) {
    setInputs((prev) => ({ ...prev, [field]: value }));
  }

  function resetScenario() {
    setInputs((prev) => ({
      ...prev,
      conversionImprovement: 0,
      returnReduction: 0,
      supportAutomationRate: 0,
    }));
  }

  return (
    <>
      <AmbientBackground />

      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" aria-label={t.brandHome} className="min-w-0 rounded-lg">
            <BrandLogo size="sm" textClassName="text-[11px]" />
          </Link>

          <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden rounded-full px-3 text-muted-foreground sm:inline-flex"
            >
              <Link href="/">{t.home}</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="min-h-11 rounded-full px-3 text-muted-foreground"
            >
              <Link href="/pricing">{t.pricing}</Link>
            </Button>
            <LandingLocaleToggle className="bg-background backdrop-blur-none" />
          </nav>
        </div>
      </header>

      <main aria-label={t.pageLabel}>
        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
            <div className="min-w-0 max-w-3xl">
              <Badge
                variant="secondary"
                className="gc-fade-in-up h-7 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.18em]"
              >
                {t.eyebrow}
              </Badge>
              <h1
                className="gc-fade-in-up mt-4 text-[clamp(1.75rem,5vw,3.25rem)] font-bold leading-[1.08] tracking-tight sm:mt-6"
                style={{ animationDelay: '0.05s' }}
              >
                {t.title}
              </h1>
              <p
                className="gc-fade-in-up mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg"
                style={{ animationDelay: '0.1s' }}
              >
                {t.intro}
              </p>
              <p
                className="gc-fade-in-up mt-4 text-sm font-medium text-foreground/80"
                style={{ animationDelay: '0.15s' }}
              >
                {t.thesis}
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-muted/10">
          <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-8 lg:px-8 lg:py-16">
            <Card className="gc-landing-panel min-w-0 border-border">
              <CardHeader className="gap-3">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-xl">{t.inputsTitle}</CardTitle>
                    <p className="mt-1.5 text-sm text-muted-foreground">{t.inputsBody}</p>
                  </div>
                  <div
                    role="group"
                    aria-label={t.currency}
                    className="flex shrink-0 gap-1.5 rounded-full border border-border bg-background p-1"
                  >
                    {CURRENCIES.map((code) => (
                      <button
                        key={code}
                        type="button"
                        aria-pressed={currency === code}
                        onClick={() => setCurrency(code)}
                        className={cn(
                          'min-h-11 rounded-full px-4 text-xs font-semibold transition-colors',
                          currency === code
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                {OPERATING_FIELDS.map((field) => (
                  <ScenarioNumberField
                    key={field}
                    field={field}
                    value={inputs[field]}
                    unit={unitFor(FIELD_KIND[field], currency, t.percentagePoints)}
                    label={t.fields[field].label}
                    help={t.fields[field].help}
                    error={errorMessages.get(field)}
                    onChange={updateField}
                  />
                ))}
              </CardContent>
            </Card>

            <Card className="gc-landing-panel min-w-0 border-border">
              <CardHeader className="gap-3">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-xl">{t.scenarioTitle}</CardTitle>
                    <p className="mt-1.5 text-sm text-muted-foreground">{t.scenarioBody}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetScenario}
                    className="min-h-11 shrink-0 rounded-full px-4 text-xs font-semibold text-muted-foreground"
                  >
                    {t.resetScenario}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5">
                {SCENARIO_FIELDS.map((field) => (
                  <ScenarioNumberField
                    key={field}
                    field={field}
                    value={inputs[field]}
                    unit={unitFor(FIELD_KIND[field], currency, t.percentagePoints)}
                    label={t.fields[field].label}
                    help={t.fields[field].help}
                    error={errorMessages.get(field)}
                    onChange={updateField}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
            <Card className="gc-landing-panel min-w-0 border-border">
              <CardHeader>
                <CardTitle className="text-xl">{t.resultsTitle}</CardTitle>
                <p className="mt-1.5 text-sm text-muted-foreground">{t.resultsBody}</p>
              </CardHeader>
              <CardContent>
                {hasErrors ? (
                  <p
                    role="alert"
                    className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive"
                  >
                    {t.fixInputs}
                  </p>
                ) : (
                  <>
                    <dl aria-live="polite" data-testid="roi-results">
                      <ResultRow
                        label={t.baselineOrders}
                        value={formatNumber(Math.round(result.baselineOrders), locale)}
                        muted
                      />
                      <ResultRow
                        label={t.baselineRevenue}
                        value={formatMoney(result.baselineRevenue)}
                        muted
                      />
                      <ResultRow
                        label={t.scenarioOrders}
                        value={formatNumber(Math.round(result.scenarioOrders), locale)}
                      />
                      <ResultRow
                        label={t.scenarioRevenue}
                        value={formatMoney(result.scenarioRevenue)}
                      />
                      <ResultRow
                        label={t.incrementalRevenue}
                        value={formatMoney(result.incrementalRevenue)}
                      />
                      <ResultRow
                        label={t.avoidedReturnValue}
                        value={formatMoney(result.avoidedReturnValue)}
                      />
                      <ResultRow
                        label={t.grossMarginImpact}
                        value={formatMoney(result.illustrativeGrossMarginImpact)}
                      />
                      <ResultRow
                        label={t.netImpact}
                        value={formatMoney(result.illustrativeNetImpact)}
                      />
                      <ResultRow
                        label={t.roi}
                        value={
                          result.illustrativeRoi === null
                            ? t.notAvailable
                            : `${formatNumber(Math.round(result.illustrativeRoi * 10) / 10, locale)}%`
                        }
                      />
                    </dl>
                    {result.illustrativeRoi === null ? (
                      <p className="pt-3 text-xs text-muted-foreground">{t.costNeeded}</p>
                    ) : null}

                    <div className="mt-6 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
                      <div className="min-w-0 rounded-xl border border-border bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">{t.supportScope}</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                          {formatNumber(Math.round(result.automatedSupportConversations), locale)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{t.notMonetized}</p>
                      </div>
                      <div className="min-w-0 rounded-xl border border-border bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">{t.leadContext}</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                          {formatNumber(inputs.leadVolume, locale)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{t.notMonetized}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div
              role="note"
              aria-label={t.disclaimerTitle}
              className="mt-6 min-w-0 rounded-2xl border border-border bg-muted/30 p-5 sm:p-6"
            >
              <p className="text-sm font-semibold">{t.disclaimerTitle}</p>
              <p className="mt-2 text-sm leading-6 text-foreground/90">{t.disclaimer}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{t.noCausation}</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full px-6 font-semibold">
                  <a
                    href={BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackClick('cta_clicked', { cta: 'book_call', section: 'roi_results' })}
                  >
                    {t.bookCall}
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-full border-border px-6 font-semibold"
                >
                  <Link href="/pricing">{t.viewPricing}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-muted/10">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
            <h2 className="text-xl font-bold tracking-tight">{t.formulaTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t.formulaBody}</p>
            <ol className="mt-6 min-w-0 divide-y divide-border rounded-2xl border border-border bg-background">
              {t.formulas.map((row, index) => (
                <li
                  key={row.label}
                  className="flex min-w-0 flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                >
                  <span className="flex min-w-0 items-baseline gap-2 text-sm font-semibold">
                    <span className="tabular-nums text-xs text-muted-foreground">{index + 1}.</span>
                    <span className="break-words">{row.label}</span>
                  </span>
                  <code className="min-w-0 break-words font-mono text-xs text-muted-foreground sm:text-end">
                    {row.formula}
                  </code>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="px-4 py-10 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo size="sm" textClassName="text-xs" />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <Link href="/">{t.home}</Link>
            <Link href="/pricing">{t.pricing}</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
