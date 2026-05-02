import React from 'react';
import Link from 'next/link';
import { ArrowRight, Compass, Rocket, Sparkles } from 'lucide-react';
import { trialPathSteps } from '@/lib/landing/trial-preview-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const icons = [Sparkles, Compass, Rocket];

export function TrialPathCard() {
  return (
    <Card className="rounded-3xl border-white/10 bg-card/70">
      <CardContent className="p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Trial path
            </p>
            <h3 className="mt-2 text-lg font-semibold">Free guided preview to production workflow.</h3>
            <p className="mt-2 text-sm leading-[1.6] text-muted-foreground">
              Move from useful preview to connected workspace, then into custom implementation when the workflow proves value.
            </p>
          </div>

          <div className="grid flex-1 gap-3 md:grid-cols-3">
            {trialPathSteps.map((item, index) => {
              const Icon = icons[index];
              return (
                <div
                  key={item.title}
                  className="min-h-[88px] rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {item.step}
                    </span>
                    <Icon className="size-5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-[13px] leading-[1.55] text-muted-foreground">{item.body}</p>
                </div>
              );
            })}
          </div>

          <Button asChild className="h-11 rounded-xl px-4 text-sm font-semibold">
            <Link href="/sign-up?from=landing-preview">
              Start 14-day trial
              <ArrowRight className="ms-2 size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
