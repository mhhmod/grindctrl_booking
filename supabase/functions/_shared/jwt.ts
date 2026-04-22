import { SignJWT, jwtVerify } from 'npm:jose@5.9.6';

export type EmbedTokenClaims = {
  widget_site_id: string;
  origin: string;
  scopes: string[];
};

function encoder() {
  return new TextEncoder();
}

export async function signEmbedToken(secret: string, claims: EmbedTokenClaims, expiresInSec: number): Promise<string> {
  const key = encoder().encode(secret);
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    widget_site_id: claims.widget_site_id,
    origin: claims.origin,
    scopes: claims.scopes
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSec)
    .sign(key);
}

export async function verifyEmbedToken(secret: string, token: string): Promise<EmbedTokenClaims> {
  const key = encoder().encode(secret);
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });

  const widget_site_id = String(payload.widget_site_id || '');
  const origin = String(payload.origin || '');
  const scopes = Array.isArray(payload.scopes) ? payload.scopes.map(String) : [];

  if (!widget_site_id || !origin) throw new Error('invalid_token');
  return { widget_site_id, origin, scopes };
}

export function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
