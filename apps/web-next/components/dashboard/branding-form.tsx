'use client';

import React from 'react';
import { useEffect, useState, useTransition } from 'react';
import type { BrandingFormState } from '@/app/dashboard/branding/state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BrandingViewModel } from '@/lib/view-models/branding';

const themeModeOptions = [
  { value: 'auto', label: 'Auto' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const radiusStyleOptions = [
  { value: 'soft', label: 'Soft' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'sharp', label: 'Sharp' },
];

const widgetPositionOptions = [
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-left', label: 'Bottom left' },
];

const attributionModeOptions = [
  { value: 'auto', label: 'Auto' },
  { value: 'always', label: 'Always show' },
  { value: 'hidden', label: 'Hide' },
];

const selectClassName = 'h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';
const checkboxClassName = 'mt-1 size-4 rounded border-input bg-input/30 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function updateValue(values: BrandingViewModel, key: keyof BrandingViewModel, value: string | boolean): BrandingViewModel {
  return { ...values, [key]: value };
}

export function BrandingForm({
  initialState,
  saveAction,
}: {
  initialState: BrandingFormState;
  saveAction: (formData: FormData) => Promise<BrandingFormState>;
}) {
  const [state, setState] = useState(initialState);
  const [values, setValues] = useState(initialState.values);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setState(initialState);
    setValues(initialState.values);
  }, [initialState]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Branding and appearance</CardTitle>
            <CardDescription>Edit the active widget site using the canonical `settings_json` subset only.</CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0">Authority: `settings_json`</Badge>
        </CardHeader>

        <CardContent>
          <form
            className="grid gap-6"
            onSubmit={(event) => {
              event.preventDefault();

              const formData = new FormData(event.currentTarget);
              startTransition(async () => {
                const nextState = await saveAction(formData);
                setState(nextState);
                setValues(nextState.values);
              });
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brandName">Brand name</Label>
                <Input id="brandName" name="brandName" value={values.brandName} onChange={(event) => setValues((current) => updateValue(current, 'brandName', event.target.value))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assistantName">Assistant name</Label>
                <Input id="assistantName" name="assistantName" value={values.assistantName} onChange={(event) => setValues((current) => updateValue(current, 'assistantName', event.target.value))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="launcherLabel">Launcher label</Label>
                <Input id="launcherLabel" name="launcherLabel" value={values.launcherLabel} onChange={(event) => setValues((current) => updateValue(current, 'launcherLabel', event.target.value))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="launcherIcon">Launcher icon</Label>
                <Input id="launcherIcon" name="launcherIcon" value={values.launcherIcon} onChange={(event) => setValues((current) => updateValue(current, 'launcherIcon', event.target.value))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input id="logoUrl" name="logoUrl" type="url" value={values.logoUrl} onChange={(event) => setValues((current) => updateValue(current, 'logoUrl', event.target.value))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatarUrl">Avatar URL</Label>
                <Input id="avatarUrl" name="avatarUrl" type="url" value={values.avatarUrl} onChange={(event) => setValues((current) => updateValue(current, 'avatarUrl', event.target.value))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="themeMode">Theme mode</Label>
                <select id="themeMode" name="themeMode" className={selectClassName} value={values.themeMode} onChange={(event) => setValues((current) => updateValue(current, 'themeMode', event.target.value))}>
                  {themeModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="radiusStyle">Radius style</Label>
                <select id="radiusStyle" name="radiusStyle" className={selectClassName} value={values.radiusStyle} onChange={(event) => setValues((current) => updateValue(current, 'radiusStyle', event.target.value))}>
                  {radiusStyleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="widgetPosition">Widget position</Label>
                <select id="widgetPosition" name="widgetPosition" className={selectClassName} value={values.widgetPosition} onChange={(event) => setValues((current) => updateValue(current, 'widgetPosition', event.target.value))}>
                  {widgetPositionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="attributionMode">Attribution mode</Label>
                <select id="attributionMode" name="attributionMode" className={selectClassName} value={values.attributionMode} onChange={(event) => setValues((current) => updateValue(current, 'attributionMode', event.target.value))}>
                  {attributionModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/10 p-4">
              <div className="flex items-start gap-3">
                <input
                  id="showPoweredBy"
                  name="showPoweredBy"
                  type="checkbox"
                  className={checkboxClassName}
                  checked={values.showPoweredBy}
                  onChange={(event) => setValues((current) => updateValue(current, 'showPoweredBy', event.target.checked))}
                />
                <div>
                  <Label htmlFor="showPoweredBy">Show powered by attribution</Label>
                  <p className="mt-1 text-sm text-muted-foreground">Keeps the attribution toggle inside the same `settings_json.branding.attribution` subtree.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-h-6 text-sm" role="status" aria-live="polite">
                {isPending ? <span className="text-muted-foreground">Saving branding...</span> : null}
                {!isPending && state.message ? (
                  state.status === 'error' ? (
                    <span className="text-destructive">{state.message}</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">{state.message}</span>
                  )
                ) : null}
              </div>

              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save branding'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Live summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm">
              <div className="rounded-lg border bg-muted/10 p-4"><dt className="text-muted-foreground">Brand name</dt><dd className="mt-2 text-foreground">{values.brandName || 'Not set'}</dd></div>
              <div className="rounded-lg border bg-muted/10 p-4"><dt className="text-muted-foreground">Assistant name</dt><dd className="mt-2 text-foreground">{values.assistantName || 'Not set'}</dd></div>
              <div className="rounded-lg border bg-muted/10 p-4"><dt className="text-muted-foreground">Launcher label</dt><dd className="mt-2 text-foreground">{values.launcherLabel || 'Not set'}</dd></div>
              <div className="rounded-lg border bg-muted/10 p-4"><dt className="text-muted-foreground">Widget position</dt><dd className="mt-2 text-foreground">{values.widgetPosition}</dd></div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Authority boundary</CardTitle>
            <CardDescription>This screen reads and writes only `settings_json`. Legacy `config_json`, `branding_json`, and `lead_capture_json` are intentionally excluded.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg border bg-muted/10 p-4 text-xs leading-6 text-muted-foreground">
              <code>{JSON.stringify(values, null, 2)}</code>
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
