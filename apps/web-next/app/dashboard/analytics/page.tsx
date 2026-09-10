import React from 'react';
import { AnalyticsPreview } from '@/components/dashboard/analytics-preview';
import { getRequestLocale } from '@/lib/auth/locale';

export default async function DashboardAnalyticsPage() {
  const locale = await getRequestLocale();
  return <AnalyticsPreview locale={locale} />;
}
