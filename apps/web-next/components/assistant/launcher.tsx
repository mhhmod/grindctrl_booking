'use client';

import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { AssistantClient } from '@/lib/assistant/client';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { ChatWindow } from './chat-window';
import { AssistantLocaleProvider } from './locale-provider';
import { useAssistantLocale } from './locale-provider';

function LauncherButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  const { t } = useAssistantLocale();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? t.launcherClose : t.launcherOpen}
      className="fixed bottom-4 end-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/10 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
    </button>
  );
}

/** Site-wide floating entry point — mounts the same ChatWindow used at
 *  /assistant, just inside an overlay sheet instead of a full page. `client`
 *  is optional for the same reason ChatWindow's is: a server-rendered
 *  layout can't hand this component a function-bearing client prop.
 *
 *  `initialLocale` matters more here than it looks: without it,
 *  AssistantLocaleProvider falls back to reading the locale cookie itself,
 *  which only works client-side — during SSR `document` is undefined, so
 *  the server always renders the English/LTR button. React's hydration
 *  diffing does NOT patch up a mismatched `dir`/`lang`/`aria-label` after
 *  the fact ("This won't be patched up", per its own warning), so on an
 *  Arabic page the site-wide launcher stayed stuck in English forever,
 *  not just for one frame. RootLayout already resolves the request locale
 *  server-side for the <html> tag, so it's passed straight through here
 *  instead of re-guessing it — the same pattern /assistant's own page
 *  already uses correctly. */
export function AssistantLauncher({ client, initialLocale }: { client?: AssistantClient; initialLocale?: SiteLocale }) {
  const [open, setOpen] = useState(false);

  return (
    <AssistantLocaleProvider initialLocale={initialLocale}>
      <LauncherButton open={open} onClick={() => setOpen((v) => !v)} />
      <Sheet open={open} onOpenChange={setOpen}>
        {/* Plain `w-full` here loses to the primitive's own baked-in
            `data-[side=right]:w-3/4` — same specificity bucket in
            tailwind-merge only dedupes utilities sharing the exact same
            variant prefix, so the override has to be written with that
            prefix too, or it's silently dropped. Confirmed live: without
            this, the sheet renders at 75% width on phones (281px of 375px)
            regardless of the plain w-full/sm:max-w-sm passed here.
            max-w-md (not the original max-w-sm) above the sm breakpoint:
            at 384px (max-w-sm) the header's controls still wrap to a
            second line even with the whole screen to spare on tablet/
            desktop — 448px is confirmed enough room for them to stay on
            one line there, while still reading as a compact side panel,
            not a full-bleed one. */}
        <SheetContent
          side="right"
          showCloseButton={false}
          className="flex w-full flex-col p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>GrindCTRL AI</SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 p-3">
            <ChatWindow client={client} className="w-full" onClose={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </AssistantLocaleProvider>
  );
}
