import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { discardSignedOutInstall, readReturnState } from '@/lib/easyorders/activation';
import { EASYORDERS_RETURN_PATH, easyOrdersOrigin } from '@/lib/easyorders/install';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Where EasyOrders sends the browser that approved the install. Outside
   /dashboard so a signed-out visitor is not bounced to sign-in first: if the
   approving browser has no GRINDCTRL session, the key it approved is
   discarded before anyone can confirm it (lib/easyorders/activation.ts). */
export async function GET(request: Request) {
  const states = new URL(request.url).searchParams.getAll('state');
  const state = states.length === 1 ? states[0] : '';
  const target = new URL(EASYORDERS_RETURN_PATH, easyOrdersOrigin());
  target.searchParams.set('state', state);
  const claims = readReturnState(state);
  if (claims) {
    const { userId } = await auth();
    if (!userId) {
      try {
        await discardSignedOutInstall(claims);
      } catch {
        // Fail closed: never forward while a key that may not be the
        // creator's is still staged.
        return new NextResponse('Something went wrong. Please start the connection again from your dashboard.', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
    }
  }
  return NextResponse.redirect(target, 303);
}
