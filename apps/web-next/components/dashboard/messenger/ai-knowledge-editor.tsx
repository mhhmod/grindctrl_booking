'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from './textarea';
import { PillToggle } from './appearance-editor';
import { PreviewFrame } from './preview-frame';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import {
  addKnowledge,
  deleteKnowledge,
  saveDraftSection,
  syncKnowledge,
  updateKnowledgeStatus,
} from '@/app/dashboard/messenger/actions';
import type { AssistantTone, MessengerAi, MessengerLocale } from '@/lib/messenger/types';
import type { KnowledgeEntry } from '@/lib/messenger/knowledge';

/* AI & Knowledge: tone presets + one plain-language instructions field,
   plus the grounded knowledge list. No prompt engineering is exposed. */

const COPY = {
  en: {
    title: 'AI assistant',
    subtitle: 'Answers shoppers from your store knowledge — in English and Arabic.',
    enable: 'Let AI answer shoppers',
    name: 'Assistant name',
    tone: 'Tone',
    tones: { friendly: 'Friendly', professional: 'Professional', concise: 'Concise', warm: 'Warm' },
    instructions:
      'Anything the assistant should always know about how you support customers?',
    instructionsPh:
      'e.g. We ship from Riyadh in 1–3 days. Free returns within 14 days. Always offer size help politely.',
    language: 'Reply language',
    languages: { auto: 'Match shopper', en: 'English', ar: 'Arabic' },
    escalation: 'Offer a human when asked',
    knowledgeTitle: 'Knowledge',
    knowledgeSubtitle: 'The AI answers only from these facts. Add policies, shipping info, FAQs.',
    addManual: 'Add note',
    addUrl: 'Add by link',
    urlPh: 'https://yourstore.com/pages/shipping',
    titlePh: 'e.g. Shipping policy',
    contentPh: 'Paste or write the facts…',
    add: 'Add',
    adding: 'Adding…',
    active: 'Active',
    paused: 'Paused',
    pause: 'Pause',
    resume: 'Resume',
    remove: 'Delete',
    resync: 'Re-sync',
    empty: 'No knowledge yet — add your first policy or FAQ so the AI can answer accurately.',
  },
  ar: {
    title: 'مساعد الذكاء الاصطناعي',
    subtitle: 'يرد على العملاء من معرفة متجرك — بالعربية والإنجليزية.',
    enable: 'السماح للذكاء الاصطناعي بالرد',
    name: 'اسم المساعد',
    tone: 'الأسلوب',
    tones: { friendly: 'ودود', professional: 'مهني', concise: 'مختصر', warm: 'دافئ' },
    instructions: 'ما الذي يجب أن يعرفه المساعد دائماً عن دعم عملائك؟',
    instructionsPh: 'مثال: نشحن من الرياض خلال ١–٣ أيام. إرجاع مجاني خلال ١٤ يوماً.',
    language: 'لغة الردود',
    languages: { auto: 'حسب العميل', en: 'الإنجليزية', ar: 'العربية' },
    escalation: 'تحويل لموظف عند الطلب',
    knowledgeTitle: 'المعرفة',
    knowledgeSubtitle: 'يجيب المساعد من هذه المعلومات فقط. أضف السياسات والشيوخ والأسئلة الشائعة.',
    addManual: 'إضافة ملاحظة',
    addUrl: 'إضافة برابط',
    urlPh: 'https://yourstore.com/pages/shipping',
    titlePh: 'مثال: سياسة الشحن',
    contentPh: 'اكتب أو الصق المعلومات…',
    add: 'إضافة',
    adding: 'جارٍ الإضافة…',
    active: 'مفعّلة',
    paused: 'متوقفة',
    pause: 'إيقاف',
    resume: 'تفعيل',
    remove: 'حذف',
    resync: 'تحديث',
    empty: 'لا معرفة بعد — أضف أول سياسة أو سؤال شائع ليجيب المساعد بدقة.',
  },
};

export function AiKnowledgeEditor({
  locale,
  siteId,
  ai,
  knowledge,
  publishedPayload,
}: {
  locale: MessengerLocale;
  siteId: string;
  ai: MessengerAi;
  knowledge: KnowledgeEntry[];
  publishedPayload: PublicMessengerPayload;
}) {
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
  const [value, setValue] = useState<MessengerAi>(ai);
  const [pendingForm, startFormTransition] = useTransition();
  /* Outcome, not just text: an error rendered in success green reads as a
     save that worked. */
  const [savedNote, setSavedNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [mode, setMode] = useState<'manual' | 'url'>('manual');
  const [formPending, startForm] = useTransition();
  const [formNote, setFormNote] = useState<string | null>(null);

  function patch(partial: Partial<MessengerAi>) {
    setValue((prev) => ({ ...prev, ...partial }));
    setSavedNote(null);
  }

  const previewPayload = useMemo<PublicMessengerPayload>(
    () => ({ ...publishedPayload, aiEnabled: value.enabled && publishedPayload.aiEnabled !== undefined }),
    [publishedPayload, value.enabled],
  );

  function submitKnowledge(formData: FormData) {
    startForm(async () => {
      const result = await addKnowledge(formData);
      setFormNote(result.ok ? result.message ?? t.add : result.error);
    });
  }

  return (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="grid min-w-0 gap-5">
        <form
          className="grid gap-4 rounded-xl border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            startFormTransition(async () => {
              const result = await saveDraftSection(siteId, 'ai', value);
              setSavedNote(
                result.ok
                  ? { ok: true, text: locale === 'ar' ? 'تم حفظ المسودة' : 'Draft saved' }
                  : { ok: false, text: result.error },
              );
            });
          }}
        >
          <header>
            <h2 className="text-lg font-semibold tracking-tight">{t.title}</h2>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </header>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
              className="size-4 accent-primary"
            />
            {t.enable}
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t.tone}</Label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(t.tones) as AssistantTone[]).map((tone) => (
                  <PillToggle key={tone} active={value.tone === tone} onClick={() => patch({ tone })}>
                    {t.tones[tone]}
                  </PillToggle>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{t.language}</Label>
              <div className="flex flex-wrap gap-1.5">
                {(['auto', 'en', 'ar'] as const).map((mode2) => (
                  <PillToggle key={mode2} active={value.languageMode === mode2} onClick={() => patch({ languageMode: mode2 })}>
                    {t.languages[mode2]}
                  </PillToggle>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="instructions">{t.instructions}</Label>
            <Textarea
              id="instructions"
              rows={5}
              placeholder={t.instructionsPh}
              value={value.instructions}
              onChange={(e) => patch({ instructions: e.target.value })}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.escalationEnabled}
              onChange={(e) => patch({ escalationEnabled: e.target.checked })}
              className="size-4 accent-primary"
            />
            {t.escalation}
          </label>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pendingForm}>
              {pendingForm ? '…' : locale === 'ar' ? 'حفظ المسودة' : 'Save draft'}
            </Button>
            {savedNote && (
              <span
                role={savedNote.ok ? 'status' : 'alert'}
                className={`text-sm ${savedNote.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
              >
                {savedNote.text}
              </span>
            )}
          </div>
        </form>

        <section className="grid min-w-0 gap-3 rounded-xl border border-border p-4">
          <header>
            <h3 className="text-sm font-semibold">{t.knowledgeTitle}</h3>
            <p className="text-xs text-muted-foreground">{t.knowledgeSubtitle}</p>
          </header>

          <div className="flex flex-wrap items-center gap-2">
            <PillToggle active={mode === 'manual'} onClick={() => setMode('manual')}>
              {t.addManual}
            </PillToggle>
            <PillToggle active={mode === 'url'} onClick={() => setMode('url')}>
              {t.addUrl}
            </PillToggle>
          </div>

          <form action={submitKnowledge} className="grid gap-2">
            <input type="hidden" name="siteId" value={siteId} />
            {mode === 'manual' ? (
              <>
                <Input name="title" placeholder={t.titlePh} maxLength={200} required />
                <Textarea name="content" rows={4} placeholder={t.contentPh} maxLength={20000} required />
              </>
            ) : (
              <Input name="url" type="url" placeholder={t.urlPh} required />
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={formPending}>
                {formPending ? t.adding : t.add}
              </Button>
              {formNote && (
                <span role="status" className={`text-xs ${formNote.startsWith(locale === 'ar' ? 'أ' : '') || formNote.includes('added') || formNote.includes('Added') ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                  {formNote}
                </span>
              )}
            </div>
          </form>

          {knowledge.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            <ul className="grid gap-2">
              {knowledge.map((entry) => (
                <li key={entry.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{entry.content}</p>
                    </div>
                    <Badge variant={entry.status === 'active' ? 'default' : 'secondary'}>
                      {entry.status === 'active' ? t.active : t.paused}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <MiniAction
                      onClick={() => startForm(() => void updateKnowledgeStatus(siteId, entry.id, entry.status === 'active' ? 'disabled' : 'active').then(() => setFormNote(null)))}
                    >
                      {entry.status === 'active' ? t.pause : t.resume}
                    </MiniAction>
                    {entry.source === 'url' && entry.source_url && (
                      <MiniAction
                        onClick={() =>
                          startForm(async () => {
                            const r = await syncKnowledge(siteId, entry.id);
                            setFormNote(r.ok ? r.message ?? '' : r.error);
                          })
                        }
                      >
                        {t.resync}
                      </MiniAction>
                    )}
                    <MiniAction
                      destructive
                      onClick={() => startForm(() => void deleteKnowledge(siteId, entry.id))}
                    >
                      {t.remove}
                    </MiniAction>
                  </div>
                  {entry.source_url && (
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">{entry.source_url}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="xl:sticky xl:top-6">
        <PreviewFrame payload={{ ...previewPayload, behaviour: { ...publishedPayload.behaviour } }} initialLocale={locale} />
      </aside>
    </div>
  );
}

function MiniAction({
  children,
  onClick,
  destructive = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 ${
        destructive
          ? 'border-destructive/40 text-destructive hover:bg-destructive/10'
          : 'border-border hover:bg-accent'
      }`}
    >
      {children}
    </button>
  );
}
