import 'server-only';
import { findShopifyAppByClientId } from './app-registry';
import { currentShopifyClientId, verifySessionTokenResolved } from './session-token';

/** Each registration's configured application_url may end in /<clientId>.
 * The path chooses an initializer, never authorizes data; every API still
 * verifies the audience/signature. A supplied ID token must match the path. */
export function resolveEmbeddedClientId(pathClientId?: string, idToken?: string): string | null {
  const verified = idToken ? verifySessionTokenResolved(idToken) : null;
  if (idToken && !verified) return null;
  if (pathClientId) {
    if (!findShopifyAppByClientId(pathClientId)) return null;
    if (verified && verified.appClientId !== pathClientId) return null;
    return pathClientId;
  }
  return verified?.appClientId ?? currentShopifyClientId();
}
