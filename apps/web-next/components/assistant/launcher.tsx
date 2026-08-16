'use client';

import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { AssistantClient } from '@/lib/assistant/client';
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
 *  layout can't hand this component a function-bearing client prop. */
export function AssistantLauncher({ client }: { client?: AssistantClient }) {
  const [open, setOpen] = useState(false);

  return (
    <AssistantLocaleProvider>
      <LauncherButton open={open} onClick={() => setOpen((v) => !v)} />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-sm">
          <SheetHeader className="sr-only">
            <SheetTitle>GrindCTRL AI</SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 p-3">
            <ChatWindow client={client} className="w-full" />
          </div>
        </SheetContent>
      </Sheet>
    </AssistantLocaleProvider>
  );
}
