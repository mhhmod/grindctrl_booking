import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('recharts', () => ({
  Bar: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

import { AgentCard } from '@/components/dashboard/agent-card';
import { AgentDetailPreview } from '@/components/dashboard/agent-detail-preview';
import { AnalyticsPreview } from '@/components/dashboard/analytics-preview';
import { ConversationInboxPreview } from '@/components/dashboard/conversation-inbox-preview';
import { CrmPipelinePreview } from '@/components/dashboard/crm-pipeline-preview';
import { ImplementationRequestForm } from '@/components/dashboard/implementation-request-form';
import { LeadsPreviewTable } from '@/components/dashboard/leads-preview-table';
import { WorkflowCatalog } from '@/components/dashboard/workflow-catalog';
import { WorkflowPreviewHistory } from '@/components/dashboard/workflow-preview-history';
import { AGENT_CATALOG } from '@/lib/dashboard/agent-catalog';

describe('dashboard content locale copy', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it.each([
    ['en', 'Leads preview', 'Source channel'],
    ['ar', 'معاينة العملاء المحتملين', 'قناة المصدر'],
  ] as const)('renders leads preview in %s', (locale, title, column) => {
    render(<LeadsPreviewTable locale={locale} />);
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(column)).toBeInTheDocument();
  });

  it.each([
    ['en', 'Inputs', 'Configure preview', 'Sample trigger'],
    ['ar', 'المدخلات', 'إعداد المعاينة', 'مثال على المشغّل'],
  ] as const)('renders agent components in %s', (locale, inputs, configure, trigger) => {
    const { unmount } = render(
      <AgentCard agent={AGENT_CATALOG[0]} isSelected={false} locale={locale} />,
    );
    expect(screen.getByText(inputs)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: configure })).toBeInTheDocument();
    unmount();

    render(<AgentDetailPreview agent={AGENT_CATALOG[0]} locale={locale} />);
    expect(screen.getByText(trigger)).toBeInTheDocument();
  });

  it.each([
    ['en', 'Preview inbox', 'Customer message'],
    ['ar', 'معاينة صندوق الوارد', 'رسالة العميل'],
  ] as const)('renders conversation preview in %s', (locale, badge, customerMessage) => {
    render(
      <ConversationInboxPreview
        locale={locale}
        selectedId="conv_web_001"
        routeBase="/dashboard/conversations"
        title={locale === 'ar' ? 'المحادثات' : 'Conversations'}
        description={locale === 'ar' ? 'قائمة موحّدة للمحادثات.' : 'Unified conversation queue.'}
      />,
    );
    expect(screen.getByText(badge)).toBeInTheDocument();
    expect(screen.getByText(customerMessage)).toBeInTheDocument();
  });

  it.each([
    ['en', 'CRM pipeline preview', 'Sync readiness'],
    ['ar', 'معاينة مسار إدارة العملاء', 'جاهزية المزامنة'],
  ] as const)('renders CRM preview in %s', (locale, title, readiness) => {
    render(<CrmPipelinePreview locale={locale} />);
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(readiness)).toBeInTheDocument();
  });

  it.each([
    ['en', 'Workflow catalog', 'Trigger / input'],
    ['ar', 'دليل مسارات العمل', 'المشغّل / المدخل'],
  ] as const)('renders workflow catalog in %s', (locale, title, trigger) => {
    render(<WorkflowCatalog locale={locale} />);
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getAllByText(trigger)).not.toHaveLength(0);
  });

  it.each([
    ['en', 'Latest trial preview', 'No saved preview yet.'],
    ['ar', 'أحدث معاينة تجريبية', 'لا توجد معاينة محفوظة بعد.'],
  ] as const)('renders workflow history in %s', (locale, title, empty) => {
    render(<WorkflowPreviewHistory locale={locale} />);
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(empty))).toBeInTheDocument();
  });

  it.each([
    ['en', 'Trial funnel', 'Operations metrics'],
    ['ar', 'مسار التجربة', 'مؤشرات التشغيل'],
  ] as const)('renders analytics preview in %s', (locale, funnel, operations) => {
    render(<AnalyticsPreview locale={locale} />);
    expect(screen.getByText(funnel)).toBeInTheDocument();
    expect(screen.getByText(operations)).toBeInTheDocument();
  });

  it.each([
    ['en', 'Implementation request', 'Company name'],
    ['ar', 'طلب التنفيذ', 'اسم الشركة'],
  ] as const)('renders implementation form in %s', (locale, title, company) => {
    render(<ImplementationRequestForm locale={locale} />);
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByLabelText(company)).toBeInTheDocument();
  });
});
