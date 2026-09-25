import * as React from 'react';

/* No approved Arabic exists for this label in the v15 copy or the repo, so it
   stays English (and says so with lang) on both pages until one is approved.
   Listed in the pull request. */
export function SkipLink({ targetId = 'main' }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      lang="en"
      className="fixed start-3 top-3 z-[60] -translate-y-24 rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background focus-visible:translate-y-0"
    >
      Skip to content
    </a>
  );
}
