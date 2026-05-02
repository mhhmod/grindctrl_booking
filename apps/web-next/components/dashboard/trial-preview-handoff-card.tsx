'use client';

import Link from 'next/link';
import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LANDING_PREVIEW_STORAGE_KEY,
  readLandingPreviewHandoff,
  type SavedLandingPreview,
} from '@/lib/trial/landing-preview-handoff';

function yesNo(value: boolean) {
  return value ? 'Yes' : 'No';
}

function readPreviewStorageSnapshot() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LANDING_PREVIEW_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function TrialPreviewHandoffCard() {
  const rawPreview = useSyncExternalStore(
    () => () => {},
    readPreviewStorageSnapshot,
    () => null,
  );
  const preview = useMemo<SavedLandingPreview | null>(() => {
    if (!rawPreview) return null;
    return readLandingPreviewHandoff();
  }, [rawPreview]);
  const [savedForTrialReview, setSavedForTrialReview] = useState(false);

  if (!preview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Start with a guided AI workflow preview</CardTitle>
          <CardDescription>Run a guided preview from the landing playground, then continue inside the dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/#try-grindctrl">Try playground</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/implementation">Request implementation plan</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Trial preview handoff</Badge>
          <Badge variant="outline">{preview.mode}</Badge>
          <Badge variant="outline">{preview.confidence}% confidence</Badge>
        </div>
        <CardTitle>Your first AI workflow preview is ready</CardTitle>
        <CardDescription>{preview.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border bg-muted/10 px-3 py-2.5">
            <div className="text-xs text-muted-foreground">Workflow slug</div>
            <div className="mt-1 font-medium">{preview.workflowSlug}</div>
          </div>
          <div className="rounded-lg border bg-muted/10 px-3 py-2.5">
            <div className="text-xs text-muted-foreground">Decision route</div>
            <div className="mt-1 font-medium">{preview.decision.route}</div>
          </div>
          <div className="rounded-lg border bg-muted/10 px-3 py-2.5">
            <div className="text-xs text-muted-foreground">Priority</div>
            <div className="mt-1 font-medium capitalize">{preview.decision.priority}</div>
          </div>
          <div className="rounded-lg border bg-muted/10 px-3 py-2.5">
            <div className="text-xs text-muted-foreground">Handoff required</div>
            <div className="mt-1 font-medium">{yesNo(preview.decision.handoffRequired)}</div>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/10 px-3 py-2.5 text-sm">
          <div className="text-xs text-muted-foreground">Recommended action</div>
          <div className="mt-1 font-medium">{preview.recommendedAction}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setSavedForTrialReview(true)} disabled={savedForTrialReview}>
            {savedForTrialReview ? 'Saved for trial review' : 'Save to trial review'}
          </Button>
          <Button asChild variant="outline">
            <Link href="/#try-grindctrl">Test another workflow</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/implementation">Request implementation plan</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
