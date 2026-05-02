'use client';

import type React from 'react';
import {
  Bot,
  Database,
  FileImage,
  FormInput,
  GitBranch,
  Globe2,
  Headphones,
  MessageSquare,
  Mic,
  Send,
  Sparkles,
  Table2,
  TicketCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const inputNodes = [
  { label: 'Text request', icon: MessageSquare },
  { label: 'Voice note', icon: Mic },
  { label: 'File/image', icon: FileImage },
  { label: 'Website form', icon: FormInput },
  { label: 'API event', icon: Globe2 },
];

const outputNodes = [
  { label: 'Support answer', icon: Headphones },
  { label: 'Qualified lead', icon: UserCheck },
  { label: 'CRM update', icon: Database },
  { label: 'Ticket', icon: TicketCheck },
  { label: 'Google Sheet row', icon: Table2 },
  { label: 'Human handoff', icon: Users },
];

const logLines = [
  'Input detected: customer request',
  'Route selected: support + lead',
  'Action prepared: CRM update',
  'Locked action: deploy after sign-in',
];

function WorkflowNode({
  label,
  icon: Icon,
  index,
  side,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  index: number;
  side: 'input' | 'output';
}) {
  return (
    <div
      className="gc-node-pulse gc-landing-panel group flex min-w-0 items-center gap-2 rounded-2xl border px-3 py-2.5 text-[13px] text-muted-foreground shadow-sm transition duration-300 hover:shadow-md"
      style={{ animationDelay: `${index * 0.55}s` }}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-xl border ${
          side === 'input' ? 'gc-icon-input' : 'gc-icon-output'
        }`}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 break-words font-medium leading-5 text-foreground/85">{label}</span>
    </div>
  );
}

export function HeroWorkflowPreview() {
  return (
    <Card className="gc-soft-glow gc-landing-card relative min-h-[520px] overflow-hidden rounded-3xl border p-4 backdrop-blur sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_18%,rgba(96,165,250,0.16),transparent_32%),radial-gradient(circle_at_28%_72%,rgba(168,85,247,0.12),transparent_36%)]" />

      <div className="relative flex h-full min-h-[488px] flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              GRINDCTRL
            </p>
            <h2 className="mt-1 text-base font-semibold text-foreground">
              Live workflow preview
            </h2>
          </div>
          <Badge variant="outline" className="gc-landing-subtle h-7 rounded-full border px-3 text-[11px]">
            Preview mode
          </Badge>
        </div>

        <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_0.82fr_1fr]">
          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Inputs
            </p>
            {inputNodes.map((node, index) => (
              <WorkflowNode key={node.label} {...node} index={index} side="input" />
            ))}
          </div>

          <div className="relative flex min-h-44 items-center justify-center py-4">
            <div className="gc-landing-card relative z-10 flex flex-col items-center gap-3 rounded-[1.75rem] border p-4 text-center">
              <div className="relative grid size-16 place-items-center rounded-2xl border border-primary/20 bg-primary/10">
                <Sparkles className="gc-pulse-glow size-6 text-primary" />
                <span className="gc-node-ping absolute inset-0 rounded-2xl border border-primary/20" />
              </div>
              <div>
                <p className="text-sm font-semibold">AI routing engine</p>
                <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                  Understands signal, policy, and next best action.
                </p>
              </div>
              <div className="gc-landing-subtle flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground">
                <GitBranch className="size-3" />
                Routing active
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Actions
            </p>
            {outputNodes.map((node, index) => (
              <WorkflowNode key={node.label} {...node} index={index + inputNodes.length} side="output" />
            ))}
          </div>
        </div>

        <div className="gc-landing-panel rounded-2xl p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold text-foreground/90">Processing log</p>
            <Send className="size-3.5 text-muted-foreground" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {logLines.map((line, index) => (
              <div
                key={line}
                className="gc-step-appear gc-landing-subtle flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-[12px] text-muted-foreground"
                style={{ animationDelay: `${0.25 + index * 0.16}s` }}
              >
                <Bot className="size-3.5 shrink-0 text-primary" />
                <span className="min-w-0 break-words">{line}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
