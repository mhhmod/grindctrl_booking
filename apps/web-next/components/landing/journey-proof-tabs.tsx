'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface JourneyStage {
  title: string;
  body: string;
}

export function JourneyProofTabs({
  dir,
  label,
  stages,
}: {
  dir: 'ltr' | 'rtl';
  label: string;
  stages: JourneyStage[];
}) {
  const [activeStage, setActiveStage] = React.useState('stage-0');

  return (
    <div className="rounded-2xl border border-border bg-background p-4 sm:p-5">
      <p className="mb-4 text-xs font-semibold text-muted-foreground">{label}</p>
      <Tabs dir={dir} value={activeStage} onValueChange={setActiveStage}>
        <TabsList
          aria-label={label}
          className="grid h-auto w-full grid-cols-2 gap-2 rounded-xl bg-muted/55 p-2 sm:grid-cols-4"
        >
          {stages.map((stage, index) => (
            <TabsTrigger
              key={stage.title}
              value={`stage-${index}`}
              className="h-auto min-h-11 whitespace-normal rounded-lg px-2 py-2 text-start text-xs leading-snug"
            >
              <span className="text-[10px] tabular-nums text-muted-foreground" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              {stage.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {stages.map((stage, index) => (
          <TabsContent
            key={stage.title}
            value={`stage-${index}`}
            className="mt-3 min-h-36 rounded-xl border border-border bg-muted/25 p-5 sm:min-h-32"
          >
            <p className="text-xs font-semibold text-primary">
              {String(index + 1).padStart(2, '0')}
            </p>
            <h3 className="mt-2 text-xl font-bold tracking-tight">{stage.title}</h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {stage.body}
            </p>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
