import 'server-only';
import { promises as dns } from 'node:dns';
import https from 'node:https';
import { isIP } from 'node:net';
import type { Readable } from 'node:stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import { isNonPublicAddress } from '@/lib/woo/public-address';
import { liquidMacMatches } from './signing';
import { PasteError, type PasteConnection, type PasteShopCheckOutcome } from './types';

/* Proof of theme control for a pending Shopify paste shop. Our server
   fetches the shop's own storefront and looks for this site's snippet
   output: the rendered <script data-gc-site="SITE" data-gc-shop="SHOP" ...>
   tag, signed with this site's Liquid secret for this shop. Only the shop's
   theme can put that tag on that storefront, so a site owner who merely
   signs a render naming someone else's shop can never produce it.

   The fetch is SSRF-hardened like the garment and meta-proof transports:
   HTTPS on 443 only, no credentials, every resolved address public and the
   socket pinned to the checked address, strict timeouts, a small body cap
   and a few redirects, only between the shop's myshopify host and the
   primary domain that host itself redirects to. */

export const STOREFRONT_MAX_BODY_BYTES = 2 * 1024 * 1024;
export const STOREFRONT_MAX_REDIRECTS = 4;
export const STOREFRONT_REQUEST_TIMEOUT_MS = 5_000;
export const STOREFRONT_TOTAL_TIMEOUT_MS = 12_000;
const DNS_TIMEOUT_MS = 3_000;
const MAX_TAGS = 32;
const MAX_COOKIES_PER_HOST = 32;
const MAX_COOKIE_BYTES = 4096;
const MAX_FORM_FIELDS = 16;
const USER_AGENT = 'GRINDCTRL-StoreCheck/1 (+https://grindctrl.cloud)';

declare const evidenceBrand: unique symbol;
/** Produced only here, from this site's signed snippet found on the shop's
 *  own storefront by our server. provePasteShop requires it. */
export type StorefrontEvidence = { readonly [evidenceBrand]: true; readonly siteId: string; readonly shopDomain: string };

/** How long a storefront finding (`awaiting_visit`) stays usable. */
export const STOREFRONT_FINDING_TTL_SECONDS = 15 * 60;

/** Our server found this site's snippet on the storefront at most
 *  STOREFRONT_FINDING_TTL_SECONDS ago (stored as `awaiting_visit`, possibly
 *  behind the storefront password): a signed render arriving now completes
 *  the proof without fetching again. */
export function recordedStorefrontEvidence(connection: PasteConnection, nowMs: number): StorefrontEvidence | null {
  const at = connection.shop_checked_at ? Date.parse(connection.shop_checked_at) : NaN;
  if (connection.platform !== 'shopify' || !connection.shop_domain || connection.shop_check_outcome !== 'awaiting_visit'
    || !Number.isFinite(at) || at > nowMs + 60_000 || nowMs - at > STOREFRONT_FINDING_TTL_SECONDS * 1000) return null;
  return { siteId: connection.widget_site_id, shopDomain: connection.shop_domain } as StorefrontEvidence;
}

export type StorefrontScanOutcome =Exclude<PasteShopCheckOutcome, 'proven' | 'awaiting_visit'>;
/** Why a check was `unreachable`, for logs only. */
export type StorefrontFailure = 'bad_url' | 'dns' | 'private_address' | 'foreign_redirect' | 'bad_redirect' | 'too_many_redirects'
  | 'status' | 'not_html' | 'too_large' | 'timeout' | 'network' | 'password_form';
export type StorefrontScan =
  | {
    outcome: 'found'; evidence: StorefrontEvidence; host: string;
    /** A product page linked from the page the code was found on, for the
     *  dashboard's "open a product page" link; null when none is linked. */
    productUrl: string | null;
    /** The storefront answered with its password page first. */
    passwordPage: boolean;
  }
  | { outcome: StorefrontScanOutcome; failure?: StorefrontFailure };

export type StorefrontRequest = {
  url: URL; address: string; family: 4 | 6; method: 'GET' | 'POST';
  headers: Record<string, string>; body?: string; signal: AbortSignal;
  /** Read at most this many decoded bytes and stop, keeping what was read,
   *  instead of refusing a body over STOREFRONT_MAX_BODY_BYTES. */
  truncateAt?: number;
};
export type StorefrontResponse = {
  status: number; location: string | null; contentType: string; setCookie: string[]; body: Buffer;
  /** Only FINGERPRINT_HEADERS, lowercased and capped. */
  headers?: Record<string, string>;
};
/** Response headers a platform fingerprint may use (platform-detect.ts). */
const FINGERPRINT_HEADERS = ['server', 'x-powered-by', 'powered-by', 'x-wix-request-id', 'x-shopid', 'x-shopify-stage'];
/** Resolves with the response, or rejects (timeout, network, oversize). */
export type StorefrontTransport = (request: StorefrontRequest) => Promise<StorefrontResponse>;
export type StorefrontLookup = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

export class StorefrontTooLargeError extends Error {
  constructor() { super('storefront_too_large'); this.name = 'StorefrontTooLargeError'; }
}

class ScanStop extends Error {
  constructor(readonly failure: StorefrontFailure, readonly status?: number) { super(failure); this.name = 'ScanStop'; }
}

const defaultLookup: StorefrontLookup = (hostname) => dns.lookup(hostname, { all: true, verbatim: true });

/** Reads at most `max` bytes, rejecting as soon as the stream exceeds it. */
export async function readCapped(stream: Readable, max: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += buffer.length;
    if (total > max) { stream.destroy(); throw new StorefrontTooLargeError(); }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

/** Reads the first `max` bytes and stops the stream there. */
export async function readPrefix(stream: Readable, max: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    const room = max - total;
    chunks.push(buffer.length > room ? buffer.subarray(0, room) : buffer);
    total += Math.min(buffer.length, room);
    if (total >= max) break;
  }
  stream.destroy();
  return Buffer.concat(chunks);
}

/** HTTPS to a pre-checked address. The TLS name stays the URL host, the
 *  socket goes only to `address`, nothing is followed automatically and
 *  the decoded body is capped. Errors never include the request body. */
export const pinnedStorefrontTransport: StorefrontTransport = (input) => new Promise((resolve, reject) => {
  const request = https.request({
    protocol: 'https:', hostname: input.url.hostname, servername: input.url.hostname, port: 443,
    path: `${input.url.pathname}${input.url.search}`, method: input.method, agent: false,
    headers: { ...input.headers, 'accept-encoding': 'gzip, deflate, br' },
    timeout: STOREFRONT_REQUEST_TIMEOUT_MS, signal: input.signal,
    lookup: (_host, options, callback) => {
      if ((options as { all?: boolean }).all) {
        (callback as unknown as (error: null, addresses: unknown) => void)(null, [{ address: input.address, family: input.family }]);
      } else {
        callback(null, input.address, input.family);
      }
    },
  }, (response) => {
    const status = response.statusCode ?? 0;
    const header = (name: string) => { const value = response.headers[name]; return Array.isArray(value) ? value[0] : value; };
    const meta = {
      status, location: header('location') ?? null,
      contentType: String(header('content-type') ?? '').split(';')[0].trim().toLowerCase(),
      setCookie: response.headers['set-cookie'] ?? [],
      headers: Object.fromEntries(FINGERPRINT_HEADERS.flatMap((name) => {
        const value = header(name);
        return value ? [[name, String(value).slice(0, 256)]] : [];
      })),
    };
    if (status >= 300 && status < 400) { response.resume(); resolve({ ...meta, body: Buffer.alloc(0) }); return; }
    if (!input.truncateAt && Number(header('content-length')) > STOREFRONT_MAX_BODY_BYTES) { request.destroy(); reject(new StorefrontTooLargeError()); return; }
    const encoding = String(header('content-encoding') ?? 'identity').trim().toLowerCase();
    const decoder = encoding === 'gzip' || encoding === 'x-gzip' ? createGunzip() : encoding === 'br' ? createBrotliDecompress()
      : encoding === 'deflate' ? createInflate() : null;
    if (!decoder && encoding !== 'identity' && encoding !== '') { request.destroy(); reject(new Error('storefront_encoding')); return; }
    const source: Readable = decoder ? response.pipe(decoder) : response;
    if (decoder) response.once('error', (error) => decoder.destroy(error));
    const read = input.truncateAt
      ? readPrefix(source, Math.min(input.truncateAt, STOREFRONT_MAX_BODY_BYTES)).finally(() => request.destroy())
      : readCapped(source, STOREFRONT_MAX_BODY_BYTES);
    read.then((body) => resolve({ ...meta, body }), (error) => {
      request.destroy(); reject(error);
    });
  });
  request.on('timeout', () => request.destroy(new Error('storefront_timeout')));
  request.on('error', reject);
  request.end(input.body);
});

/** Shape rules every hop must pass. */
function safeUrl(url: URL): boolean {
  const host = url.hostname;
  return url.protocol === 'https:' && !url.port && !url.username && !url.password
    && host.length <= 253 && host.includes('.') && !host.endsWith('.') && isIP(host.replace(/^\[|\]$/g, '')) === 0;
}

async function resolvePublic(host: string, lookup: StorefrontLookup): Promise<{ address: string; family: 4 | 6 }> {
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await Promise.race([
      lookup(host),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), DNS_TIMEOUT_MS).unref()),
    ]);
  } catch { throw new ScanStop('dns'); }
  if (!addresses.length) throw new ScanStop('dns');
  // One private answer taints the host: a mixed set is a rebinding setup.
  if (addresses.some((entry) => isNonPublicAddress(entry.address))) throw new ScanStop('private_address');
  return { address: addresses[0].address, family: addresses[0].family === 6 ? 6 : 4 };
}

/** Attributes of one start tag; null when a name repeats (parsers disagree
 *  on which copy wins, so such a tag never counts). */
function parseAttributes(source: string): Map<string, string> | null {
  const attrs = new Map<string, string>();
  for (const match of source.matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const name = match[1].toLowerCase();
    if (attrs.has(name)) return null;
    attrs.set(name, match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attrs;
}

// Elements whose content is text, not markup: a tag spelled inside them
// (a JSON blob, a review, a noscript fallback) is never a rendered tag.
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'noscript', 'iframe', 'noembed', 'noframes', 'template']);
// Quoted values cannot contain < or >, which bounds every match attempt.
const START_TAG = /<!--|<([a-zA-Z][a-zA-Z0-9-]*)((?:[^"'<>]|"[^"<>]*"|'[^'<>]*')*)>/g;

type StartTag = { name: string; attrs: Map<string, string> };

/** Start tags of real elements, skipping comments and raw-text content. */
function startTags(html: string): StartTag[] {
  const tags: StartTag[] = [];
  const pattern = new RegExp(START_TAG.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    if (match[0] === '<!--') {
      const end = html.indexOf('-->', match.index + 4);
      if (end < 0) break;
      pattern.lastIndex = end + 3;
      continue;
    }
    const name = match[1].toLowerCase();
    const attrs = parseAttributes(match[2]);
    if (attrs) tags.push({ name, attrs });
    if (RAW_TEXT.has(name)) {
      const close = new RegExp(`</${name}\\s*>`, 'gi');
      close.lastIndex = pattern.lastIndex;
      const end = close.exec(html);
      if (!end) break;
      pattern.lastIndex = end.index + end[0].length;
    }
  }
  return tags;
}

/** The rendered paste snippet tags on a page, at most MAX_TAGS of them. */
export function findPasteTags(html: string): Array<Map<string, string>> {
  return startTags(html)
    .filter((tag) => tag.name === 'script' && tag.attrs.get('data-gc-install') === 'paste' && tag.attrs.get('data-gc-platform') === 'shopify')
    .slice(0, MAX_TAGS).map((tag) => tag.attrs);
}

export type PasswordForm = { action: string; fields: Array<[string, string]>; passwordField: string };

/** Shopify's storefront password page. Older themes mark it with a hidden
 *  form_type=storefront_password; current ones (Dawn, 2026) only POST a
 *  password box to /password, so either signal counts. Its hidden fields
 *  are replayed with the password. */
export function findPasswordForm(html: string): PasswordForm | null {
  // The bounded body keeps a page full of unclosed forms linear.
  for (const form of html.matchAll(/<form\b((?:[^"'<>]|"[^"<>]*"|'[^'<>]*')*)>([\s\S]{0,65536}?)<\/form\s*>/gi)) {
    const formAttrs = parseAttributes(form[1]);
    if (!formAttrs) continue;
    const fields: Array<[string, string]> = [];
    let passwordField: string | null = null;
    let storefrontPassword = false;
    for (const input of form[2].matchAll(/<input\b((?:[^"'<>]|"[^"<>]*"|'[^'<>]*')*)>/gi)) {
      const attrs = parseAttributes(input[1]);
      const name = attrs?.get('name');
      if (!attrs || !name || name.length > 128) continue;
      const type = (attrs.get('type') ?? 'text').toLowerCase();
      if (type === 'password') { passwordField ??= name; continue; }
      if (type !== 'hidden') continue;
      const value = attrs.get('value') ?? '';
      if (name === 'form_type' && value === 'storefront_password') storefrontPassword = true;
      if (fields.length < MAX_FORM_FIELDS && value.length <= 512) fields.push([name, value]);
    }
    const action = formAttrs.get('action') ?? '';
    const postsToPassword = /^(?:https:\/\/[^/]+)?\/password\/?(?:[?#].*)?$/i.test(action)
      && (formAttrs.get('method') ?? '').toLowerCase() === 'post' && passwordField !== null;
    if (storefrontPassword || postsToPassword) return { action: action || '/password', fields, passwordField: passwordField ?? 'password' };
  }
  return null;
}

/** The first product page this storefront page links to on its own host,
 *  as `https://host/products/handle`. Only a plain handle is kept, so the
 *  dashboard link can never point anywhere but that storefront. */
export function findProductLink(html: string, host: string): string | null {
  const base = `https://${host}/`;
  for (const tag of startTags(html)) {
    if (tag.name !== 'a') continue;
    const href = tag.attrs.get('href') ?? '';
    if (!href || href.length > 2048 || !URL.canParse(href, base)) continue;
    const url = new URL(href, base);
    const handle = /^(?:\/[A-Za-z]{2}(?:-[A-Za-z]{2,4})?)?(?:\/collections\/[^/]+)?\/products\/([A-Za-z0-9%._~-]{1,255})\/?$/.exec(url.pathname)?.[1];
    if (url.protocol === 'https:' && url.hostname === host && !url.port && handle) return `${base}products/${handle}`;
  }
  return null;
}

type TagVerdict = 'found' | 'outdated_code' | 'wrong_site' | 'not_found';

/** `found` only for a tag naming this site and this shop whose MAC verifies
 *  with this site's current (or overlapping previous) Liquid secret. */
export function classifyTags(connection: PasteConnection, tags: Array<Map<string, string>>, nowSeconds: number): TagVerdict {
  const mine = tags.filter((tag) => tag.get('data-gc-site') === connection.widget_site_id);
  for (const tag of mine) {
    const claims = {
      siteId: connection.widget_site_id, shopDomain: tag.get('data-gc-shop') ?? '',
      // Empty outside a product page: Liquid renders a nil product as ''.
      productId: tag.get('data-gc-product') ?? '', variantId: tag.get('data-gc-variant') ?? '',
      issuedAt: tag.get('data-gc-issued-at') ?? '', customerId: tag.get('data-gc-customer') ?? '',
    };
    if (claims.shopDomain !== connection.shop_domain || !/^\d{1,12}$/.test(claims.issuedAt)
      || ![claims.productId, claims.variantId, claims.customerId].every((id) => /^(?:[1-9]\d{0,19})?$/.test(id))) continue;
    const matched = liquidMacMatches(connection, claims, tag.get('data-gc-signature') ?? '', nowSeconds);
    if (matched === null) throw new PasteError('unavailable');
    if (matched) return 'found';
  }
  if (mine.length) return 'outdated_code';
  return tags.length ? 'wrong_site' : 'not_found';
}

class CookieJar {
  private readonly hosts = new Map<string, Map<string, string>>();
  store(host: string, headers: string[]): void {
    const jar = this.hosts.get(host) ?? new Map<string, string>();
    for (const header of headers) {
      const pair = header.split(';', 1)[0];
      const index = pair.indexOf('=');
      if (index < 1 || pair.length > MAX_COOKIE_BYTES) continue;
      const name = pair.slice(0, index).trim();
      if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)) continue;
      if (!jar.has(name) && jar.size >= MAX_COOKIES_PER_HOST) continue;
      jar.set(name, pair.slice(index + 1).trim());
    }
    this.hosts.set(host, jar);
  }
  header(host: string): string | null {
    const jar = this.hosts.get(host);
    return jar?.size ? [...jar].map(([name, value]) => `${name}=${value}`).join('; ') : null;
  }
}

function twin(host: string): string { return host.startsWith('www.') ? host.slice(4) : `www.${host}`; }

export type StorefrontPage = { url: string; html: string; headers: Record<string, string> };

/** GETs a trusted website domain's home page for the platform fingerprint,
 *  through the same pinned, capped transport as the shop scan. The URL is
 *  built from the stored domain, never taken from a caller, and redirects
 *  may only move between the domain and its www twin. No cookies or
 *  credentials are sent. */
export async function fetchStorefrontPage(domain: string, options: {
  transport?: StorefrontTransport; lookup?: StorefrontLookup;
} = {}): Promise<StorefrontPage | { failure: StorefrontFailure }> {
  const transport = options.transport ?? pinnedStorefrontTransport;
  const lookup = options.lookup ?? defaultLookup;
  const signal = AbortSignal.timeout(STOREFRONT_TOTAL_TIMEOUT_MS);
  const allowed = new Set([domain, twin(domain)]);
  let url = new URL(`https://${domain}/`);
  try {
    if (!safeUrl(url)) throw new ScanStop('bad_redirect');
    for (let redirects = 0; ; redirects++) {
      const target = await resolvePublic(url.hostname, lookup);
      let response: StorefrontResponse;
      try {
        response = await transport({ url, ...target, method: 'GET', signal,
          headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en' } });
      } catch (error) {
        throw new ScanStop(error instanceof StorefrontTooLargeError ? 'too_large' : signal.aborted
          || (error instanceof Error && /timeout|abort/i.test(error.message + error.name)) ? 'timeout' : 'network');
      }
      if (response.status >= 300 && response.status < 400) {
        if (redirects >= STOREFRONT_MAX_REDIRECTS) throw new ScanStop('too_many_redirects');
        if (!response.location || response.location.length > 2048 || !URL.canParse(response.location, url)) throw new ScanStop('bad_redirect');
        const next = new URL(response.location, url);
        if (!safeUrl(next)) throw new ScanStop('bad_redirect');
        if (!allowed.has(next.hostname)) throw new ScanStop('foreign_redirect');
        url = next;
        continue;
      }
      if (response.status !== 200) throw new ScanStop('status');
      if (response.body.length > STOREFRONT_MAX_BODY_BYTES) throw new ScanStop('too_large');
      if (response.contentType !== 'text/html') throw new ScanStop('not_html');
      return { url: url.toString(), html: response.body.toString('utf8'), headers: response.headers ?? {} };
    }
  } catch (error) {
    return { failure: error instanceof ScanStop ? error.failure : 'network' };
  }
}

export type PublicPage = { url: string; contentType: string; body: Buffer; /** 2xx, or one of `passStatuses`. */ status: number };

function withAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new ScanStop('timeout'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

/** GETs a merchant-supplied https page (a Store Chat knowledge URL) through
 *  the same pinned transport: every hop's host resolved and refused if any
 *  answer is non-public, the socket held to the checked address, redirects
 *  to any public host (each one checked again), no cookies or credentials,
 *  and the decoded body cut at `maxBytes` rather than read whole.
 *  `passStatuses`: non-2xx answers the caller wants to read rather than have
 *  reported as a failure. A Shopify store behind its password serves that
 *  page with 401 or 403 as well as 200 (scanShopStorefront reads all three),
 *  and a caller that only saw "failed" could not tell it from an outage. */
export async function fetchPublicPage(raw: string, options: {
  maxBytes: number; accept: string; transport?: StorefrontTransport; lookup?: StorefrontLookup;
  timeoutMs?: number; allowedHost?: (hostname: string) => boolean; passStatuses?: readonly number[];
}): Promise<PublicPage | { failure: StorefrontFailure; /** The HTTP status, for failure 'status'. */ status?: number }> {
  const transport = options.transport ?? pinnedStorefrontTransport;
  const lookup = options.lookup ?? defaultLookup;
  const signal = AbortSignal.timeout(options.timeoutMs ?? STOREFRONT_TOTAL_TIMEOUT_MS);
  try {
    if (raw.length > 2048 || !URL.canParse(raw)) throw new ScanStop('bad_url');
    let url = new URL(raw);
    if (!safeUrl(url)) throw new ScanStop('bad_url');
    for (let redirects = 0; ; redirects++) {
      if (signal.aborted) throw new ScanStop('timeout');
      if (options.allowedHost && !options.allowedHost(url.hostname)) throw new ScanStop('foreign_redirect');
      const target = await withAbort(resolvePublic(url.hostname, lookup), signal);
      let response: StorefrontResponse;
      try {
        if (signal.aborted) throw new ScanStop('timeout');
        response = await withAbort(transport({ url, ...target, method: 'GET', signal, truncateAt: options.maxBytes,
          headers: { 'user-agent': USER_AGENT, accept: options.accept, 'accept-language': 'en' } }), signal);
      } catch (error) {
        throw new ScanStop(signal.aborted || (error instanceof Error && /timeout|abort/i.test(error.message + error.name)) ? 'timeout' : 'network');
      }
      if (response.status >= 300 && response.status < 400) {
        if (redirects >= STOREFRONT_MAX_REDIRECTS) throw new ScanStop('too_many_redirects');
        if (!response.location || response.location.length > 2048 || !URL.canParse(response.location, url)) throw new ScanStop('bad_redirect');
        const next = new URL(response.location, url);
        if (!safeUrl(next)) throw new ScanStop('bad_redirect');
        url = next;
        continue;
      }
      if ((response.status < 200 || response.status > 299) && !options.passStatuses?.includes(response.status)) {
        throw new ScanStop('status', response.status);
      }
      return { url: url.toString(), contentType: response.contentType, body: response.body.subarray(0, options.maxBytes), status: response.status };
    }
  } catch (error) {
    if (!(error instanceof ScanStop)) return { failure: 'network' };
    return error.status ? { failure: error.failure, status: error.status } : { failure: error.failure };
  }
}

declare const domainEvidenceBrand: unique symbol;
/** Produced only by scanDomainSnippet, from this site's snippet found on the
 *  domain's own home page by our server. verifyPasteDomain requires it. */
export type DomainSnippetEvidence = { readonly [domainEvidenceBrand]: true; readonly siteId: string; readonly domainId: string };

/** Hosts our loader is served from: production, and this deployment's own. */
function loaderHosts(): Set<string> {
  const hosts = new Set(['grindctrl.cloud']);
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (app && URL.canParse(app)) hosts.add(new URL(app).hostname.toLowerCase());
  return hosts;
}

/** Whether the page carries this site's snippet: a real script element
 *  loading our messenger.js over HTTPS with this site's embed key. Tags
 *  inside comments, JSON, templates or escaped text never count. */
export function findSiteSnippet(html: string, embedKey: string): 'found' | 'wrong_site' | 'not_found' {
  const hosts = loaderHosts();
  const loaders = startTags(html).filter((tag) => {
    if (tag.name !== 'script') return false;
    const src = tag.attrs.get('src') ?? '';
    if (!URL.canParse(src)) return false;
    const url = new URL(src);
    return url.protocol === 'https:' && !url.port && hosts.has(url.hostname.toLowerCase()) && url.pathname === '/widget/v1/messenger.js';
  }).slice(0, MAX_TAGS);
  if (loaders.some((tag) => tag.attrs.get('data-key') === embedKey)) return 'found';
  return loaders.length ? 'wrong_site' : 'not_found';
}

export type DomainSnippetScan =
  | { outcome: 'verified'; evidence: DomainSnippetEvidence; page: StorefrontPage }
  | { outcome: 'not_found' | 'wrong_site' | 'unreachable'; failure?: StorefrontFailure };

/** Fetches a paste domain's home page (fetchStorefrontPage: pinned public
 *  address, HTTPS only, capped body, redirects only to the www twin) and
 *  looks for this site's snippet. The URL is built from the stored domain,
 *  never from a caller. */
export async function scanDomainSnippet(site: { id: string; embedKey: string }, domain: { id: string; domain: string }, options: {
  transport?: StorefrontTransport; lookup?: StorefrontLookup;
} = {}): Promise<DomainSnippetScan> {
  const page = await fetchStorefrontPage(domain.domain, options);
  if ('failure' in page) return { outcome: 'unreachable', failure: page.failure };
  const found = findSiteSnippet(page.html, site.embedKey);
  if (found !== 'found') return { outcome: found };
  return { outcome: 'verified', page, evidence: { siteId: site.id, domainId: domain.id } as DomainSnippetEvidence };
}

/** Fetches the pending shop's storefront and reports what it shows for
 *  this site. Never throws for storefront behavior; throws PasteError only
 *  when our own signing configuration is unavailable. The password, when
 *  given, is sent once to the shop's own /password form and nowhere else,
 *  and appears in no result, log or error. */
export async function scanShopStorefront(connection: PasteConnection, options: {
  password?: string; transport?: StorefrontTransport; lookup?: StorefrontLookup; nowSeconds?: number;
} = {}): Promise<StorefrontScan> {
  const shop = connection.shop_domain;
  if (connection.platform !== 'shopify' || !shop) return { outcome: 'not_found' };
  const transport = options.transport ?? pinnedStorefrontTransport;
  const lookup = options.lookup ?? defaultLookup;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const signal = AbortSignal.timeout(STOREFRONT_TOTAL_TIMEOUT_MS);
  const allowed = new Set([shop]);
  let primary: string | null = null;
  const jar = new CookieJar();
  let url = new URL(`https://${shop}/`);
  let method: 'GET' | 'POST' = 'GET';
  let body: string | undefined;
  let passwordSent = false;
  let redirects = 0;
  try {
    // Every request (redirect hops and the one password post) is bounded.
    for (let requests = 0; requests < STOREFRONT_MAX_REDIRECTS + 3; requests++) {
      const target = await resolvePublic(url.hostname, lookup);
      const headers: Record<string, string> = { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en' };
      const cookie = jar.header(url.hostname);
      if (cookie) headers.cookie = cookie;
      if (method === 'POST') {
        Object.assign(headers, { 'content-type': 'application/x-www-form-urlencoded', origin: url.origin, referer: `${url.origin}/password` });
      }
      let response: StorefrontResponse;
      try {
        response = await transport({ url, ...target, method, headers, body, signal });
      } catch (error) {
        throw new ScanStop(error instanceof StorefrontTooLargeError ? 'too_large' : signal.aborted
          || (error instanceof Error && /timeout|abort/i.test(error.message + error.name)) ? 'timeout' : 'network');
      }
      jar.store(url.hostname, response.setCookie);
      method = 'GET'; body = undefined;
      if (response.status >= 300 && response.status < 400) {
        if (++redirects > STOREFRONT_MAX_REDIRECTS) throw new ScanStop('too_many_redirects');
        if (!response.location || response.location.length > 2048 || !URL.canParse(response.location, url)) throw new ScanStop('bad_redirect');
        const next = new URL(response.location, url);
        if (!safeUrl(next)) throw new ScanStop('bad_redirect');
        if (!allowed.has(next.hostname)) {
          // Only the myshopify host itself may name the primary domain, once,
          // and never another shop's myshopify host.
          if (primary || url.hostname !== shop || next.hostname.endsWith('.myshopify.com')) throw new ScanStop('foreign_redirect');
          primary = next.hostname;
          allowed.add(primary).add(twin(primary));
        }
        url = next;
        continue;
      }
      if (response.body.length > STOREFRONT_MAX_BODY_BYTES) throw new ScanStop('too_large');
      if (response.contentType !== 'text/html') throw new ScanStop('not_html');
      const html = response.body.toString('utf8');
      if (response.status === 200) {
        const verdict = classifyTags(connection, findPasteTags(html), nowSeconds);
        if (verdict === 'found') {
          return { outcome: 'found', host: url.hostname, evidence: { siteId: connection.widget_site_id, shopDomain: shop } as StorefrontEvidence,
            productUrl: findProductLink(html, url.hostname), passwordPage: passwordSent };
        }
        if (!findPasswordForm(html)) return { outcome: verdict };
      }
      const form = [200, 401, 403].includes(response.status) ? findPasswordForm(html) : null;
      if (!form) throw new ScanStop('status');
      if (passwordSent) return { outcome: 'password_rejected' };
      if (!options.password) return { outcome: 'password_required' };
      const action = URL.canParse(form.action, url) ? new URL(form.action, url) : null;
      // The password goes only to this same storefront host's /password.
      if (!action || action.hostname !== url.hostname || action.pathname !== '/password' || !safeUrl(action)) throw new ScanStop('password_form');
      const fields = new URLSearchParams(form.fields.filter(([name]) => name !== form.passwordField));
      fields.set(form.passwordField, options.password);
      url = new URL('/password', url);
      method = 'POST'; body = fields.toString(); passwordSent = true;
    }
    throw new ScanStop('too_many_redirects');
  } catch (error) {
    if (error instanceof ScanStop) return { outcome: 'unreachable', failure: error.failure };
    if (error instanceof PasteError) throw error;
    return { outcome: 'unreachable', failure: 'network' };
  }
}
