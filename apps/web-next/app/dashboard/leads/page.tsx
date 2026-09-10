import React from 'react';
import { LeadsPreviewTable } from '@/components/dashboard/leads-preview-table';
import { getRequestLocale } from '@/lib/auth/locale';

export default async function DashboardLeadsPage() {
  const locale = await getRequestLocale();
  return <LeadsPreviewTable locale={locale} />;
}
