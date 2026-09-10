import React from 'react';
import { ImplementationRequestForm } from '@/components/dashboard/implementation-request-form';
import { getRequestLocale } from '@/lib/auth/locale';

export default async function DashboardImplementationPage() {
  const locale = await getRequestLocale();
  return <ImplementationRequestForm locale={locale} />;
}
