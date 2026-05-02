'use client';

import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export function ImplementationRequestForm() {
  const previewSnapshot = useSyncExternalStore(
    () => () => {},
    readPreviewSnapshot,
    () => null,
  );

  const preview = useMemo(() => {
    if (!previewSnapshot) return null;
    return readLandingPreviewHandoff();
  }, [previewSnapshot]);

  const [selectedChannels, setSelectedChannels] = useState<string[]>(['Website']);
  const [selectedTools, setSelectedTools] = useState<string[]>(['Supabase', 'n8n']);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  function toggleSelection(list: string[], value: string) {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  return (
    <Card>
      <CardHeader>
        <Badge variant="secondary" className="w-fit">UI-only submission</Badge>
        <CardTitle>Implementation request</CardTitle>
        <CardDescription>
          Validate form locally, then prepare request summary. No network call happens in this phase.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(false);

            const formData = new FormData(event.currentTarget);
            const companyName = String(formData.get('companyName') ?? '').trim();
            const workEmail = String(formData.get('workEmail') ?? '').trim();
            const businessType = String(formData.get('businessType') ?? '').trim();
            const primaryUseCase = String(formData.get('primaryUseCase') ?? '').trim();
            const urgency = String(formData.get('urgency') ?? '').trim();

            const nextErrors: string[] = [];
            if (!companyName) nextErrors.push('Company name is required.');
            if (!isValidEmail(workEmail)) nextErrors.push('Work email must be valid.');
            if (!businessType) nextErrors.push('Business type is required.');
            if (!primaryUseCase) nextErrors.push('Primary use case is required.');
            if (!urgency) nextErrors.push('Urgency is required.');
            if (selectedChannels.length === 0) nextErrors.push('Select at least one channel.');
            if (selectedTools.length === 0) nextErrors.push('Select at least one tool.');

            setErrors(nextErrors);
            if (nextErrors.length > 0) {
              return;
            }

            setSubmitted(true);
          }}
          data-testid="implementation-request-form"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company name</Label>
              <Input id="companyName" name="companyName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workEmail">Work email</Label>
              <Input id="workEmail" name="workEmail" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessType">Business type</Label>
              <Input id="businessType" name="businessType" required placeholder="e.g. Healthcare, Ecommerce, Services" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryUseCase">Primary use case</Label>
              <select id="primaryUseCase" name="primaryUseCase" className={selectClassName} defaultValue="" required>
                <option value="" disabled>Select use case</option>
                {IMPLEMENTATION_PRIMARY_USE_CASES.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <fieldset className="rounded-xl border bg-muted/20 p-3">
              <legend className="px-1 text-xs font-medium text-muted-foreground">Channels needed</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {IMPLEMENTATION_CHANNELS.map((channel) => (
                  <label key={channel} className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes(channel)}
                      onChange={() => setSelectedChannels((current) => toggleSelection(current, channel))}
                      className="size-4 rounded border-input"
                    />
                    <span>{channel}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="rounded-xl border bg-muted/20 p-3">
              <legend className="px-1 text-xs font-medium text-muted-foreground">Tools to connect</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {IMPLEMENTATION_TOOLS.map((tool) => (
                  <label key={tool} className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={selectedTools.includes(tool)}
                      onChange={() => setSelectedTools((current) => toggleSelection(current, tool))}
                      className="size-4 rounded border-input"
                    />
                    <span>{tool}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pain">Current process / pain</Label>
              <textarea id="pain" name="pain" className={textAreaClassName} placeholder="Describe current bottlenecks and handoff issues." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea id="notes" name="notes" className={textAreaClassName} placeholder="Extra context for implementation team." />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="urgency">Urgency</Label>
              <select id="urgency" name="urgency" className={selectClassName} defaultValue="" required>
                <option value="" disabled>Select urgency</option>
                {IMPLEMENTATION_URGENCY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Selected preview summary</p>
              {preview ? (
                <div className="mt-2 space-y-1 text-sm text-foreground">
                  <p>{preview.summary}</p>
                  <p className="text-xs text-muted-foreground">{preview.workflowSlug} • {preview.confidence}% confidence</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No saved preview found yet.</p>
              )}
            </div>
          </div>

          {errors.length > 0 ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              <ul className="list-disc space-y-1 ps-5">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {submitted ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300" role="status">
              Implementation request prepared. The next phase will connect this to workspace storage and team notification.
            </div>
          ) : null}

          <Button type="submit">Prepare implementation request</Button>
        </form>
      </CardContent>
    </Card>
  );
}
