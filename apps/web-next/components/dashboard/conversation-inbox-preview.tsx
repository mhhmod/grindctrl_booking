import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CONVERSATION_PREVIEW_DATA, findConversationById, type ConversationPreviewItem } from '@/lib/dashboard/conversation-preview-data';

const STATUS_VARIANT: Record<ConversationPreviewItem['status'], 'default' | 'secondary' | 'outline'> = {
  New: 'default',
  'In progress': 'secondary',
  'Handoff needed': 'outline',
  Resolved: 'outline',
};

export function ConversationInboxPreview({
  selectedId,
  routeBase,
  title,
  description,
}: {
  selectedId?: string;
  routeBase: '/dashboard/conversations' | '/dashboard/messages';
  title: string;
  description: string;
}) {
  const selected = findConversationById(selectedId ?? '');

  return (
    <section className="grid gap-4">
      <Card>
        <CardHeader>
          <Badge variant="secondary" className="w-fit">Preview inbox</Badge>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description} Ready to connect.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversation list</CardTitle>
            <CardDescription>Website + social channels in one queue (preview data).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {CONVERSATION_PREVIEW_DATA.map((conversation) => {
              const isActive = conversation.id === selected.id;
              return (
                <article key={conversation.id} className="rounded-xl border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{conversation.customerName}</p>
                      <p className="text-xs text-muted-foreground">{conversation.company}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{conversation.channel}</Badge>
                      <Badge variant={STATUS_VARIANT[conversation.status]}>{conversation.status}</Badge>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{conversation.customerMessage}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{conversation.lastMessageAt}</p>
                    <Button asChild size="sm" variant={isActive ? 'default' : 'outline'}>
                      <Link href={`${routeBase}?conversation=${encodeURIComponent(conversation.id)}`}>Open preview</Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{selected.channel}</Badge>
              <Badge variant={STATUS_VARIANT[selected.status]}>{selected.status}</Badge>
            </div>
            <CardTitle className="text-base">Selected conversation preview</CardTitle>
            <CardDescription>{selected.customerName} • {selected.company}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Customer message</p>
              <p className="mt-1 text-sm text-foreground">{selected.customerMessage}</p>
            </div>

            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">AI suggested response</p>
              <p className="mt-1 text-sm text-foreground">{selected.aiSuggestedResponse}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">Detected intent</p>
                <p className="mt-1 text-sm text-foreground">{selected.detectedIntent}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">Lead score</p>
                <p className="mt-1 text-sm text-foreground">{selected.leadScore}/100</p>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Recommended action</p>
              <p className="mt-1 text-sm text-foreground">{selected.recommendedAction}</p>
            </div>

            <aside className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Lead/contact side panel</p>
              <dl className="mt-2 grid gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Contact</dt>
                  <dd className="text-foreground" dir="ltr">{selected.contact}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Handoff preview</dt>
                  <dd className="text-foreground">{selected.handoffPreviewReason}</dd>
                </div>
              </dl>
            </aside>

            <Button type="button" disabled aria-disabled="true">
              Handoff (Preview only)
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
