'use client';

import { useEffect, useRef } from 'react';
import { MessengerPanel, type WireMessage } from '@/components/messenger/MessengerPanel';
import { ConversationsPanel, type ConversationListItem } from '@/components/dashboard/messenger/conversations-panel';
import { MessengerOverview } from '@/components/dashboard/messenger/overview';
import { TryOnOverviewView } from '@/components/dashboard/tryon-overview-view';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import type { FetchMessagesResult } from '@/lib/messenger/dashboard-actions-contract';
import type { TryOnOverview } from '@/lib/dashboard/overview-data';
import type { DemoLocale, ReportProps } from './fixtures';

/* Renders the real shipping components against fixture props. A client
   component because ConversationsPanel needs an `actions` object of real
   functions — a Server Component cannot hand a Client Component a function
   prop (only Server Actions cross that boundary), so the fixture DATA is
   computed server-side (page.tsx) and the no-op action closures are built
   here instead. */

const NOOP_ACTION = async () => ({ ok: true as const });

export interface SceneProps {
  scene: string;
  locale: DemoLocale;
  width: number;
  height: number;
  chatPayload: PublicMessengerPayload;
  chatMessages: WireMessage[];
  conversations: ConversationListItem[];
  threads: Record<string, FetchMessagesResult>;
  reportProps: ReportProps;
  tryOnOverview: TryOnOverview;
}

export function SceneClient({
  scene,
  locale,
  width,
  height,
  chatPayload,
  chatMessages,
  conversations,
  threads,
  reportProps,
  tryOnOverview,
}: SceneProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  // Only report/tryon-usage attach this — their content flows to whatever
  // height the real component naturally wants, which can run past the
  // scene's fixed frame height (a longer stat, Arabic text expansion, a
  // future data change). Scaling the whole block down to fit is a general
  // safeguard against that, instead of the frame's overflow-hidden silently
  // cropping real content out of the capture.
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Everything below is synchronous, in-memory fixture data — no real
    // network round trip to await — so a short fixed delay past two paints
    // is enough to guarantee every mount effect (panel bootstrap, the
    // inbox's own conversation fetch) has committed before the capture
    // script is allowed to screenshot.
    const timer = window.setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const content = contentRef.current;
          const frame = frameRef.current;
          if (content && frame) {
            content.style.transform = '';
            const scale = Math.min(1, frame.clientHeight / content.scrollHeight);
            // Width is deliberately left alone: the block already spans the
            // frame's full physical width regardless of `dir` (only the
            // inline content inside it is direction-aware), so scaling it
            // down in place — without also stretching its layout width —
            // shrinks toward one corner without re-flowing or mirroring
            // anything. Widening it to compensate broke RTL: a wider box
            // pushed its own start edge further in the writing direction,
            // which is the opposite corner from a fixed `top left` origin.
            if (scale < 1) {
              content.style.transform = `scale(${scale})`;
              content.style.transformOrigin = 'top left';
            }
          }
          frame?.setAttribute('data-capture', 'ready');
        });
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [scene, locale]);

  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <div
      id="frame"
      ref={frameRef}
      dir={dir}
      lang={locale}
      style={{ width, height }}
      className="relative overflow-hidden bg-background"
    >
      {scene === 'chat' && (
        <MessengerPanel
          config={chatPayload}
          variant="preview"
          locale={locale}
          previewMessages={chatMessages}
          previewStatus="handoff_requested"
        />
      )}

      {scene === 'inbox' && (
        <div className="h-full min-w-0 p-4">
          <ConversationsPanel
            locale={locale}
            siteId="demo-site"
            conversations={conversations}
            actions={{
              fetchConversationMessages: async (_siteId, conversationId) =>
                threads[conversationId] ?? { ok: false },
              staffReply: NOOP_ACTION,
              pingStaffTyping: NOOP_ACTION,
              addInternalNote: NOOP_ACTION,
              takeoverConversation: NOOP_ACTION,
              assignConversationAction: NOOP_ACTION,
              releaseConversation: NOOP_ACTION,
              closeConversationAction: NOOP_ACTION,
              markConversationRead: NOOP_ACTION,
            }}
          />
        </div>
      )}

      {scene === 'report' && (
        <div ref={contentRef} className="min-w-0 p-6">
          <MessengerOverview locale={locale} {...reportProps} />
        </div>
      )}

      {scene === 'tryon-usage' && (
        <div ref={contentRef} className="min-w-0 p-6">
          <TryOnOverviewView overview={tryOnOverview} locale={locale} />
        </div>
      )}
    </div>
  );
}
