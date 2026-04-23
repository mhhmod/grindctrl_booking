'use client';

import React from 'react';
import { useEffect, useState, useTransition } from 'react';
import type { BrandingFormState } from '@/app/dashboard/branding/state';
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

const fieldClassName = 'mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-600';

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
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Branding and appearance</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Edit the active widget site using the canonical `settings_json` subset only.</p>
          </div>
          <div className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-medium text-zinc-300">Authority: `settings_json`</div>
        </div>

        <form
          className="mt-6 grid gap-6"
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
            <label className="block text-sm text-zinc-300">
              Brand name
              <input name="brandName" className={fieldClassName} value={values.brandName} onChange={(event) => setValues((current) => updateValue(current, 'brandName', event.target.value))} />
            </label>

            <label className="block text-sm text-zinc-300">
              Assistant name
              <input name="assistantName" className={fieldClassName} value={values.assistantName} onChange={(event) => setValues((current) => updateValue(current, 'assistantName', event.target.value))} />
            </label>

            <label className="block text-sm text-zinc-300">
              Launcher label
              <input name="launcherLabel" className={fieldClassName} value={values.launcherLabel} onChange={(event) => setValues((current) => updateValue(current, 'launcherLabel', event.target.value))} />
            </label>

            <label className="block text-sm text-zinc-300">
              Launcher icon
              <input name="launcherIcon" className={fieldClassName} value={values.launcherIcon} onChange={(event) => setValues((current) => updateValue(current, 'launcherIcon', event.target.value))} />
            </label>

            <label className="block text-sm text-zinc-300">
              Logo URL
              <input name="logoUrl" type="url" className={fieldClassName} value={values.logoUrl} onChange={(event) => setValues((current) => updateValue(current, 'logoUrl', event.target.value))} />
            </label>

            <label className="block text-sm text-zinc-300">
              Avatar URL
              <input name="avatarUrl" type="url" className={fieldClassName} value={values.avatarUrl} onChange={(event) => setValues((current) => updateValue(current, 'avatarUrl', event.target.value))} />
            </label>

            <label className="block text-sm text-zinc-300">
              Theme mode
              <select name="themeMode" className={fieldClassName} value={values.themeMode} onChange={(event) => setValues((current) => updateValue(current, 'themeMode', event.target.value))}>
                {themeModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-zinc-300">
              Radius style
              <select name="radiusStyle" className={fieldClassName} value={values.radiusStyle} onChange={(event) => setValues((current) => updateValue(current, 'radiusStyle', event.target.value))}>
                {radiusStyleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-zinc-300">
              Widget position
              <select name="widgetPosition" className={fieldClassName} value={values.widgetPosition} onChange={(event) => setValues((current) => updateValue(current, 'widgetPosition', event.target.value))}>
                {widgetPositionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-zinc-300">
              Attribution mode
              <select name="attributionMode" className={fieldClassName} value={values.attributionMode} onChange={(event) => setValues((current) => updateValue(current, 'attributionMode', event.target.value))}>
                {attributionModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
            <input
              name="showPoweredBy"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-zinc-200"
              checked={values.showPoweredBy}
              onChange={(event) => setValues((current) => updateValue(current, 'showPoweredBy', event.target.checked))}
            />
            <span>
              Show powered by attribution
              <span className="mt-1 block text-zinc-500">Keeps the attribution toggle inside the same `settings_json.branding.attribution` subtree.</span>
            </span>
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-6 text-sm" role="status" aria-live="polite">
              {isPending ? <span className="text-zinc-400">Saving branding...</span> : null}
              {!isPending && state.message ? <span className={state.status === 'error' ? 'text-rose-300' : 'text-emerald-300'}>{state.message}</span> : null}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
            >
              {isPending ? 'Saving...' : 'Save branding'}
            </button>
          </div>
        </form>
      </section>

      <div className="grid gap-6">
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-white">Live summary</h2>
          <dl className="mt-4 grid gap-4 text-sm text-zinc-300">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><dt className="text-zinc-500">Brand name</dt><dd className="mt-2">{values.brandName || 'Not set'}</dd></div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><dt className="text-zinc-500">Assistant name</dt><dd className="mt-2">{values.assistantName || 'Not set'}</dd></div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><dt className="text-zinc-500">Launcher label</dt><dd className="mt-2">{values.launcherLabel || 'Not set'}</dd></div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><dt className="text-zinc-500">Widget position</dt><dd className="mt-2">{values.widgetPosition}</dd></div>
          </dl>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-white">Authority boundary</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">This screen reads and writes only `settings_json`. Legacy `config_json`, `branding_json`, and `lead_capture_json` are intentionally excluded.</p>
          <pre className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-6 text-zinc-300">
            <code>{JSON.stringify(values, null, 2)}</code>
          </pre>
        </section>
      </div>
    </div>
  );
}
