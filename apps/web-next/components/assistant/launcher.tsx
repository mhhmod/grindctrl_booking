'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { AssistantClient } from '@/lib/assistant/client';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { ChatWindow } from './chat-window';
import { AssistantLocaleProvider } from './locale-provider';
import { useAssistantLocale } from './locale-provider';

/** The closed-state mark: a small chat bubble with three "typing" dots.
 *  Deliberately stays legible and unchanging on its own regardless of the
 *  ambient motion around it — every design round that let this mark
 *  compete with or dissolve into other motion read as unclear at a glance
 *  (see docs/launcher-concepts.html). This is what makes the button
 *  instantly read as "chat," not the motion around it. */
function ChatMark() {
  return (
    <span className="gc-launcher-chat-mark relative" aria-hidden="true">
      <span className="gc-launcher-typing-dot" />
      <span className="gc-launcher-typing-dot" />
      <span className="gc-launcher-typing-dot" />
      <span className="gc-launcher-chat-tail" />
    </span>
  );
}

/** The ambient "Motion DNA" layer: three broken flow-ribbons and two
 *  travelling particles whose curvature is distilled from GrindCTRL's own
 *  logo mark (public/brand/logo.svg), not a generic circle — the brand
 *  shows up structurally, in how the motion moves, instead of as a second
 *  literal icon competing with the chat bubble. Only rendered while closed:
 *  once the panel is open the visitor is already engaged, so the "come talk
 *  to us" motion has done its job. */
function LauncherMotionDna() {
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg className="gc-launcher-dna-svg absolute inset-0 size-full" viewBox="0 0 84 84">
        <path className="gc-launcher-dna-track gc-launcher-dna-track--a" d="M7 27 C13 8 36 8 54 18 C64 24 72 24 79 18" />
        <path className="gc-launcher-dna-track gc-launcher-dna-track--b" d="M5 46 C15 57 27 48 41 37 C56 25 67 20 79 27" />
        <path className="gc-launcher-dna-track gc-launcher-dna-track--c" d="M10 62 C28 76 55 73 70 57 C80 46 80 34 74 27" />
      </svg>
      <span className="gc-launcher-dna-particle gc-launcher-dna-particle--a" />
      <span className="gc-launcher-dna-particle gc-launcher-dna-particle--b" />
    </span>
  );
}

function LauncherButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  const { t } = useAssistantLocale();
  return (
    // 84px matches the DNA layer's own size, so it can just fill this box
    // with inset-0 instead of separately centering itself within it — one
    // less place for the two to drift apart. The button is centered inside
    // via transform, which lands its own edge at exactly 16px from the real
    // viewport corner (14px inset from an 84px box + this box's 2px offset),
    // matching the plain single-button layout this replaces pixel-for-pixel.
    <div className="fixed bottom-[2px] end-[2px] z-40 size-[84px]">
      {!open && <LauncherMotionDna />}
      <button
        type="button"
        onClick={onClick}
        aria-label={open ? t.launcherClose : t.launcherOpen}
        className="absolute left-1/2 top-1/2 z-10 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/10 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {open ? <X className="size-5" /> : <ChatMark />}
      </button>
    </div>
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
