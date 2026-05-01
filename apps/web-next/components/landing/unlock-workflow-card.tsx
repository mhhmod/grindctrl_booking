import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UnlockWorkflowCardProps {
  variant?: 'result' | 'completed';
}

export function UnlockWorkflowCard({ variant = 'result' }: UnlockWorkflowCardProps) {
  const completed = variant === 'completed';

  return (
    <div className="rounded-3xl border border-primary/20 bg-primary/10 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10">
          <CheckCircle2 className="size-5 text-primary" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold">
            {completed ? "You've completed today's guided previews." : 'Unlock the full workflow'}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {completed
              ? 'Start a 14-day trial to save, connect, deploy, and monitor workflows.'
              : 'Save this preview, connect your tools, deploy actions, and track results in your dashboard.'}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button asChild size="sm" className="h-11 rounded-xl">
          <Link href="/sign-up">
            Start 14-day trial
            <ArrowRight className="ms-2 size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-11 rounded-xl border-white/10 bg-white/[0.03]">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
