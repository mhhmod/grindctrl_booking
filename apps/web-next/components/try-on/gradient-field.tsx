'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deriveGradient, normalizeHex, DEFAULT_GRADIENT_INTENSITY, type GradientStops } from '@/lib/try-on/gradient';
import type { SettingsFormCopy } from '@/lib/try-on/settings-copy';

/* Three tiers, one output shape (GradientStops). Presets cover the common
   case in one click; "use my colour" derives a partner stop so a merchant
   only has to pick one hex; "advanced" is the original two-picker control,
   kept for whoever already tuned a pair by hand. */

export const GRADIENT_PRESETS: GradientStops[] = [
  { from: '#ff9a3d', to: '#ffd76e' },
  { from: '#6ab7ff', to: '#a7d9ff' },
  { from: '#5cc98d', to: '#b6f0cd' },
  { from: '#c084fc', to: '#f0abfc' },
  { from: '#f472b6', to: '#fda4af' },
  { from: '#3a3a3a', to: '#6b6b6b' },
  { from: '#eb7805', to: '#ffb25c' },
  { from: '#1f7a4d', to: '#5cc98d' },
];

type Panel = 'my-colour' | 'advanced' | null;

const sameHex = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const panelButtonClass = (active: boolean) =>
  `flex h-11 items-center rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
    active ? 'border-foreground bg-foreground/5 font-medium' : 'border-input hover:bg-muted'
  }`;

export function GradientField({
  from,
  to,
  copy,
  onChange,
}: {
  from: string;
  to: string;
  copy: SettingsFormCopy;
  onChange: (next: GradientStops) => void;
}) {
  const [panel, setPanel] = React.useState<Panel>(null);
  // Intensity has no corresponding prop and isn't meant to persist across
  // selection changes, so it stays local. The base colour is NOT mirrored
  // into state here — it always reads from `from` (see below) so a preset
  // click or an Advanced edit is never clobbered by a stale local copy.
  const [intensity, setIntensity] = React.useState(DEFAULT_GRADIENT_INTENSITY);

  const togglePanel = (next: Exclude<Panel, null>) => {
    setPanel((current) => (current === next ? null : next));
  };

  const applyMyColour = (nextBase: string, nextIntensity: number) => {
    setIntensity(nextIntensity);
    onChange(deriveGradient(nextBase, nextIntensity));
  };

  return (
    <div className="grid gap-3">
      <Label>{copy.gradientPresets}</Label>

      <div className="flex flex-wrap gap-2">
        {GRADIENT_PRESETS.map((preset) => {
          const selected = sameHex(preset.from, from) && sameHex(preset.to, to);
          return (
            <button
              key={`${preset.from}-${preset.to}`}
              type="button"
              // Hex codes, not prose — not translatable, don't move to copy.
              aria-label={`${preset.from} → ${preset.to}`}
              aria-pressed={selected}
              onClick={() => onChange(preset)}
              className={`size-11 shrink-0 rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                selected ? 'border-foreground' : 'border-transparent hover:border-input'
              }`}
              style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => togglePanel('my-colour')}
          aria-expanded={panel === 'my-colour'}
          className={panelButtonClass(panel === 'my-colour')}
        >
          {copy.gradientUseMyColour}
        </button>
        <button
          type="button"
          onClick={() => togglePanel('advanced')}
          aria-expanded={panel === 'advanced'}
          className={panelButtonClass(panel === 'advanced')}
        >
          {copy.gradientAdvanced}
        </button>
      </div>

      {panel === 'my-colour' && (
        <div className="grid gap-4 rounded-md border border-input p-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="gradient_base_colour">{copy.gradientBaseColour}</Label>
            <Input
              id="gradient_base_colour"
              type="color"
              value={normalizeHex(from) ?? from}
              className="h-11 p-1"
              onChange={(e) => applyMyColour(e.target.value, intensity)}
            />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="gradient_intensity" className="text-sm">
                {copy.gradientIntensity}
              </Label>
              <span className="tabular-nums text-xs text-muted-foreground">{intensity}</span>
            </div>
            <input
              id="gradient_intensity"
              type="range"
              min={0}
              max={100}
              value={intensity}
              onChange={(e) => applyMyColour(from, Number(e.target.value))}
              className="h-11 w-full cursor-pointer appearance-none rounded-full bg-muted accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        </div>
      )}

      {panel === 'advanced' && (
        <div className="grid grid-cols-2 gap-4 rounded-md border border-input p-3">
          <div className="grid gap-2">
            <Label htmlFor="gradient_from">{copy.iconGradientStart}</Label>
            <Input
              id="gradient_from"
              type="color"
              value={from}
              className="h-11 p-1"
              onChange={(e) => onChange({ from: e.target.value, to })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gradient_to">{copy.iconGradientEnd}</Label>
            <Input
              id="gradient_to"
              type="color"
              value={to}
              className="h-11 p-1"
              onChange={(e) => onChange({ from, to: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
