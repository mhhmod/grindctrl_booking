import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const trialStatusItems = [
  '14-day trial',
  'Guided previews ready',
  'Implementation-ready workflows',
  'Connect tools later',
];

const reviewChecklistItems = [
  'Try a landing preview',
  'Sign up',
  'Review saved workflow preview',
  'Explore agents / conversations / leads',
  'Copy widget snippet',
  'Request implementation plan',
];

export function TrialWorkspaceReadinessCard() {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Preview active</Badge>
          <Badge variant="secondary">Ready to connect</Badge>
          <Badge variant="secondary">Implementation-ready</Badge>
        </div>
        <CardTitle className="text-base">Your GrindCTRL trial workspace is ready.</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-muted/10 px-4 py-3">
          <ul className="space-y-1.5 text-sm">
            {trialStatusItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border bg-muted/10 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Review checklist</p>
          <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-sm">
            {reviewChecklistItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
