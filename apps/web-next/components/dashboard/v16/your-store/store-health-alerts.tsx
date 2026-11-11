'use client';
import { useState } from 'react';
import { Switch } from '@mantine/core';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { getYourStoreCopy } from '@/lib/dashboard/your-store-copy';
import classes from './v16-your-store.module.css';

export type StoreHealthAlertsProps = {
  siteId: string;
  enabled: boolean;
  save: (siteId: string, enabled: boolean) => Promise<{ ok: boolean }>;
};

export function StoreHealthAlerts({ siteId, enabled, save, locale, canChange }: StoreHealthAlertsProps & { locale: SiteLocale; canChange: boolean }) {
  const copy = getYourStoreCopy(locale);
  const [checked, setChecked] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  async function change(next: boolean) {
    setChecked(next); setSaving(true); setError(false);
    const result = await save(siteId, next).catch(() => ({ ok: false }));
    if (!result.ok) { setChecked(!next); setError(true); }
    setSaving(false);
  }
  return (
    <div id="alerts" className={`${classes.card} ${classes.alertPreference}`}>
      <Switch label={copy.alertsLabel}
        checked={checked} disabled={!canChange || saving} aria-busy={saving || undefined}
        classNames={{ track: classes.switchTrack }} onChange={(e) => void change(e.currentTarget.checked)} />
      {error && <p role="alert" className={classes.error}>{copy.saveFailed}</p>}
    </div>
  );
}
