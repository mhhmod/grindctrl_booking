import Link from 'next/link';
import {
  DashboardSquare01Icon,
  Download01Icon,
  Globe02Icon,
  MagicWand01Icon,
  Palette,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { Icon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const flowSteps = [
  {
    icon: Download01Icon,
    label: 'Embed',
    title: 'Install one loader contract',
    body: 'Use the queue + loader snippet with your embed key. No host framework lock-in is required.',
  },
  {
    icon: Palette,
    label: 'Configure',
    title: 'Set branding, intents, and lead capture',
    body: 'Keep all editable widget behavior in `settings_json` and route intents through the existing backend contracts.',
  },
  {
    icon: DashboardSquare01Icon,
    label: 'Operate',
    title: 'Monitor rollout quality',
    body: 'Track domain safety, install heartbeat, and interaction telemetry directly from your dashboard scope.',
  },
];

const eventRows = [
  ['widget_open', 'Panel open interactions'],
  ['conversation_start', 'Conversation bootstrap starts'],
  ['message_sent', 'User message submissions'],
  ['lead_captured', 'Lead capture completions'],
  ['escalation_trigger', 'Handoff escalation events'],
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight text-foreground">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">G</span>
            <span>GRINDCTRL</span>
          </Link>

          <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#analytics" className="hover:text-foreground">Analytics</a>
            <a href="#trust" className="hover:text-foreground">Trust rails</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/overview">Open dashboard</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 end-[-4rem] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-20 start-[-6rem] h-80 w-80 rounded-full bg-chart-3/10 blur-3xl" />
          </div>

          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:gap-10 lg:px-8 lg:py-20">
            <div className="space-y-6">
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em]">Production readiness track</Badge>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Operate your support widget rollout with verified install and real interaction telemetry.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                This Next surface is now the canonical path for landing, auth, and dashboard control. Keep installs stable, route intents safely, and monitor real event deltas by site.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="min-w-40">
                  <Link href="/dashboard/install">Install widget</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="min-w-40">
                  <Link href="/sign-up">Create workspace</Link>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card>
                  <CardContent className="px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Contracts</p>
                    <p className="mt-2 text-sm font-medium text-foreground">Queue + loader v1</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Authority</p>
                    <p className="mt-2 text-sm font-medium text-foreground">`settings_json` only</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Telemetry</p>
                    <p className="mt-2 text-sm font-medium text-foreground">Event-driven, no fake KPIs</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="border bg-card/70 shadow-2xl shadow-black/15">
              <CardHeader>
                <CardTitle>Canonical install contract</CardTitle>
                <CardDescription>Use this snippet shape for production-safe loader bootstrapping.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <pre className="overflow-x-auto rounded-xl border bg-muted/20 p-4 text-xs leading-6 text-muted-foreground" dir="ltr">
{`<script>
  window.GrindctrlSupport = window.GrindctrlSupport || [];
  window.GrindctrlSupport.push({
    embedKey: 'gc_live_xxxxx',
    user: { id: null, email: null, name: null },
    context: { custom: {} }
  });
</script>
<script async src="https://cdn.grindctrl.com/widget/v1/loader.js"></script>`}
                </pre>

                <div className="grid gap-3">
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/10 px-3 py-2 text-sm">
                    <Icon icon={Globe02Icon} size={16} className="text-muted-foreground" />
                    <span>Install works across plain HTML, React, and CMS environments.</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/10 px-3 py-2 text-sm">
                    <Icon icon={UserGroupIcon} size={16} className="text-muted-foreground" />
                    <span>Conversation, leads, and event telemetry stay backend-authoritative.</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="how-it-works" className="border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <div className="mb-8 max-w-2xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">How it works</p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Three-step operator flow</h2>
              <p className="text-sm leading-7 text-muted-foreground sm:text-base">A single dashboard path from snippet install to production-safe widget operations.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {flowSteps.map((step) => (
                <Card key={step.title}>
                  <CardHeader>
                    <div className="mb-2 inline-flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Icon icon={step.icon} size={18} />
                    </div>
                    <CardDescription>{step.label}</CardDescription>
                    <CardTitle className="text-xl">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-7 text-muted-foreground">{step.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="analytics" className="border-t bg-muted/10">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-16">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Interaction analytics</p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Understand data differences by real event type</h2>
              <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                The dashboard now supports event-window views for `24h`, `7d`, and `30d`, powered by `widget_events` read models.
              </p>
              <div className="space-y-2">
                {eventRows.map(([event, detail]) => (
                  <div key={event} className="rounded-lg border bg-background px-3 py-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground" dir="ltr">{event}</span>
                    <p className="mt-1 text-foreground">{detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <Card className="border bg-card/70">
              <CardHeader>
                <CardTitle>Operator outcomes</CardTitle>
                <CardDescription>What this dashboard now enables for production rollout decisions.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="rounded-lg border bg-muted/10 px-3 py-3 text-sm">
                  <p className="font-medium text-foreground">Install confidence</p>
                  <p className="mt-1 text-muted-foreground">Verify heartbeat recency and origin safety before live rollout.</p>
                </div>
                <div className="rounded-lg border bg-muted/10 px-3 py-3 text-sm">
                  <p className="font-medium text-foreground">Conversation quality</p>
                  <p className="mt-1 text-muted-foreground">Track opens, starts, messages, leads, and escalations by window.</p>
                </div>
                <div className="rounded-lg border bg-muted/10 px-3 py-3 text-sm">
                  <p className="font-medium text-foreground">Config authority</p>
                  <p className="mt-1 text-muted-foreground">Keep editable behavior centralized in `settings_json` and audited dashboard flows.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="trust" className="border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <Card>
              <CardHeader>
                <CardTitle>Trust rails for production operation</CardTitle>
                <CardDescription>Security and reliability boundaries preserved during UI refinement.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border bg-muted/10 px-3 py-3 text-sm">
                  <p className="font-medium text-foreground">Domain enforcement</p>
                  <p className="mt-1 text-muted-foreground">Bootstrap and API calls remain origin-scoped through backend contracts.</p>
                </div>
                <div className="rounded-lg border bg-muted/10 px-3 py-3 text-sm">
                  <p className="font-medium text-foreground">No fake metrics</p>
                  <p className="mt-1 text-muted-foreground">Charts only render stored events and explicit empty/error states.</p>
                </div>
                <div className="rounded-lg border bg-muted/10 px-3 py-3 text-sm">
                  <p className="font-medium text-foreground">Versioned runtime</p>
                  <p className="mt-1 text-muted-foreground">Public embed continues on `widget/v1/loader.js` compatibility guarantees.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="border-t bg-muted/10">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <Card className="border bg-card/80 text-center">
              <CardHeader>
                <CardTitle className="text-3xl">Ready to operate your rollout in one place?</CardTitle>
                <CardDescription>Sign in, select a site, and move from install to interaction analytics without context switching.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/dashboard/overview">Go to dashboard</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/sign-up">Create workspace</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>GRINDCTRL widget operations platform</p>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/install" className="hover:text-foreground">Install</Link>
            <Link href="/dashboard/overview" className="hover:text-foreground">Overview</Link>
            <Link href="/sign-in" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
