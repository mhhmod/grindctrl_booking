import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ImageIcon,
  MessageCircle,
  Shirt,
  Store,
  UserCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const workflowSteps = [
  { label: 'Product selected', detail: 'Premium Ringer Tee', icon: Shirt },
  { label: 'Customer photo uploaded', detail: 'Consent-based demo input', icon: Camera },
  { label: 'Demo preview generated', detail: 'Mock visual output', icon: ImageIcon },
  { label: 'Lead captured', detail: 'High-intent shopper signal', icon: UserCheck },
  { label: 'WhatsApp follow-up ready', detail: 'Sales team can continue', icon: MessageCircle },
];

const productDetails = [
  'cream/off-white body',
  'chocolate-brown ringer trim',
  'athletic/muscle-fit silhouette',
  'demo mode active',
];

const valueCards = [
  {
    title: 'Reduce hesitation',
    body: 'Help shoppers understand how a product could look before they commit.',
  },
  {
    title: 'Capture high-intent leads',
    body: 'Treat completed previews as a stronger buying signal than casual browsing.',
  },
  {
    title: 'Connect WhatsApp/CRM follow-up',
    body: 'Prepare sales follow-up from the same flow that creates the preview.',
  },
  {
    title: 'Embed on storefronts later',
    body: 'Keep the public demo ready while the storefront widget is staged separately.',
  },
];

export function TryOnAgentShowcase() {
  return (
    <section id="try-on-agent" className="border-b border-white/10 bg-muted/10">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:px-8 lg:py-24">
        <div className="space-y-6">
          <Badge
            variant="secondary"
            className="h-7 rounded-full px-3 text-[11px] font-semibold uppercase leading-3 tracking-[0.2em]"
          >
            AI visual sales for fashion
          </Badge>

          <div className="space-y-4">
            <h2 className="max-w-3xl text-[30px] font-bold leading-[1.1] tracking-normal sm:text-4xl lg:text-[46px] lg:leading-[1.04]">
              Let shoppers preview products on themselves before they buy.
            </h2>
            <p className="max-w-2xl text-base leading-[1.65] text-muted-foreground sm:text-lg">
              GrindCTRL Try-On Agent helps fashion brands turn product curiosity into high-intent leads by connecting visual previews to WhatsApp, CRM, and sales follow-up.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="h-12 rounded-xl px-5 text-sm font-semibold">
              <Link href="/try-on">
                Try the demo
                <ArrowRight className="ms-2 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 rounded-xl px-5 text-sm font-semibold">
              <Link href="/dashboard/try-on">View dashboard</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-12 rounded-xl px-5 text-sm font-semibold">
              <Link href="/sign-up">Start business trial</Link>
            </Button>
          </div>

          <p className="rounded-2xl border bg-card/60 p-4 text-sm leading-6 text-muted-foreground">
            Demo mode is available now. Live generation and embeddable storefront widget are staged for upcoming phases.
          </p>
        </div>

        <div className="grid gap-4">
          <Card className="gc-soft-glow gc-landing-card overflow-hidden rounded-3xl border">
            <CardContent className="grid gap-5 p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Try-On workflow
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">Visual preview to sales follow-up</h3>
                </div>
                <Badge variant="outline" className="rounded-full border-white/10">
                  Demo mode
                </Badge>
              </div>

              <div className="grid gap-3">
                {workflowSteps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.label}
                      className="gc-landing-panel flex min-w-0 items-center gap-3 rounded-2xl border p-3"
                    >
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10">
                        <Icon className="size-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{step.label}</p>
                        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{step.detail}</p>
                      </div>
                      <span className="shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium text-muted-foreground">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="gc-landing-panel rounded-2xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Product
                      </p>
                      <h4 className="mt-1 font-semibold">Premium Ringer Tee</h4>
                    </div>
                    <Store className="size-5 text-primary" />
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                    {productDetails.map((detail) => (
                      <li key={detail} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {valueCards.map((card) => (
                    <div key={card.title} className="gc-card-hover rounded-2xl border bg-card/60 p-4">
                      <h4 className="text-sm font-semibold">{card.title}</h4>
                      <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{card.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
