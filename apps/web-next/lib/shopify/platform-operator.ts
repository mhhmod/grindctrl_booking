import 'server-only';
import { auth } from '@clerk/nextjs/server';

export class PlatformOperatorRequiredError extends Error {
  constructor() { super('This action requires a platform operator.'); }
}

async function resolveTryOnPlatformOperator(): Promise<string | null> {
  const { userId } = await auth();
  const operators = (process.env.TRYON_PLATFORM_OPERATOR_CLERK_IDS ?? '')
    .split(',').map((id) => id.trim()).filter(Boolean);
  return userId && operators.includes(userId) ? userId : null;
}

/** Server-derived presentation permission only. Mutations must still call
 * requireTryOnPlatformOperator and independently verify shop ownership. */
export async function isTryOnPlatformOperator(): Promise<boolean> {
  try {
    return Boolean(await resolveTryOnPlatformOperator());
  } catch {
    return false;
  }
}

/** Manual grants are not merchant billing. A shop owner must never turn a
 * form submission into self-issued paid credits. No configured operator
 * means no manual grants; IDs must be explicitly configured server-side. */
export async function requireTryOnPlatformOperator(): Promise<string> {
  const userId = await resolveTryOnPlatformOperator();
  if (!userId) throw new PlatformOperatorRequiredError();
  return userId;
}
