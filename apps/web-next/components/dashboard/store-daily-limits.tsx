'use client';
import { useState, useTransition } from 'react';
import { Button, Group, NumberInput, Paper, Stack, Text, Title } from '@mantine/core';
import { setStoreSpendLimit } from '@/app/dashboard/settings/spend-actions';
import { getStoreFlagsCopy } from '@/lib/dashboard/store-flags-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import type { OperatorLimitRow } from '@/lib/spend/operator-data';

function LimitRow({ row, tenant, locale }: { row: OperatorLimitRow; tenant: string; locale: SiteLocale }) {
  const t = getStoreFlagsCopy(locale);
  const [value, setValue] = useState<string | number>(row.override ?? '');
  const [limit, setLimit] = useState(row.limit);
  const [status, setStatus] = useState<'saved' | 'failed' | null>(null);
  const [pending, startTransition] = useTransition();
  const valid = value === '' || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100000);
  function save() {
    if (!valid) return;
    setStatus(null);
    startTransition(async () => {
      try {
        const result = await setStoreSpendLimit({ tenant, key: row.key, value: value === '' ? null : Number(value) });
        setStatus(result.ok ? 'saved' : 'failed');
        if (result.ok) setLimit(value === '' ? row.defaultLimit : Number(value));
      } catch { setStatus('failed'); }
    });
  }
  return <Paper withBorder radius="md" p="sm">
    <Stack gap="xs">
      <Group align="end" gap="sm" wrap="wrap">
        <NumberInput label={t[row.key]} placeholder={t.default(row.defaultLimit)} description={t.default(row.defaultLimit)}
          value={value} onChange={next => { setValue(next); setStatus(null); }} min={0} max={100000} allowDecimal={false} allowNegative={false}
          disabled={pending} style={{ flex: '1 1 14rem', minWidth: 0 }} />
        <Button h={44} radius="pill" disabled={!valid || pending} loading={pending} onClick={save} aria-label={t.save + ': ' + t[row.key]}>{t.save}</Button>
      </Group>
      <Text size="sm" c="dimmed">{row.used === null ? t.unknown : t.usage(row.used, limit)}</Text>
      {status && <Text size="sm" c={status === 'failed' ? 'danger' : undefined} role={status === 'failed' ? 'alert' : 'status'}>{t[status]}</Text>}
    </Stack>
  </Paper>;
}
export function StoreDailyLimits({ rows, tenant, locale }: { rows: OperatorLimitRow[]; tenant: string; locale: SiteLocale }) {
  const t = getStoreFlagsCopy(locale);
  return <Stack gap="sm" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
    <Title order={3} size="h5">{t.dailyLimits}</Title>
    <Text size="sm" c="dimmed">{t.reset}</Text>
    {rows.map(row => <LimitRow key={row.key} row={row} tenant={tenant} locale={locale} />)}
  </Stack>;
}
