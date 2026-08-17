'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { linkifyMessage } from '@/lib/assistant/linkify';
import type { DisplayMessage } from './use-assistant-chat';
import { useAssistantLocale } from './locale-provider';
import { VoiceMessagePlayer, VoiceReplyLoading } from './voice-message-player';

/** Renders a reply as plain text mixed with real, tappable links — a bare
 *  URL or /try-on sitting inert in the text (unclickable, easy to mistake
 *  for a broken/fake link) is exactly what linkifyMessage exists to fix. */
function MessageText({ text, onInternalNavigate }: { text: string; onInternalNavigate?: () => void }) {
  return (
    <>
      {linkifyMessage(text).map((segment, index) => {
        if (segment.type === 'text') return <React.Fragment key={index}>{segment.value}</React.Fragment>;
        // active: added because globals.css now zeroes out the browser's own
        // tap-highlight box sitewide (see its comment) — these links relied
        // on that default as their only tap feedback, so removing it without
        // a replacement would trade "ugly stuck highlight" for "nothing
        // visibly happens when tapped," on the exact elements this was meant
        // to fix.
        // break-all: a URL is one unbreakable "word" (no spaces) — without
        // it, a long link has nowhere to wrap and instead overflows the
        // 80%-width bubble outright (confirmed live: a booking link measured
        // 311px inside a 247px bubble, rendering 21px off the left edge of
        // the viewport). Matches this codebase's existing convention of
        // always pairing dir="ltr" with break-all for URL/identifier content
        // (see e.g. dashboard/intents-manager.tsx, overview-page-content.tsx).
        const linkClassName = 'underline underline-offset-2 hover:opacity-80 active:opacity-60 break-all';
        // A URL/path is always LTR content, but rendered plain inside an
        // Arabic (RTL) reply it's still subject to the surrounding paragraph's
        // bidi algorithm — punctuation like the slashes and dots in a URL are
        // direction-neutral, so their visual order can flip depending on what
        // sits next to them. `dir="ltr"` isolates the link as its own bidi run
        // (per the HTML spec's UA rendering rules for the dir attribute), so
        // it always reads left-to-right regardless of the paragraph around it.
        // Only applied when the visible label IS that URL/path — the label
        // can instead be arbitrary (e.g. Arabic) text when linkifyHtmlAnchors
        // unwraps a model-emitted <a href> with its own label, and forcing
        // ltr on genuinely RTL label text would be wrong.
        const dir = segment.label === segment.href ? 'ltr' : undefined;
        return segment.external ? (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            dir={dir}
            className={linkClassName}
          >
            {segment.label}
          </a>
        ) : (
          // onClick: this is a same-tab SPA navigation, but inside the
          // launcher it's rendered inside a fixed overlay Sheet that has no
          // idea navigation just happened — without this, the Sheet stayed
          // open on top of the very page the visitor just asked to go to,
          // so the destination was there but invisible behind it.
          <Link key={index} href={segment.href} dir={dir} className={linkClassName} onClick={onInternalNavigate}>
            {segment.label}
          </Link>
        );
      })}
    </>
  );
}

interface MessageListProps {
  messages: DisplayMessage[];
  thinking?: boolean;
  onSuggestionClick?: (text: string) => void;
  /** Passed straight through to reply links — see MessageText's onClick
   *  comment. Undefined on the standalone /assistant page, which has no
   *  overlay to close. */
  onInternalNavigate?: () => void;
}

/** Every message renders the same way regardless of whether it started as
 *  voice or text — the brief's "consistent" requirement — since by the
 *  time a message reaches here it's already just text (a transcript for
 *  voice input, the reply text for spoken output). */
export function MessageList({ messages, thinking, onSuggestionClick, onInternalNavigate }: MessageListProps) {
  const { t } = useAssistantLocale();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, thinking]);

  if (messages.length === 0 && !thinking) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">{t.emptyState}</p>
        {onSuggestionClick && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {t.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestionClick(suggestion)}
                className="rounded-full border bg-background px-3.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted active:bg-muted"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn('flex items-start gap-2.5', message.role === 'user' && 'flex-row-reverse')}
        >
          <div
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full',
              message.role === 'user' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
            )}
            aria-hidden="true"
          >
            {message.role === 'user' ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
          </div>
          <div
            className={cn(
              'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
              message.role === 'user'
                ? 'rounded-tr-sm bg-primary text-primary-foreground'
                : 'rounded-tl-sm bg-muted text-foreground',
            )}
          >
            <MessageText text={message.content || ' '} onInternalNavigate={onInternalNavigate} />
            {message.audio?.status === 'pending' && <VoiceReplyLoading />}
            {message.audio?.status === 'ready' && <VoiceMessagePlayer chunks={message.audio.chunks} />}
          </div>
        </div>
      ))}

      {thinking && (
        <div className="flex items-start gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Bot className="size-3.5" />
          </div>
          <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5">
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
            <span className="sr-only">{t.thinking}</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
