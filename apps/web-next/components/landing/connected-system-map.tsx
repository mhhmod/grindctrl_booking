import React from 'react';
import { ArrowRight02Icon } from '@hugeicons/core-free-icons';
import { Icon } from '@/components/icons';

interface SystemMapRow {
  shopper: string;
  grindctrl: string;
  business: string;
}

export function ConnectedSystemMap({ columns, rows }: {
  columns: [string, string, string];
  rows: SystemMapRow[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="hidden grid-cols-[0.9fr_auto_1.1fr_auto_1fr] items-center gap-3 border-b border-border bg-muted/45 px-5 py-3 text-xs font-semibold text-muted-foreground md:grid">
        <span>{columns[0]}</span><span aria-hidden="true" />
        <span>{columns[1]}</span><span aria-hidden="true" />
        <span>{columns[2]}</span>
      </div>
      <ol className="divide-y divide-border">
        {rows.map((row) => (
          <li
            key={`${row.shopper}-${row.grindctrl}`}
            className="gc-spotlight grid min-w-0 gap-3 px-4 py-4 md:grid-cols-[0.9fr_auto_1.1fr_auto_1fr] md:items-center md:px-5"
          >
            <MapCell label={columns[0]} value={row.shopper} />
            <Connector />
            <MapCell label={columns[1]} value={row.grindctrl} accent />
            <Connector />
            <MapCell label={columns[2]} value={row.business} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function MapCell({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl p-3 ${accent ? 'bg-primary/10' : 'bg-muted/30 md:bg-transparent'}`}>
      <span className="mb-1 block text-[10px] font-semibold text-muted-foreground md:hidden">{label}</span>
      <span className="block text-sm font-medium leading-snug">{value}</span>
    </div>
  );
}

function Connector() {
  return <Icon icon={ArrowRight02Icon} className="mx-auto size-4 rotate-90 text-muted-foreground/60 md:rotate-0 rtl:md:rotate-180" aria-hidden="true" />;
}
