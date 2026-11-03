'use client';

import Link from 'next/link';
import { Button } from '@mantine/core';
import { V16Notice } from '@/components/dashboard/v16/notice';

/* The /claim outcome page: one message, and the real next steps for it. */
export function ClaimMessage({
  locale,
  title,
  body,
  actions,
}: {
  locale: 'en' | 'ar';
  title: string;
  body: string;
  /** Real, working next steps, never a fabricated contact link. */
  actions?: Array<{ label: string; href: string }>;
}) {
  return (
    <section dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale} className="grid min-w-0 place-items-center px-4 py-16">
      <V16Notice title={title} body={body}>
        {actions?.map((action, index) => (
          <Button
            key={action.href}
            component={Link}
            href={action.href}
            radius="pill"
            h={44}
            variant={index === 0 ? 'filled' : 'subtle'}
          >
            {action.label}
          </Button>
        ))}
      </V16Notice>
    </section>
  );
}
