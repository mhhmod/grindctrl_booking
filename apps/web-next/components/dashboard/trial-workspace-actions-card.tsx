import Link from 'next/link';
import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PLAYGROUND_HREF = '/#try-grindctrl';
const IMPLEMENTATION_PLAN_HREF = '/dashboard/implementation';

function WorkspaceActionCard({
  title,
  description,
  input,
  output,
  bestFor,
  ctaLabel,
  href,
}: {
  title: string;
  description: string;
  input: string;
  output: string;
  bestFor: string;
  ctaLabel: string;
  href: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5 text-sm">
        <div className="rounded-lg border bg-muted/10 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">Input:</span> {input}
        </div>
        <div className="rounded-lg border bg-muted/10 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">Output:</span> {output}
        </div>
        <div className="rounded-lg border bg-muted/10 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">Best for:</span> {bestFor}
        </div>
        <Button asChild className="mt-2">
          <Link href={href}>
            {ctaLabel}
            <ArrowRight className="ms-2 size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function TrialWorkspaceActionsCard() {
  return (
    <section aria-label="Trial workspace actions" className="grid gap-4 md:grid-cols-2">
      <WorkspaceActionCard
        title="Support automation"
        description="Test how GrindCTRL can answer, classify, and route support requests."
        input="customer message, file, screenshot"
        output="answer, ticket route, human handoff"
        bestFor="customer support and customer service"
        ctaLabel="Preview support workflow"
        href={PLAYGROUND_HREF}
      />
      <WorkspaceActionCard
        title="Lead capture"
        description="Turn voice notes, forms, and messages into qualified leads."
        input="voice, form, website chat"
        output="lead score, CRM-ready summary, follow-up action"
        bestFor="sales and lead management"
        ctaLabel="Preview lead capture"
        href={PLAYGROUND_HREF}
      />
      <WorkspaceActionCard
        title="File/intake automation"
        description="Extract useful signals from documents, invoices, and images."
        input="file, image, context prompt"
        output="extracted fields, route, recommended action"
        bestFor="operations and back-office workflows"
        ctaLabel="Preview file intake"
        href={PLAYGROUND_HREF}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request implementation plan</CardTitle>
          <CardDescription>
            Want this connected to your real tools?
            {' '}
            Request a practical implementation plan for your workflow, CRM, support process, or internal operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={IMPLEMENTATION_PLAN_HREF}>
              Request implementation plan
              <ArrowRight className="ms-2 size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
