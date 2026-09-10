import React from 'react';
import { CrmPipelinePreview } from '@/components/dashboard/crm-pipeline-preview';
import { getRequestLocale } from '@/lib/auth/locale';

export default async function DashboardCrmPage() {
  const locale = await getRequestLocale();
  return <CrmPipelinePreview locale={locale} />;
}
