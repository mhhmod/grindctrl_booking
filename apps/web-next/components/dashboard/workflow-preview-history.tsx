'use client';

import React, { useMemo, useSyncExternalStore } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LANDING_PREVIEW_STORAGE_KEY, readLandingPreviewHandoff } from '@/lib/trial/landing-preview-handoff';
import { getWorkflowsCopy } from '@/lib/dashboard/dashboard-content-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

function readPreviewSnapshot() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LANDING_PREVIEW_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function WorkflowPreviewHistory({ locale = 'en' }: { locale?: SiteLocale }) {
  const c = getWorkflowsCopy(locale);
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
        <CardTitle>{c.latestPreview}</CardTitle>
        <CardDescription>{c.latestPreviewDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {!preview ? (
          <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            {c.noPreview}
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{preview.mode}</Badge>
              <Badge variant="outline">{preview.workflowSlug}</Badge>
              <Badge variant="secondary">{c.confidence(preview.confidence)}</Badge>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3 text-sm text-foreground">{preview.summary}</div>
            <div className="rounded-xl border bg-muted/20 p-3 text-sm text-foreground">{c.recommendedAction(preview.recommendedAction)}</div>
            <p className="text-xs text-muted-foreground">{c.capturedAt(new Date(preview.createdAt).toLocaleString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US'))}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
