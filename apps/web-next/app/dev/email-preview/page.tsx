import { notFound } from 'next/navigation';
import { STORE_HEALTH_PROBLEMS } from '@/lib/store-health/problems';

/** Dev-only gallery alongside the existing Try-On campaign preview. */
export default async function EmailPreviewPage({ searchParams }: { searchParams: Promise<{ problem?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  const problem = STORE_HEALTH_PROBLEMS.find((key) => key === params.problem) ?? 'code_gone';
  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <h1>Store health emails</h1>
      <nav aria-label="Email problem" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {STORE_HEALTH_PROBLEMS.map((key) => <a key={key} href={`?problem=${key}`} aria-current={problem === key ? 'page' : undefined}>{key}</a>)}
        <a href="/dev/email-preview/tryon">Try-On campaign</a>
      </nav>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))', gap: 24 }}>
        {(['en', 'ar'] as const).flatMap((locale) => [false, true].map((recovery) => {
          const src = `/dev/email-preview/store-health?locale=${locale}&recovery=${recovery ? 1 : 0}&problem=${problem}`;
          const title = `${locale.toUpperCase()} ${recovery ? 'recovery' : 'problem'}`;
          return <section key={title}><h2>{title}</h2><p><a href={src}>Open email</a> · <a href={`${src}&format=text`}>Plain text</a></p><iframe title={title} src={src} style={{ width: '100%', height: 650, border: '1px solid #ccc' }} /></section>;
        }))}
      </div>
    </main>
  );
}
