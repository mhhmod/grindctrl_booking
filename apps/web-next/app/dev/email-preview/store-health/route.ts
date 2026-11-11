import { NextRequest } from 'next/server';
import { buildStoreHealthEmail } from '@/lib/email/store-health';
import { STORE_HEALTH_PROBLEMS } from '@/lib/store-health/problems';

export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 });
  const params = request.nextUrl.searchParams;
  const problem = STORE_HEALTH_PROBLEMS.find((key) => key === params.get('problem')) ?? 'code_gone';
  const locale = params.get('locale') === 'ar' ? 'ar' : 'en';
  const email = buildStoreHealthEmail({ problem, recovery: params.get('recovery') === '1', locale,
    storeName: locale === 'ar' ? 'أزياء لولو' : "Lulu's Fashion", address: 'lulus-fashion.myeasyorders.com', sinceDay: locale === 'ar' ? 'يوم الاثنين' : 'Monday' });
  const plain = params.get('format') === 'text';
  return new Response(plain ? email.text : email.html, { headers: { 'Content-Type': `${plain ? 'text/plain' : 'text/html'}; charset=utf-8`, 'Cache-Control': 'no-store' } });
}
