import React from 'react';
import { BarChart3, MessageCircleMore, ScanLine, Workflow } from 'lucide-react';

const icons = [ScanLine, MessageCircleMore, Workflow, BarChart3] as const;

export function ConnectedJourneyRail({ label, stages }: { label: string; stages: string[] }) {
  return (
    <div className="rounded-2xl border border-border bg-background/90 p-3 sm:p-4">
      <p className="mb-3 text-xs font-semibold text-muted-foreground">{label}</p>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={label}>
        {stages.map((stage, index) => {
          const StageIcon = icons[index] ?? Workflow;

          return (
            <li
              key={stage}
              className="relative flex min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-muted/35 p-2.5"
            >
              <span
                className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <StageIcon className="size-4" />
              </span>
              <span className="min-w-0 text-xs font-semibold leading-snug sm:text-[11px] lg:text-xs">
                {stage}
              </span>
              {index < stages.length - 1 ? (
                <span
                  className="absolute -end-[7px] top-1/2 z-10 hidden size-3 -translate-y-1/2 rotate-45 border-e border-t border-border bg-background sm:block"
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
