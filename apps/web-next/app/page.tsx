import Link from 'next/link';
import {
  MessageSquare,
  Mic,
  ImageIcon,
  FileText,
  Users,
  LayoutGrid,
  Cloud,
  LayoutDashboard,
  Plug,
  Settings,
  TrendingUp,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const capabilities = [
  {
    icon: MessageSquare,
    label: 'Text AI',
    description:
      'Automate text-based workflows, customer support, and content generation with production-grade AI — not a generic chatbot.',
  },
  {
    icon: Mic,
    label: 'Voice AI',
    description:
      'Transcribe, analyze, and act on voice inputs across customer interactions, call centers, and internal operations.',
  },
  {
    icon: ImageIcon,
    label: 'Image & Video',
    description:
      'Process, classify, and generate visual assets at scale within your existing pipelines and delivery systems.',
  },
  {
    icon: FileText,
    label: 'File Processing',
    description:
      'Extract structured data from documents, invoices, contracts, and reports — automatically and at volume.',
  },
  {
    icon: Users,
    label: 'CRM Integration',
    description:
      'Connect AI actions directly to your CRM — update records, route leads, and trigger follow-ups without manual steps.',
  },
  {
    icon: LayoutGrid,
    label: 'Google Workspace',
    description:
      'Automate Sheets, Docs, Gmail, and Calendar workflows with AI-driven logic that runs inside tools your team already uses.',
  },
  {
    icon: Cloud,
    label: 'Cloud Systems',
    description:
      'Integrate with AWS, GCP, Azure, and other cloud infrastructure for data orchestration and automation at scale.',
  },
  {
    icon: LayoutDashboard,
    label: 'Widgets & Dashboards',
    description:
      'Deploy embeddable AI widgets and live operational dashboards directly into your customer-facing and internal surfaces.',
  },
];

const steps = [
  {
    number: '01',
    icon: Plug,
    title: 'Connect your tools',
    description:
      'Integrate with your existing CRMs, Google Workspace, cloud platforms, and data sources. No rip-and-replace required.',
  },
  {
    number: '02',
    icon: Settings,
    title: 'Configure AI workflows',
    description:
      'Define triggers, routing rules, AI models, and automation logic. Human workflows stay in the loop where they need to.',
  },
  {
    number: '03',
    icon: TrendingUp,
    title: 'Deploy and monitor',
    description:
      'Ship workflows into production and track performance, lead capture, and operational outcomes in real time from your dashboard.',
  },
];

const useCases = [
  {
    title: 'Customer Support Automation',
    description:
      'Deploy AI-powered support widgets across your web properties. Route inquiries, capture leads, and escalate to humans — managed from one dashboard.',
    tags: ['Widget', 'Voice', 'CRM'],
  },
  {
    title: 'Internal Workflow Triage',
    description:
      'Process exceptions, approvals, and escalations through AI-structured workflows. Turn emails, voice notes, and screenshots into trackable actions.',
    tags: ['Files', 'Voice', 'Dashboards'],
  },
  {
    title: 'Document & Data Intelligence',
    description:
      'Extract structured data from contracts, invoices, and reports. Sync results to your CRM, Google Sheets, or cloud storage automatically.',
    tags: ['Files', 'CRM', 'Google Workspace'],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
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
        <section className="relative overflow-hidden border-b">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-32 right-[-5rem] h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-24 left-[-4rem] h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
          </div>

          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8 lg:py-24">
            {/* Left: copy */}
            <div className="space-y-6">
              <Badge
                variant="secondary"
                className="rounded-full px-3 py-1 text-xs uppercase tracking-widest"
              >
                AI Implementation & Automation Platform
              </Badge>

              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-[3.2rem] lg:leading-[1.13]">
                Turn AI potential into real business operations.
              </h1>

              <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                GrindCTRL integrates AI across text, voice, images, video, files, CRMs, Google
                tools, and cloud systems — deployed directly into how your business works, not
                just as a chatbot.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="min-w-44">
                  <Link href="/sign-up">
                    Get started free
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="min-w-44">
                  <Link href="/dashboard/overview">Open dashboard</Link>
                </Button>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="size-3.5 text-primary" />
                  No infrastructure lock-in
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="size-3.5 text-primary" />
                  Deploys in your existing stack
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="size-3.5 text-primary" />
                  Human workflow-aware
                </span>
              </div>
            </div>

            {/* Right: capability preview tiles */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:self-center">
              {capabilities.slice(0, 6).map((cap) => {
                const IconComp = cap.icon;
                return (
                  <div
                    key={cap.label}
                    className="flex items-center gap-3 rounded-xl border bg-card/60 px-3 py-3 backdrop-blur"
                  >
                    <div className="shrink-0 rounded-lg bg-muted p-2">
                      <IconComp className="size-4 text-muted-foreground" />
                    </div>
                    <span className="truncate text-sm font-medium">{cap.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── Capabilities ─── */}
        <section id="capabilities" className="border-b">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="mb-10 max-w-2xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Services
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                AI across every layer of your operations
              </h2>
              <p className="text-base leading-7 text-muted-foreground">
                GrindCTRL is not an LLM company. We implement AI where work actually happens —
                across every input type and system your business already uses.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {capabilities.map((cap) => {
                const IconComp = cap.icon;
                return (
                  <Card key={cap.label} className="border bg-card/60">
                    <CardHeader className="pb-3">
                      <div className="mb-2 inline-flex size-10 items-center justify-center rounded-xl bg-muted">
                        <IconComp className="size-5 text-muted-foreground" />
                      </div>
                      <CardTitle className="text-base">{cap.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-6 text-muted-foreground">{cap.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── How it works ─── */}
        <section id="how-it-works" className="border-b bg-muted/10">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="mb-10 max-w-2xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                How it works
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                From integration to production in three steps
              </h2>
              <p className="text-base leading-7 text-muted-foreground">
                A single platform path from connecting your tools to deploying monitored AI
                workflows in your operations.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {steps.map((step) => {
                const IconComp = step.icon;
                return (
                  <div key={step.number} className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <span className="text-5xl font-bold tabular-nums text-muted-foreground/20">
                        {step.number}
                      </span>
                      <div className="inline-flex size-10 items-center justify-center rounded-xl bg-muted">
                        <IconComp className="size-5 text-muted-foreground" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── Use cases ─── */}
        <section id="use-cases" className="border-b">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="mb-10 max-w-2xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Use cases
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Operations that run on AI
              </h2>
              <p className="text-base leading-7 text-muted-foreground">
                GrindCTRL is in use across support, internal ops, and data workflows. Here is what
                that looks like in practice.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {useCases.map((uc) => (
                <Card key={uc.title} className="border">
                  <CardHeader>
                    <CardTitle className="text-lg">{uc.title}</CardTitle>
                    <CardDescription className="text-sm leading-6">{uc.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {uc.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="border-b bg-muted/10">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <Card className="border bg-card/80">
              <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
                <div className="max-w-xl space-y-3">
                  <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    Ready to automate your operations?
                  </h2>
                  <p className="text-base leading-7 text-muted-foreground">
                    Connect your tools, configure your AI workflows, and deploy to production —
                    all from one platform built for real business operations.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg">
                    <Link href="/sign-up">
                      Get started free
                      <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/dashboard/overview">Open dashboard</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
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
