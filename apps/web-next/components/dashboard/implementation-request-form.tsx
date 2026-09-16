'use client';

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BOOKING_URL } from '@/lib/booking';
import {
  IMPLEMENTATION_CHANNELS,
  IMPLEMENTATION_PRIMARY_USE_CASES,
  IMPLEMENTATION_TOOLS,
  IMPLEMENTATION_URGENCY_OPTIONS,
} from '@/lib/dashboard/implementation-options';
import {
  LANDING_PREVIEW_STORAGE_KEY,
  readLandingPreviewHandoff,
} from '@/lib/trial/landing-preview-handoff';
import { getImplementationCopy } from '@/lib/dashboard/dashboard-content-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

const selectClassName =
  'h-10 w-full rounded-xl border border-input bg-input/20 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30';
const textAreaClassName =
  'min-h-24 w-full rounded-xl border border-input bg-input/20 px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30';

function readPreviewSnapshot() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LANDING_PREVIEW_STORAGE_KEY);
  } catch {
    return null;
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type ValidationField =
  | 'companyName'
  | 'workEmail'
  | 'businessType'
  | 'primaryUseCase'
  | 'channels'
  | 'tools'
  | 'pain'
  | 'urgency';

type PreparedRequest = {
  companyName: string;
  workEmail: string;
  businessType: string;
  primaryUseCase: string;
  channels: string[];
  tools: string[];
  pain: string;
  urgency: string;
  notes: string;
};

export function ImplementationRequestForm({ locale = 'en' }: { locale?: SiteLocale }) {
  const c = getImplementationCopy(locale);
  const previewSnapshot = useSyncExternalStore(
    () => () => {},
    readPreviewSnapshot,
    () => null,
  );

  const preview = useMemo(() => {
    if (!previewSnapshot) return null;
    return readLandingPreviewHandoff();
  }, [previewSnapshot]);

  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [errors, setErrors] = useState<Partial<Record<ValidationField, string>>>({});
  const [preparedRequest, setPreparedRequest] = useState<PreparedRequest | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [errors]);

  function toggleSelection(list: string[], value: string) {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  return (
    <Card>
      <CardHeader>
        <Badge variant="secondary" className="w-fit">{c.badge}</Badge>
        <CardTitle>{c.title}</CardTitle>
        <CardDescription>
          {c.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          noValidate
          onChange={() => setPreparedRequest(null)}
          onSubmit={(event) => {
            event.preventDefault();
            setPreparedRequest(null);

            const formData = new FormData(event.currentTarget);
            const companyName = String(formData.get('companyName') ?? '').trim();
            const workEmail = String(formData.get('workEmail') ?? '').trim();
            const businessType = String(formData.get('businessType') ?? '').trim();
            const primaryUseCase = String(formData.get('primaryUseCase') ?? '').trim();
            const pain = String(formData.get('pain') ?? '').trim();
            const urgency = String(formData.get('urgency') ?? '').trim();
            const notes = String(formData.get('notes') ?? '').trim();

            const nextErrors: Partial<Record<ValidationField, string>> = {};
            if (!companyName) nextErrors.companyName = c.companyRequired;
            if (!isValidEmail(workEmail)) nextErrors.workEmail = c.emailInvalid;
            if (!businessType) nextErrors.businessType = c.businessTypeRequired;
            if (!primaryUseCase) nextErrors.primaryUseCase = c.useCaseRequired;
            if (selectedChannels.length === 0) nextErrors.channels = c.channelRequired;
            if (selectedTools.length === 0) nextErrors.tools = c.toolRequired;
            if (!pain) nextErrors.pain = c.painRequired;
            if (!urgency) nextErrors.urgency = c.urgencyRequired;

            setErrors(nextErrors);
            if (Object.keys(nextErrors).length > 0) {
              return;
            }

            setPreparedRequest({
              companyName,
              workEmail,
              businessType,
              primaryUseCase,
              channels: selectedChannels,
              tools: selectedTools,
              pain,
              urgency,
              notes,
            });
          }}
          data-testid="implementation-request-form"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">{c.companyName}</Label>
              <Input id="companyName" name="companyName" required maxLength={120} aria-invalid={Boolean(errors.companyName)} aria-describedby={errors.companyName ? 'companyName-error' : undefined} />
              {errors.companyName ? <p id="companyName-error" className="text-sm text-destructive">{errors.companyName}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="workEmail">{c.workEmail}</Label>
              <Input id="workEmail" name="workEmail" type="email" required maxLength={254} inputMode="email" autoComplete="email" aria-invalid={Boolean(errors.workEmail)} aria-describedby={errors.workEmail ? 'workEmail-error' : undefined} />
              {errors.workEmail ? <p id="workEmail-error" className="text-sm text-destructive">{errors.workEmail}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessType">{c.businessType}</Label>
              <Input id="businessType" name="businessType" required maxLength={120} placeholder={c.businessTypePlaceholder} aria-invalid={Boolean(errors.businessType)} aria-describedby={errors.businessType ? 'businessType-error' : undefined} />
              {errors.businessType ? <p id="businessType-error" className="text-sm text-destructive">{errors.businessType}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryUseCase">{c.primaryUseCase}</Label>
              <select id="primaryUseCase" name="primaryUseCase" className={selectClassName} defaultValue="" required aria-invalid={Boolean(errors.primaryUseCase)} aria-describedby={errors.primaryUseCase ? 'primaryUseCase-error' : undefined}>
                <option value="" disabled>{c.selectUseCase}</option>
                {IMPLEMENTATION_PRIMARY_USE_CASES.map((option) => (
                  <option key={option} value={option}>{c.translate(option)}</option>
                ))}
              </select>
              {errors.primaryUseCase ? <p id="primaryUseCase-error" className="text-sm text-destructive">{errors.primaryUseCase}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <fieldset className="min-w-0 rounded-xl border bg-muted/20 p-3" aria-invalid={Boolean(errors.channels)} aria-describedby={errors.channels ? 'channels-error' : undefined}>
              <legend className="px-1 text-xs font-medium text-muted-foreground">{c.channelsNeeded}</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {IMPLEMENTATION_CHANNELS.map((channel) => (
                  <label key={channel} className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes(channel)}
                      onChange={() => setSelectedChannels((current) => toggleSelection(current, channel))}
                      className="size-4 rounded border-input"
                    />
                    <span>{c.translate(channel)}</span>
                  </label>
                ))}
              </div>
              {errors.channels ? <p id="channels-error" className="mt-2 text-sm text-destructive">{errors.channels}</p> : null}
            </fieldset>

            <fieldset className="min-w-0 rounded-xl border bg-muted/20 p-3" aria-invalid={Boolean(errors.tools)} aria-describedby={errors.tools ? 'tools-error' : undefined}>
              <legend className="px-1 text-xs font-medium text-muted-foreground">{c.toolsToConnect}</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {IMPLEMENTATION_TOOLS.map((tool) => (
                  <label key={tool} className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={selectedTools.includes(tool)}
                      onChange={() => setSelectedTools((current) => toggleSelection(current, tool))}
                      className="size-4 rounded border-input"
                    />
                    <span>{c.translate(tool)}</span>
                  </label>
                ))}
              </div>
              {errors.tools ? <p id="tools-error" className="mt-2 text-sm text-destructive">{errors.tools}</p> : null}
            </fieldset>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pain">{c.pain}</Label>
              <textarea id="pain" name="pain" required maxLength={2000} className={textAreaClassName} placeholder={c.painPlaceholder} aria-invalid={Boolean(errors.pain)} aria-describedby={errors.pain ? 'pain-error' : undefined} />
              {errors.pain ? <p id="pain-error" className="text-sm text-destructive">{errors.pain}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{c.notes} <span className="font-normal text-muted-foreground">({c.optional})</span></Label>
              <textarea id="notes" name="notes" maxLength={2000} className={textAreaClassName} placeholder={c.notesPlaceholder} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="urgency">{c.urgency}</Label>
              <select id="urgency" name="urgency" className={selectClassName} defaultValue="" required aria-invalid={Boolean(errors.urgency)} aria-describedby={errors.urgency ? 'urgency-error' : undefined}>
                <option value="" disabled>{c.selectUrgency}</option>
                {IMPLEMENTATION_URGENCY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{c.translate(option)}</option>
                ))}
              </select>
              {errors.urgency ? <p id="urgency-error" className="text-sm text-destructive">{errors.urgency}</p> : null}
            </div>

            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">{c.previewSummary}</p>
              {preview ? (
                <div className="mt-2 space-y-1 text-sm text-foreground">
                  <p>{preview.summary}</p>
                  <p className="text-xs text-muted-foreground">{preview.workflowSlug} • {c.confidence(preview.confidence)}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{c.noPreview}</p>
              )}
            </div>
          </div>

          {Object.keys(errors).length > 0 ? (
            <div ref={errorSummaryRef} tabIndex={-1} className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring" role="alert">
              <p className="font-medium">{c.errorsTitle}</p>
            </div>
          ) : null}

          {preparedRequest ? (
            <div className="min-w-0 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-foreground" role="status" aria-live="polite">
              <p className="font-medium text-emerald-700 dark:text-emerald-300">{c.success}</p>
              <p className="mt-1 text-muted-foreground">{c.notSent}</p>
              <div className="mt-3 rounded-lg border border-emerald-500/30 bg-background/60 p-3">
                <p>{c.nextStepBody}</p>
                <Button asChild size="sm" className="mt-2 h-auto min-h-11 w-fit whitespace-normal">
                  <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                    {c.bookCall}
                    <ArrowRight className="ms-2 size-4 rtl:-scale-x-100" />
                  </a>
                </Button>
              </div>
              <p className="mt-4 font-medium">{c.preparedSummary}</p>
              <dl className="mt-2 grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">{c.summaryCompany}</dt><dd className="break-words">{preparedRequest.companyName} · {preparedRequest.workEmail} · {preparedRequest.businessType}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">{c.summaryUseCase}</dt><dd className="break-words">{c.translate(preparedRequest.primaryUseCase)}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">{c.summaryChannels}</dt><dd className="break-words">{preparedRequest.channels.map(c.translate).join(', ')}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">{c.summaryTools}</dt><dd className="break-words">{preparedRequest.tools.map(c.translate).join(', ')}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">{c.summaryUrgency}</dt><dd className="break-words">{c.translate(preparedRequest.urgency)}</dd></div>
                <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-muted-foreground">{c.summaryPain}</dt><dd className="whitespace-pre-wrap break-words">{preparedRequest.pain}</dd></div>
                {preparedRequest.notes ? <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-muted-foreground">{c.summaryNotes}</dt><dd className="whitespace-pre-wrap break-words">{preparedRequest.notes}</dd></div> : null}
              </dl>
            </div>
          ) : null}

          <Button type="submit">{c.submit}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
