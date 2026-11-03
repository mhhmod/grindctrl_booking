'use client';

import * as React from 'react';
import { Skeleton } from '@mantine/core';
import { getStatesCopy } from '@/lib/dashboard/states-copy';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import classes from './skeletons.module.css';

/* The loading state of a v16 dashboard page (loading.tsx), in the shell's
   own shapes: Today's health strip, needs-you card and week tiles; the
   tabbed pages' badge, tabs, tiles and card; or a single card. */

export type V16SkeletonVariant = 'today' | 'tabs' | 'card';

function Block({ h, w, radius = 'card' }: { h: number; w?: number | string; radius?: string }) {
  return <Skeleton className={classes.skeleton} h={h} w={w} radius={radius} />;
}

export function V16PageSkeleton({ locale, variant }: { locale: SiteLocale; variant: V16SkeletonVariant }) {
  const copy = getStatesCopy(locale);
  return (
    <div className={classes.page} role="status" aria-busy="true">
      <span className={classes.visuallyHidden}>{copy.loading}</span>
      <div aria-hidden="true" className={classes.page}>
        {variant === 'today' && (
          <>
            <Block h={64} />
            <Block h={220} />
            <div className={classes.tiles}>
              <Block h={104} />
              <Block h={104} />
              <Block h={104} />
            </div>
          </>
        )}
        {variant === 'tabs' && (
          <>
            <div className={classes.row}>
              <Block h={28} w={168} radius="pill" />
              <Block h={20} w={240} radius="pill" />
            </div>
            <Block h={48} w={220} radius="pill" />
            <div className={classes.tiles}>
              <Block h={104} />
              <Block h={104} />
              <Block h={104} />
              <Block h={104} />
            </div>
            <Block h={260} />
          </>
        )}
        {variant === 'card' && (
          <>
            <Block h={32} w={220} radius="pill" />
            <Block h={200} />
            <Block h={200} />
          </>
        )}
      </div>
    </div>
  );
}
