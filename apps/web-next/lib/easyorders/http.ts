import 'server-only';
import { readProviderBody } from '@/lib/provider-http';

export function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
export async function boundedJson(request: Request, limit: number): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('bad_content_type');
  if (Number(request.headers.get('content-length')) > limit) throw new Error('too_large');
  // The shared streaming reader enforces actual bytes, including chunked bodies.
  const response = new Response(request.body, { headers: request.headers });
  return JSON.parse((await readProviderBody(response, limit)).toString('utf8'));
}
