import React from 'react';
import { Badge } from '@/components/ui/badge';

interface PlatformPillar {
  title: string;
  body: string;
  status: string;
}

export function PlatformPillars({ items }: { items: PlatformPillar[] }) {
  return (
    <ol className="overflow-hidden rounded-2xl border border-border bg-background">
      {items.map((item, index) => (
        <li
          key={item.title}
          className="grid min-w-0 gap-3 border-b border-border p-4 last:border-b-0 sm:p-5 md:grid-cols-[3rem_minmax(0,0.72fr)_minmax(0,1.28fr)_auto] md:items-center md:gap-5"
        >
          <span className="text-xs font-bold tabular-nums text-muted-foreground" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className="text-lg font-bold tracking-tight">{item.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
          <Badge variant="outline" className="h-auto w-fit whitespace-normal py-1 text-start text-[10px] font-semibold">
            {item.status}
          </Badge>
        </li>
      ))}
    </ol>
  );
}
