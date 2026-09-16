import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImplementationRequestForm } from '@/components/dashboard/implementation-request-form';
import { BOOKING_URL } from '@/lib/booking';
import { saveLandingPreviewHandoff } from '@/lib/trial/landing-preview-handoff';

describe('ImplementationRequestForm', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('validates required fields before success state', () => {
    render(<ImplementationRequestForm />);

    fireEvent.submit(screen.getByTestId('implementation-request-form'));

    expect(screen.getByText('Company name is required.')).toBeInTheDocument();
    expect(screen.getByText('Work email must be valid.')).toBeInTheDocument();
    expect(screen.getByText('Business type is required.')).toBeInTheDocument();
    expect(screen.getByText('Primary use case is required.')).toBeInTheDocument();
    expect(screen.getByText('Select at least one channel.')).toBeInTheDocument();
    expect(screen.getByText('Select at least one tool.')).toBeInTheDocument();
    expect(screen.getByText('Describe the current process or pain point.')).toBeInTheDocument();
    expect(screen.getByText('Urgency is required.')).toBeInTheDocument();
  });

  it('shows selected preview summary when local handoff exists', () => {
    saveLandingPreviewHandoff({
      source: 'landing_sandbox',
      mode: 'workflow',
      workflowSlug: 'workflow_planner',
      summary: 'Prepared summary for implementation review.',
      confidence: 87,
      extractedEntities: { route: 'support' },
      decision: {
        route: 'support',
        priority: 'medium',
        handoffRequired: false,
      },
      recommendedAction: 'Request implementation plan.',
    });

    render(<ImplementationRequestForm />);

    expect(screen.getByText(/prepared summary for implementation review/i)).toBeInTheDocument();
    expect(screen.getByText(/workflow_planner/i)).toBeInTheDocument();
  });

  it('submits in UI-only mode without network calls', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<ImplementationRequestForm />);

    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'North Clinic' } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'ops@northclinic.com' } });
    fireEvent.change(screen.getByLabelText('Business type'), { target: { value: 'Healthcare' } });
    fireEvent.change(screen.getByLabelText('Primary use case'), { target: { value: 'Customer support' } });
    fireEvent.click(screen.getByLabelText('Website'));
    fireEvent.click(screen.getByLabelText('Supabase'));
    fireEvent.change(screen.getByLabelText('Current process / pain'), { target: { value: 'Support handoffs are handled manually.' } });
    fireEvent.change(screen.getByLabelText('Urgency'), { target: { value: 'This week' } });

    fireEvent.submit(screen.getByTestId('implementation-request-form'));

    expect(screen.getByText(/implementation request summary prepared locally/i)).toBeInTheDocument();
    expect(screen.getByText(/has not been sent to GrindCTRL or saved/i)).toBeInTheDocument();
    expect(screen.getByText(/support handoffs are handled manually/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /book implementation call/i })).toHaveAttribute('href', BOOKING_URL);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('clears the prepared state when request details change', () => {
    render(<ImplementationRequestForm />);

    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'North Clinic' } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'ops@northclinic.com' } });
    fireEvent.change(screen.getByLabelText('Business type'), { target: { value: 'Healthcare' } });
    fireEvent.change(screen.getByLabelText('Primary use case'), { target: { value: 'Customer support' } });
    fireEvent.click(screen.getByLabelText('Website'));
    fireEvent.click(screen.getByLabelText('Supabase'));
    fireEvent.change(screen.getByLabelText('Current process / pain'), { target: { value: 'Support handoffs are handled manually.' } });
    fireEvent.change(screen.getByLabelText('Urgency'), { target: { value: 'This week' } });
    fireEvent.submit(screen.getByTestId('implementation-request-form'));

    expect(screen.getByText(/implementation request summary prepared locally/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'North Clinic Group' } });
    expect(screen.queryByText(/implementation request summary prepared locally/i)).not.toBeInTheDocument();
  });

  it('renders truthful Arabic local-only submission copy', () => {
    render(<ImplementationRequestForm locale="ar" />);

    expect(screen.getByText('تجهيز محلي فقط')).toBeInTheDocument();
    expect(screen.getByText(/لن تغادر أي بيانات هذا المتصفح/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ملاحظات/)).toHaveAttribute('maxlength', '2000');
  });

  it('routes to booking a call after preparing a request, in Arabic', () => {
    render(<ImplementationRequestForm locale="ar" />);

    fireEvent.change(screen.getByLabelText('اسم الشركة'), { target: { value: 'عيادة الشمال' } });
    fireEvent.change(screen.getByLabelText('بريد العمل الإلكتروني'), { target: { value: 'ops@northclinic.com' } });
    fireEvent.change(screen.getByLabelText('نوع النشاط'), { target: { value: 'Healthcare' } });
    fireEvent.change(screen.getByLabelText('حالة الاستخدام الأساسية'), { target: { value: 'Customer support' } });
    fireEvent.click(screen.getByLabelText('الموقع'));
    fireEvent.click(screen.getByLabelText('Supabase'));
    fireEvent.change(screen.getByLabelText('العملية الحالية / المشكلة'), { target: { value: 'التحويل بين الفرق يتم يدويًا.' } });
    fireEvent.change(screen.getByLabelText('مدى الاستعجال'), { target: { value: 'This week' } });

    fireEvent.submit(screen.getByTestId('implementation-request-form'));

    expect(screen.getByText('تم تجهيز ملخص طلب التنفيذ محليًا.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'احجز مكالمة التنفيذ' })).toHaveAttribute('href', BOOKING_URL);
  });
});
