import { notFound } from 'next/navigation';
import { SceneClient } from './scene-client';
import {
  getChatMessages,
  getChatPayload,
  getConversations,
  getConversationThreads,
  getReportProps,
  getTryOnOverview,
  type DemoLocale,
} from './fixtures';

/* Dev-only capture rig for the homepage's "real product UI" screenshots
   (scripts/capture-visual-proof.mjs reads these pages). One scene per URL,
   at a fixed frame size, no page chrome — same trick as
   app/dev/store-chat-check/page.tsx, reusing the real shipping components
   with fixture props instead of a hand-built mock. Hidden outright in
   production. */

const FRAME_SIZE: Record<string, { width: number; height: number }> = {
  chat: { width: 380, height: 640 },
  inbox: { width: 1200, height: 740 },
  report: { width: 1200, height: 560 },
  'tryon-usage': { width: 1200, height: 720 },
};

export default async function VisualProofScenePage({
  params,
  searchParams,
}: {
  params: Promise<{ scene: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();

  const { scene } = await params;
  const size = FRAME_SIZE[scene];
  if (!size) notFound();

  const { locale: localeParam } = await searchParams;
  const locale: DemoLocale = localeParam === 'ar' ? 'ar' : 'en';

  return (
    <SceneClient
      scene={scene}
      locale={locale}
      width={size.width}
      height={size.height}
      chatPayload={getChatPayload()}
      chatMessages={getChatMessages(locale)}
      conversations={getConversations(locale)}
      threads={getConversationThreads(locale)}
      reportProps={getReportProps()}
      tryOnOverview={getTryOnOverview(locale)}
    />
  );
}
