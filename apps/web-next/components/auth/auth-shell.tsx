import React from 'react';
import Link from 'next/link';
import { DashboardSquare01Icon, Globe02Icon, MagicWand01Icon } from '@hugeicons/core-free-icons';
import { BrandLogo } from '@/components/brand-logo';
import { Icon } from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';

const AUTH_POINTS = [
  {
    icon: DashboardSquare01Icon,
    title: 'Workspace control',
    description: 'Manage install, domains, intents, and lead capture from one dashboard.',
  },
  {
    icon: Globe02Icon,
    title: 'Verified rollout',
    description: 'Track domain safety and heartbeat telemetry before production launch.',
  },
  {
    icon: MagicWand01Icon,
    title: 'Real interaction data',
    description: 'Review widget opens, messages, leads, and escalations without fake analytics.',
  },
];

export function AuthShell({
  title,
  subtitle,
  footerPrompt,
  footerCtaLabel,
  footerCtaHref,
  children,
}: {
  title: string;
  subtitle: string;
  footerPrompt: string;
  footerCtaLabel: string;
  footerCtaHref: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-28 end-[-6rem] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-36 start-[-4rem] h-80 w-80 rounded-full bg-chart-3/15 blur-3xl" />
      </div>

      <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-12">
        <section className="space-y-6">
          <Link href="/" className="inline-flex items-center gap-3 rounded-lg border bg-card/60 px-3 py-2 text-sm font-medium text-card-foreground">
            <BrandLogo size="sm" />
          </Link>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Secure dashboard access</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">{subtitle}</p>
          </div>

          <ul className="grid gap-3">
            {AUTH_POINTS.map((point) => (
              <li key={point.title} className="rounded-xl border bg-card/40 px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon icon={point.icon} size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{point.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{point.description}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <Card className="border bg-card/70 shadow-xl shadow-black/10">
            <CardContent className="px-3 py-4 sm:px-6 sm:py-6">
              <div className="[&_.cl-card]:border-0 [&_.cl-card]:bg-transparent [&_.cl-card]:shadow-none [&_.cl-footerAction]:text-foreground [&_.cl-footerActionLink]:text-foreground [&_.cl-rootBox]:mx-auto [&_.cl-rootBox]:w-full [&_.cl-socialButtonsBlockButton]:bg-background">
                {children}
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            {footerPrompt}{' '}
            <Link href={footerCtaHref} className="font-medium text-foreground underline-offset-4 hover:underline">
              {footerCtaLabel}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
