import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { refreshDueProducts } from '@/lib/messenger/products';

export const runtime = 'nodejs';
export const maxDuration = 240;

export async function POST(request: NextRequest) {
  const expected = process.env.MESSENGER_PRODUCTS_SECRET;
  const supplied = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  const a = Buffer.from(expected ?? ''), b = Buffer.from(supplied ?? '');
  const headers = { 'Cache-Control': 'no-store' };
  if (!expected || expected.length < 32 || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ ok: false }, { status: 401, headers });
  try { return NextResponse.json({ ok: true, ...await refreshDueProducts() }, { headers }); }
  catch { return NextResponse.json({ ok: false }, { status: 500, headers }); }
}
