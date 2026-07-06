import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BOOKING_URL } from '@/lib/booking';

const workspaceItems = [
  'We build your automations around your tools',
  'We run and maintain them in production',
  'You watch everything from this dashboard',
];

const nextSteps = [
  'Book your kickoff call so we can map your first workflow',
  'Try the live demo to see an automation in action',
  'Explore agents, conversations, and leads as data comes in',
];

export function TrialWorkspaceReadinessCard() {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Workspace ready</Badge>
          <Badge variant="secondary">Done-for-you setup</Badge>
        </div>
        <CardTitle className="text-base">Welcome to GrindCTRL. Your workspace is ready.</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-muted/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">How it works</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {workspaceItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border bg-muted/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Next steps</p>
            <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-sm">
              {nextSteps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
              Book your kickoff call
              <ArrowRight className="ms-2 size-4 rtl:-scale-x-100" />
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/try-on">Try the live demo</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
