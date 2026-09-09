import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { resolveTenant } from '@/lib/assistant/tenant';
import { getDistributedBudgetSummary } from '@/lib/assistant/distributed-budget';
import { store } from '@/lib/assistant/store-instance';
import { clientIp } from '@/lib/ratelimit';

const SESSION_COOKIE = 'gc_assistant_sid';

/**
 * GET /api/assistant/session
 * Resolves (or mints) the caller's tenant identity and reports their
 * current chat/voice budget so the UI can show it before they hit a wall.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  const existingSessionId = request.cookies.get(SESSION_COOKIE)?.value;

  const tenant = resolveTenant(userId, existingSessionId, clientIp(request));
  const budgets = await getDistributedBudgetSummary(store, tenant.tenantId, tenant.tier).catch(() => null);
  if (!budgets) return NextResponse.json(
    { error: 'unavailable', message: 'Service temporarily unavailable. Please try again shortly.' },
    { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
  );

  const response = NextResponse.json({
    tenantId: tenant.tenantId,
    authenticated: tenant.tier === 'auth',
    budgets,
  });

  if (tenant.newSessionId) {
    response.cookies.set(SESSION_COOKIE, tenant.newSessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
  }

  return response;
}
