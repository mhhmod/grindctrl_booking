'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  BarChart3,
  Blocks,
  FileText,
  Headphones,
  LayoutDashboard,
  Mic,
  Quote,
  RefreshCw,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/dashboard/theme-toggle';
import { LandingLocaleToggle, useLandingLocale } from '@/components/landing/landing-locale';

import { BOOKING_URL } from '@/lib/booking';

const DEMO_URL = '/try-on';

const stepIcons = [Blocks, RefreshCw, LayoutDashboard];
const automateIcons = [Headphones, UserCheck, FileText, Mic, BarChart3, Wrench];

const PROOF_IMAGES = [
  '/landing/proof-operations.jpg',
  '/landing/proof-whatsapp.jpg',
  '/landing/proof-leads.jpg',
  '/landing/proof-inbox.png',
];

/* Testimonial quotes/photos are current placeholders pending real client
   sign-off; swap in verified quotes and swap public/landing/testimonials/*
   for real customer photos as they come in. */
const ENABLE_TESTIMONIALS = true;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]);
}

function TestimonialAvatar({
  photo,
  name,
  size = 44,
  className = '',
}: {
  photo?: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (!photo || errored) {
    return (
      <span
        className={`grid shrink-0 place-items-center rounded-full border border-border bg-background text-sm font-semibold uppercase ${className}`}
        style={{ width: size, height: size }}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-full border border-border ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={photo}
        alt={name}
        fill
        sizes={`${size}px`}
        className="object-cover"
        onError={() => setErrored(true)}
      />
    </span>
  );
}

function ScreenshotFrame({
  src,
  alt,
  width,
  height,
  caption,
  label,
  priority = false,
  hover = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption: string;
  label?: string;
  priority?: boolean;
  hover?: boolean;
}) {
  const chrome = (
    <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
      <span className="size-2.5 rounded-full bg-muted-foreground/30" />
      <span className="size-2.5 rounded-full bg-muted-foreground/30" />
      <span className="size-2.5 rounded-full bg-muted-foreground/30" />
      {label ? (
        <span className="ms-3 truncate text-xs font-medium text-muted-foreground">{label}</span>
      ) : null}
    </div>
  );
  const image = (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      sizes="(max-width: 1024px) 100vw, 50vw"
      className="h-auto w-full"
    />
  );

  if (!hover) {
    return (
      <figure className="gc-landing-card overflow-hidden rounded-2xl border">
        {chrome}
        {image}
        <figcaption className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {caption}
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="gc-landing-card gc-card-hover gc-hover-reveal overflow-hidden rounded-2xl border">
      {chrome}
      <div className="gc-reveal-media">
        {image}
        <figcaption className="gc-reveal-caption px-4 py-3 text-xs font-medium text-foreground">
          {caption}
        </figcaption>
      </div>
    </figure>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="mb-10 max-w-3xl space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="text-[28px] font-bold leading-[1.12] tracking-tight sm:text-4xl lg:text-[44px] lg:leading-[1.05]">
        {title}
      </h2>
      {body ? (
        <p className="text-base leading-[1.65] text-muted-foreground sm:text-lg">{body}</p>
      ) : null}
    </div>
  );
}

export function SiteLanding() {
  const { t } = useLandingLocale();

  return (
    <>
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" aria-label={t.brandHome} className="rounded-lg">
            <BrandLogo />
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex">
            <a href="#how" className="transition-colors hover:text-foreground">{t.navHow}</a>
            <a href="#automate" className="transition-colors hover:text-foreground">{t.navAutomate}</a>
            <a href="#proof" className="transition-colors hover:text-foreground">{t.navProof}</a>
            {ENABLE_TESTIMONIALS && (
              <a href="#clients" className="transition-colors hover:text-foreground">{t.navClients}</a>
            )}
            <Link href={DEMO_URL} className="transition-colors hover:text-foreground">{t.navDemo}</Link>
          </nav>

          <div className="flex items-center gap-2">
            <LandingLocaleToggle />
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="rounded-full px-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
              <Link href="/sign-in">{t.signIn}</Link>
            </Button>
            <Button asChild size="sm" className="hidden rounded-full px-4 font-semibold sm:inline-flex">
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">{t.bookCall}</a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="pointer-events-none absolute inset-0 -z-10 gc-hero-grid-warm" aria-hidden="true" />
          <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:py-24">
            <div className="space-y-7">
              <Badge variant="secondary" className="gc-fade-in-up h-7 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.18em]">
                {t.heroBadge}
              </Badge>
              <h1 className="gc-fade-in-up text-[clamp(2.1rem,7vw,4.25rem)] font-bold leading-[1.06] tracking-tight" style={{ animationDelay: '0.05s' }}>
                {t.heroTitle}
              </h1>
              <p className="gc-fade-in-up max-w-xl text-base leading-[1.7] text-muted-foreground sm:text-lg" style={{ animationDelay: '0.12s' }}>
                {t.heroSubtitle}
              </p>
              <div className="gc-fade-in-up flex flex-col gap-3 sm:flex-row" style={{ animationDelay: '0.18s' }}>
                <Button asChild size="lg" className="h-12 rounded-full px-6 text-sm font-semibold">
                  <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                    {t.heroPrimary}
                    <ArrowRight className="ms-2 size-4 rtl:-scale-x-100" />
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 rounded-full border-border px-6 text-sm font-semibold">
                  <Link href={DEMO_URL}>{t.heroSecondary}</Link>
                </Button>
              </div>
              <div className="gc-fade-in-up flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm text-muted-foreground" style={{ animationDelay: '0.24s' }}>
                {t.heroChips.map((chip) => (
                  <span key={chip} className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-foreground/40" aria-hidden="true" />
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div className="gc-fade-in-up lg:self-center" style={{ animationDelay: '0.1s' }}>
              <ScreenshotFrame
                src="/landing/hero-operations.jpg"
                alt={t.heroFrameCaption}
                width={1536}
                height={1024}
                caption={t.heroFrameCaption}
                label="grindctrl.cloud"
                priority
                hover
              />
            </div>
          </div>
        </section>

        {/* ─── How it works ─── */}
        <section id="how" className="border-b border-border">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <SectionHeading eyebrow={t.howEyebrow} title={t.howTitle} />
            <div className="grid gap-5 md:grid-cols-3">
              {t.howSteps.map((step, i) => {
                const Icon = stepIcons[i] ?? Blocks;
                return (
                  <div key={step.title} className="gc-card-hover gc-landing-panel rounded-2xl border p-6">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-xl border border-border bg-background">
                        <Icon className="size-5 text-foreground" />
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                    <p className="mt-2 text-[15px] leading-[1.6] text-muted-foreground">{step.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── What we automate ─── */}
        <section id="automate" className="border-b border-border bg-muted/20">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <SectionHeading eyebrow={t.automateEyebrow} title={t.automateTitle} body={t.automateBody} />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {t.automateItems.map((item, i) => {
                const Icon = automateIcons[i] ?? Headphones;
                return (
                  <div key={item.title} className="gc-card-hover gc-landing-panel rounded-2xl border p-6">
                    <div className="grid size-11 place-items-center rounded-xl border border-border bg-background">
                      <Icon className="size-5 text-foreground" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                    <p className="mt-2 text-[14px] leading-[1.6] text-muted-foreground">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── Proof ─── */}
        <section id="proof" className="border-b border-border">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <SectionHeading eyebrow={t.proofEyebrow} title={t.proofTitle} body={t.proofBody} />
            <div className="grid gap-5 sm:grid-cols-2">
              {t.proofCaptions.map((caption, i) => (
                <ScreenshotFrame
                  key={caption}
                  src={PROOF_IMAGES[i]}
                  alt={caption}
                  width={1478}
                  height={1064}
                  caption={caption}
                  hover
                />
              ))}
            </div>
            <p className="mt-6 text-xs text-muted-foreground">{t.proofPlaceholder}</p>
          </div>
        </section>

        {/* ─── Testimonials ─── */}
        {ENABLE_TESTIMONIALS && t.testimonials.length > 0 && (
          <section id="clients" className="border-b border-border bg-muted/20">
            <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
              <SectionHeading
                eyebrow={t.testimonialsEyebrow}
                title={t.testimonialsTitle}
                body={t.testimonialsBody}
              />
              <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
                <figure className="gc-landing-card gc-card-hover flex flex-col justify-between rounded-3xl border p-8 sm:p-10">
                  <Quote className="size-8 shrink-0 text-muted-foreground/40" aria-hidden="true" />
                  <blockquote className="mt-6 text-xl font-medium leading-[1.5] text-foreground sm:text-2xl">
                    {t.testimonials[0].quote}
                  </blockquote>
                  <figcaption className="mt-8 flex items-center gap-4 border-t border-border pt-6">
                    <TestimonialAvatar photo={t.testimonials[0].photo} name={t.testimonials[0].name} size={56} />
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold text-foreground">{t.testimonials[0].name}</span>
                      <span className="block truncate text-sm text-muted-foreground">{t.testimonials[0].role}</span>
                    </span>
                  </figcaption>
                </figure>

                <div className="flex flex-col divide-y divide-border">
                  {t.testimonials.slice(1).map((item) => (
                    <div key={item.name} className="flex items-start gap-4 py-5 first:pt-0 last:pb-0">
                      <TestimonialAvatar photo={item.photo} name={item.name} size={40} className="mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[15px] leading-[1.6] text-foreground">{item.quote}</p>
                        <p className="mt-2 truncate text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{item.name}</span> · {item.role}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── Integrations ─── */}
        <section className="border-b border-border bg-muted/20">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <SectionHeading eyebrow={t.integrationsEyebrow} title={t.integrationsTitle} />
            <div className="flex flex-wrap gap-2.5">
              {t.integrations.map((name) => (
                <Badge key={name} variant="outline" className="rounded-full border-border bg-background px-3.5 py-1.5 text-[13px] font-medium">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="gc-landing-card flex flex-col items-center gap-6 rounded-3xl border p-8 text-center sm:p-14">
              <div className="max-w-2xl space-y-3">
                <h2 className="text-[28px] font-bold leading-[1.12] tracking-tight sm:text-4xl lg:text-[42px]">
                  {t.ctaTitle}
                </h2>
                <p className="text-base leading-[1.65] text-muted-foreground sm:text-lg">{t.ctaBody}</p>
              </div>
              {ENABLE_TESTIMONIALS && t.testimonials.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3 rtl:space-x-reverse">
                    {t.testimonials.slice(0, 5).map((item) => (
                      <TestimonialAvatar
                        key={item.name}
                        photo={item.photo}
                        name={item.name}
                        size={32}
                        className="border-2 border-background"
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">{t.ctaTrust}</p>
                </div>
              )}
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-sm font-semibold">
                <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                  {t.ctaButton}
                  <ArrowRight className="ms-2 size-4 rtl:-scale-x-100" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="px-4 py-10 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo size="sm" textClassName="text-xs" />
          <p className="text-xs">{t.footerTagline}</p>
          <div className="flex items-center gap-5 text-xs">
            <Link href="/" className="transition-colors hover:text-foreground">{t.footerHome}</Link>
            <Link href={DEMO_URL} className="transition-colors hover:text-foreground">{t.footerDemo}</Link>
            <Link href="/dashboard/overview" className="transition-colors hover:text-foreground">{t.footerDashboard}</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
