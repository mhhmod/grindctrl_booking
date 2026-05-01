import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle,
  LayoutPanelTop,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TryGrindctrlSandbox } from '@/components/landing/try-grindctrl-sandbox';
import { HeroWorkflowPreview } from '@/components/landing/hero-workflow-preview';
import { LandingAfterPlaygroundSections } from '@/components/landing/landing-after-playground-sections';

export default function LandingPage() {
  return (
    <div className="gc-animated min-h-screen bg-background text-foreground">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3 text-foreground"
            aria-label="GRINDCTRL home"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              G
            </span>
            <span className="text-sm font-bold uppercase tracking-widest">GRINDCTRL</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#capabilities" className="transition-colors hover:text-foreground">
              Services
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#use-cases" className="transition-colors hover:text-foreground">
              Use cases
            </a>
            <a href="#try-grindctrl" className="transition-colors hover:text-foreground">
              Playground
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden border-b border-white/10">
          {/* Animated grid background */}
          <div className="pointer-events-none absolute inset-0 -z-10 gc-hero-grid gc-grid-pulse" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
            <div className="gc-ambient-glow absolute -top-36 end-[-7rem] h-[34rem] w-[34rem] rounded-full bg-blue-500/10 blur-[110px]" />
            <div className="gc-ambient-glow absolute bottom-10 start-[-8rem] h-[28rem] w-[28rem] rounded-full bg-violet-500/8 blur-[110px]" style={{ animationDelay: '1.8s' }} />
            <div className="gc-ambient-glow absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-[100px]" style={{ animationDelay: '3.1s' }} />
          </div>

          <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
              {/* Left: copy */}
              <div className="space-y-6">
                <Badge
                  variant="secondary"
                  className="gc-fade-in-up h-7 rounded-full px-3 text-[11px] font-semibold uppercase leading-3 tracking-[0.2em]"
                >
                  AI operations for real business workflows
                </Badge>

                <h1 className="gc-fade-in-up max-w-4xl text-[44px] font-bold leading-[1.05] tracking-normal text-foreground sm:text-[56px] sm:leading-[1.02] lg:text-[72px] lg:leading-[1]" style={{ animationDelay: '0.1s' }}>
                  Turn customer conversations, files, voice, and workflows into business actions.
                </h1>

                <p className="gc-fade-in-up max-w-2xl text-base leading-[1.65] text-muted-foreground sm:text-lg" style={{ animationDelay: '0.2s' }}>
                  GrindCTRL helps teams build AI-powered support, lead capture, CRM updates, file
                  processing, and operations workflows across the tools they already use.
                </p>

                <div className="gc-fade-in-up flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: '0.3s' }}>
                  <Button asChild size="lg" className="h-12 rounded-xl px-5 text-sm font-semibold shadow-[0_0_32px_rgba(99,102,241,0.18)] lg:px-6">
                    <a href="#try-grindctrl">
                      Try the AI playground
                      <ArrowRight className="ms-2 size-4" />
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="h-12 rounded-xl border-white/10 bg-white/[0.03] px-5 text-sm font-semibold hover:bg-white/[0.06] lg:px-6">
                    <Link href="/sign-up">
                      Start 14-day trial
                      <ArrowRight className="ms-2 size-4" />
                    </Link>
                  </Button>
                  <Link
                    href="/dashboard/overview"
                    className="inline-flex h-12 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <LayoutPanelTop className="size-4" />
                    Open dashboard
                  </Link>
                </div>

                <div className="gc-fade-in-up flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground" style={{ animationDelay: '0.4s' }}>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="size-3.5 text-primary" />
                    Support + service
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="size-3.5 text-primary" />
                    Leads + CRM
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="size-3.5 text-primary" />
                    Files + voice
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="size-3.5 text-primary" />
                    Human handoff
                  </span>
                </div>
              </div>

              {/* Right: workflow preview */}
              <div className="gc-fade-in-up lg:self-center" style={{ animationDelay: '0.18s' }}>
                <HeroWorkflowPreview />
              </div>
            </div>
          </div>
        </section>

        <TryGrindctrlSandbox />
        <LandingAfterPlaygroundSections />
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
              G
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-foreground">
              GRINDCTRL
            </span>
          </div>
          <p className="text-xs">AI implementation and automation platform.</p>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/sign-in" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Link href="/sign-up" className="transition-colors hover:text-foreground">
              Sign up
            </Link>
            <Link href="/dashboard/overview" className="transition-colors hover:text-foreground">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
