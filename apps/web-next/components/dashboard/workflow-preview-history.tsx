'use client';

import React, { useMemo, useSyncExternalStore } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LANDING_PREVIEW_STORAGE_KEY, readLandingPreviewHandoff } from '@/lib/trial/landing-preview-handoff';

function readPreviewSnapshot() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LANDING_PREVIEW_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function WorkflowPreviewHistory() {
  const snapshot = useSyncExternalStore(
    () => () => {},
    readPreviewSnapshot,
    () => null,
  );

  const preview = useMemo(() => {
    if (!snapshot) return null;
    return readLandingPreviewHandoff();
  }, [snapshot]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest trial preview</CardTitle>
        <CardDescription>Read from local handoff storage only. No database history is fabricated.</CardDescription>
      </CardHeader>
      <CardContent>
        {!preview ? (
          <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            No saved preview yet. Run a guided preview from the landing playground to populate this section.
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{preview.mode}</Badge>
              <Badge variant="outline">{preview.workflowSlug}</Badge>
              <Badge variant="secondary">{preview.confidence}% confidence</Badge>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3 text-sm text-foreground">{preview.summary}</div>
            <div className="rounded-xl border bg-muted/20 p-3 text-sm text-foreground">Recommended action: {preview.recommendedAction}</div>
            <p className="text-xs text-muted-foreground">Captured at {new Date(preview.createdAt).toLocaleString()}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
