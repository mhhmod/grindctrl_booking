'use client';

import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Mic,
  ImageIcon,
  FileText,
  Video,
  Globe,
  Zap,
  HeadphonesIcon,
  UserCheck,
  Database,
  Ticket,
  BarChart3,
  Users,
} from 'lucide-react';

const INPUT_NODES = [
  { icon: MessageSquare, label: 'Text' },
  { icon: Mic, label: 'Voice' },
  { icon: ImageIcon, label: 'Image' },
  { icon: FileText, label: 'File' },
  { icon: Video, label: 'Video' },
  { icon: Globe, label: 'API' },
];

const OUTPUT_NODES = [
  { icon: HeadphonesIcon, label: 'Support' },
  { icon: UserCheck, label: 'Lead' },
  { icon: Database, label: 'CRM' },
  { icon: Ticket, label: 'Ticket' },
  { icon: BarChart3, label: 'Insight' },
  { icon: Users, label: 'Handoff' },
];

function TrailNode({
  icon: Icon,
  label,
  delay,
  side,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  delay: number;
  side: 'input' | 'output';
}) {
  return (
    <div
      className="gc-fade-in-up group relative flex flex-col items-center gap-1.5"
      style={{ animationDelay: `${delay}s` }}
    >
      <div
        className={`flex size-10 items-center justify-center rounded-xl gc-glass transition-colors duration-300 ${
          side === 'input'
            ? 'group-hover:bg-blue-500/10'
            : 'group-hover:bg-emerald-500/10'
        }`}
      >
        <Icon
          className={`size-4 transition-colors duration-300 ${
            side === 'input'
              ? 'text-blue-400/70 group-hover:text-blue-400'
              : 'text-emerald-400/70 group-hover:text-emerald-400'
          }`}
        />
      </div>
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

export function AiOperationsTrail() {
  const [activeSignal, setActiveSignal] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSignal((prev) => (prev + 1) % INPUT_NODES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:gap-4" aria-hidden="true">
      {/* Input side */}
      <div className="gc-stagger grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-3">
        {INPUT_NODES.map((node, idx) => (
          <TrailNode
            key={node.label}
            icon={node.icon}
            label={node.label}
            delay={idx * 0.08}
            side="input"
          />
        ))}
      </div>

      {/* Center: AI routing core */}
      <div className="relative flex shrink-0 flex-col items-center gap-2">
        {/* Connector lines (desktop only) */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 hidden h-px w-8 -translate-x-[calc(100%+2rem)] -translate-y-1/2 bg-gradient-to-r from-blue-400/0 to-blue-400/30 lg:block" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 hidden h-px w-8 translate-x-[2rem] -translate-y-1/2 bg-gradient-to-r from-emerald-400/30 to-emerald-400/0 lg:block" />

        <div className="relative flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5">
          <Zap className="size-6 text-primary gc-pulse-glow" />
          <div className="absolute inset-0 rounded-2xl border border-primary/20 gc-node-ping" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          AI Router
        </span>
        {/* Active signal indicator */}
        <div className="flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/5 px-2 py-0.5">
          <div className="size-1.5 rounded-full bg-emerald-400 gc-pulse-glow" style={{ animationDuration: '1.5s' }} />
          <span className="text-[10px] font-medium text-muted-foreground">
            {INPUT_NODES[activeSignal].label} → routing
          </span>
        </div>
      </div>

      {/* Output side */}
      <div className="gc-stagger grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-3">
        {OUTPUT_NODES.map((node, idx) => (
          <TrailNode
            key={node.label}
            icon={node.icon}
            label={node.label}
            delay={0.4 + idx * 0.08}
            side="output"
          />
        ))}
      </div>
    </div>
  );
}
