import { stageInstall } from '@/lib/easyorders/install';
import { boundedJson, json } from '@/lib/easyorders/http';
import { EasyOrdersError } from '@/lib/easyorders/types';
import { UnauthorizedError } from '@/lib/messenger/provisioning';
import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: unknown;
  try { body = await boundedJson(request, 8192); } catch { return json({ ok: false, error: 'invalid_request' }, 400); }
  const states = new URL(request.url).searchParams.getAll('state');
  if (states.length !== 1) return json({ ok: false, error: 'invalid_state' }, 400);
  try {
    // Stage only. Activation and the first product import happen when the
    // link's creator confirms on the dashboard return page.
    await stageInstall(states[0], body);
    return json({ ok: true });
  } catch (error) {
    if ((error instanceof EasyOrdersError && error.code === 'invalid_state')
      || error instanceof UnauthorizedError || error instanceof RoleNotAllowedError) {
      return json({ ok: false, error: 'invalid_state' }, 400);
    }
    return json({ ok: false, error: 'unavailable' }, 503);
  }
}
