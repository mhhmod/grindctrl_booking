// @vitest-environment node
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { liquidMacMatches, pasteLiquidSecret } from './signing';
import { buildPasteSnippet } from './snippet';
import { PASTE_CARD_LIMIT, PASTE_SHOPIFY_CODE_VERSION, type PasteConnection } from './types';

/* The pasted Shopify snippet, rendered. Shopify's Liquid cannot run here, so
   this is a small interpreter for exactly the tags and filters the snippet
   uses (assign, capture, liquid, case/when, if/elsif, for/limit, continue,
   whitespace control; date, hmac_sha256, plus, json, escape, image_url).
   Every card it prints must verify with the server's own MAC check. */

const SITE = '11111111-1111-4111-8111-111111111111';
const SHOP = 'merchant.myshopify.com';
const NOW = 2_000_000_000;
const connection: PasteConnection = {
  widget_site_id: SITE, platform: 'shopify', shop_domain: SHOP, status: 'active', secret_version: 1,
  previous_secret_version: null, previous_valid_until: null, first_seen_at: null, last_seen_at: null,
  shop_proven_at: '2033-05-18T03:33:20.000Z', disconnected_reason: null, shop_render_at: null,
  shop_check_outcome: null, shop_checked_at: null, app_installed: false,
};

type Tok = { kind: 'text' | 'out' | 'tag'; value: string };
type Node =
  | { t: 'text' | 'out'; v: string }
  | { t: 'assign'; name: string; expr: string }
  | { t: 'capture'; name: string; body: Node[] }
  | { t: 'if'; branches: Array<{ cond: string | null; body: Node[] }> }
  | { t: 'case'; expr: string; whens: Array<{ value: string; body: Node[] }> }
  | { t: 'for'; name: string; coll: string; limit: number; body: Node[] }
  | { t: 'continue' | 'break' };
type Scope = Record<string, unknown>;

function tokenize(source: string): Tok[] {
  const tokens: Tok[] = [];
  let last = 0;
  let trimNext = false;
  for (const m of source.matchAll(/\{%(-?)([\s\S]*?)(-?)%\}|\{\{(-?)([\s\S]*?)(-?)\}\}/g)) {
    let text = source.slice(last, m.index);
    if (trimNext) text = text.replace(/^\s+/, '');
    if (m[1] === '-' || m[4] === '-') text = text.replace(/\s+$/, '');
    if (text) tokens.push({ kind: 'text', value: text });
    if (m[2] !== undefined) {
      const body = m[2].trim();
      if (/^liquid\b/.test(body)) {
        for (const line of body.slice(6).split('\n')) if (line.trim()) tokens.push({ kind: 'tag', value: line.trim() });
      } else tokens.push({ kind: 'tag', value: body });
      trimNext = m[3] === '-';
    } else {
      tokens.push({ kind: 'out', value: m[5].trim() });
      trimNext = m[6] === '-';
    }
    last = m.index! + m[0].length;
  }
  const tail = trimNext ? source.slice(last).replace(/^\s+/, '') : source.slice(last);
  if (tail) tokens.push({ kind: 'text', value: tail });
  return tokens;
}

function parse(tokens: Tok[]): Node[] {
  let pos = 0;
  function block(stops: string[]): { nodes: Node[]; stop: string | null } {
    const nodes: Node[] = [];
    while (pos < tokens.length) {
      const token = tokens[pos++];
      if (token.kind !== 'tag') { nodes.push({ t: token.kind, v: token.value }); continue; }
      const name = token.value.split(/\s+/, 1)[0];
      const rest = token.value.slice(name.length).trim();
      if (stops.includes(name)) return { nodes, stop: token.value };
      if (name === 'assign') {
        const eq = rest.indexOf('=');
        nodes.push({ t: 'assign', name: rest.slice(0, eq).trim(), expr: rest.slice(eq + 1).trim() });
      } else if (name === 'capture') {
        nodes.push({ t: 'capture', name: rest, body: block(['endcapture']).nodes });
      } else if (name === 'if') {
        const branches: Array<{ cond: string | null; body: Node[] }> = [];
        let cond: string | null = rest;
        for (;;) {
          const b = block(['elsif', 'else', 'endif']);
          branches.push({ cond, body: b.nodes });
          if (!b.stop || b.stop.startsWith('endif')) break;
          cond = b.stop.startsWith('elsif') ? b.stop.slice(5).trim() : null;
        }
        nodes.push({ t: 'if', branches });
      } else if (name === 'case') {
        const whens: Array<{ value: string; body: Node[] }> = [];
        let b = block(['when', 'endcase']);
        while (b.stop?.startsWith('when')) {
          const value = b.stop.slice(4).trim();
          b = block(['when', 'endcase']);
          whens.push({ value, body: b.nodes });
        }
        nodes.push({ t: 'case', expr: rest, whens });
      } else if (name === 'for') {
        const m = /^(\w+) in ([\w.]+)(?:\s+limit:\s*(\d+))?$/.exec(rest);
        if (!m) throw new Error(`unsupported for: ${rest}`);
        nodes.push({ t: 'for', name: m[1], coll: m[2], limit: m[3] ? Number(m[3]) : Infinity, body: block(['endfor']).nodes });
      } else if (name === 'continue' || name === 'break') {
        nodes.push({ t: name });
      } else throw new Error(`unsupported tag: ${name}`);
    }
    return { nodes, stop: null };
  }
  return block([]).nodes;
}

const BLANK = Symbol('blank');
const isBlank = (value: unknown) => value == null || value === '' || (Array.isArray(value) && !value.length);
function lookup(path: string, scope: Scope): unknown {
  return path.split('.').reduce<unknown>((value, key) => (value == null ? undefined : (value as Scope)[key]), scope);
}
function literal(token: string, scope: Scope): unknown {
  const t = token.trim();
  if (/^'[^']*'$/.test(t)) return t.slice(1, -1);
  if (/^-?\d+$/.test(t)) return Number(t);
  if (t === 'nil') return null;
  if (t === 'blank') return BLANK;
  return lookup(t, scope);
}
const htmlEscape = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
function evaluate(expr: string, scope: Scope): unknown {
  const [head, ...filters] = expr.split('|');
  let value = literal(head, scope);
  for (const filter of filters) {
    const colon = filter.indexOf(':');
    const name = (colon < 0 ? filter : filter.slice(0, colon)).trim();
    const args = colon < 0 ? [] : filter.slice(colon + 1).split(',').map((a) => a.trim());
    const positional = args.filter((a) => !/^\w+:\s/.test(a)).map((a) => literal(a, scope));
    const named = Object.fromEntries(args.filter((a) => /^\w+:\s/.test(a)).map((a) => {
      const [k, v] = a.split(/:\s*/); return [k, literal(v, scope)];
    }));
    if (name === 'date') value = value === 'now' && positional[0] === '%s' ? String(NOW) : (() => { throw new Error('date'); })();
    else if (name === 'hmac_sha256') value = createHmac('sha256', String(positional[0])).update(String(value)).digest('hex');
    else if (name === 'plus') value = Number(value) + Number(positional[0]);
    else if (name === 'json') value = JSON.stringify(value);
    else if (name === 'escape') value = htmlEscape(value);
    else if (name === 'image_url') {
      const src = (value as { src: string }).src;
      value = `${src}${src.includes('?') ? '&' : '?'}width=${named.width}`;
    } else throw new Error(`unsupported filter: ${name}`);
  }
  return value;
}
function condition(expr: string, scope: Scope): boolean {
  if (expr.includes(' or ')) return expr.split(' or ').some((part) => condition(part, scope));
  if (expr.includes(' and ')) return expr.split(' and ').every((part) => condition(part, scope));
  const m = /^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/.exec(expr.trim());
  if (!m) { const value = literal(expr, scope); return value !== null && value !== undefined && value !== false; }
  const a = literal(m[1], scope);
  const b = literal(m[3], scope);
  if (b === BLANK) return m[2] === '==' ? isBlank(a) : !isBlank(a);
  const [x, y] = [a as number, b as number];
  return { '==': x === y, '!=': x !== y, '>=': x >= y, '<=': x <= y, '>': x > y, '<': x < y }[m[2]]!;
}
class Signal { constructor(readonly kind: 'continue' | 'break', public partial = '') {} }
function render(nodes: Node[], scope: Scope): string {
  let out = '';
  for (const node of nodes) {
    try {
      if (node.t === 'text') out += node.v;
      else if (node.t === 'out') { const value = evaluate(node.v, scope); out += value == null ? '' : String(value); }
      else if (node.t === 'assign') scope[node.name] = evaluate(node.expr, scope);
      else if (node.t === 'capture') scope[node.name] = render(node.body, scope);
      else if (node.t === 'if') {
        const branch = node.branches.find((b) => b.cond === null || condition(b.cond, scope));
        if (branch) out += render(branch.body, scope);
      } else if (node.t === 'case') {
        const value = evaluate(node.expr, scope);
        const when = node.whens.find((w) => literal(w.value, scope) === value);
        if (when) out += render(when.body, scope);
      } else if (node.t === 'for') {
        const items = ((lookup(node.coll, scope) as unknown[] | undefined) ?? []).slice(0, node.limit);
        for (const item of items) {
          scope[node.name] = item;
          try { out += render(node.body, scope); } catch (error) {
            if (!(error instanceof Signal)) throw error;
            out += error.partial;
            if (error.kind === 'break') break;
          }
        }
      } else throw new Signal(node.t);
    } catch (error) {
      if (error instanceof Signal) error.partial = out + error.partial;
      throw error;
    }
  }
  return out;
}

type Product = { id: number; handle: string; title: string; featured_image: { src: string } | null;
  selected_or_first_available_variant: { id: number } | null; object_type?: string };
const product = (id: number, over: Partial<Product> = {}): Product => ({
  id, handle: `item-${id}`, title: `Item ${id}`, featured_image: { src: `//merchant.example/cdn/shop/files/${id}.jpg?v=1` },
  selected_or_first_available_variant: { id: id + 100 }, ...over,
});
function renderSnippet(scope: Scope): string {
  const { snippet } = buildPasteSnippet(connection, 'gc_public_key_42');
  return render(parse(tokenize(snippet)), {
    shop: { permanent_domain: SHOP }, customer: null, product: null, request: { page_type: 'page' },
    collection: null, search: null, collections: { all: { products: [] } }, ...scope,
  });
}
type Cards = { site: string; shop: string; issuedAt: string; customer: string;
  products: Array<{ id: string; variant: string; handle: string; title: string; image: string; signature: string }> };
function cardsOf(html: string): Cards | null {
  const m = /<script type="application\/json" data-gc-cards="([^"]+)">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return null;
  expect(m[1]).toBe(SITE);
  return JSON.parse(m[2]) as Cards;
}
function verifies(cards: Cards, entry: Cards['products'][number]): boolean | null {
  return liquidMacMatches(connection, { siteId: cards.site, shopDomain: cards.shop, productId: entry.id, variantId: entry.variant,
    issuedAt: cards.issuedAt, customerId: cards.customer }, entry.signature, NOW);
}
const loaderTag = (html: string) => /<script async src="https:\/\/grindctrl\.cloud\/widget\/v1\/messenger\.js"[^>]*><\/script>/.exec(html)?.[0] ?? '';
const attr = (tag: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];

beforeEach(() => vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET', 'test-only-independent-core-key-with-at-least-32-bytes'));
afterEach(() => vi.unstubAllEnvs());

describe('pasted Shopify snippet: signed product cards', () => {
  it('signs every card on a collection page like the product page, verifiable by the server', () => {
    const html = renderSnippet({ request: { page_type: 'collection' },
      collection: { products: [product(501), product(502, { selected_or_first_available_variant: { id: 777 } })] } });
    const cards = cardsOf(html)!;
    expect(cards).toMatchObject({ site: SITE, shop: SHOP, issuedAt: String(NOW), customer: '' });
    expect(cards.products.map((p) => [p.id, p.variant, p.handle])).toEqual([['501', '601', 'item-501'], ['502', '777', 'item-502']]);
    for (const entry of cards.products) expect(verifies(cards, entry)).toBe(true);
    // A card's MAC is bound to its own product and variant.
    expect(verifies(cards, { ...cards.products[0], id: '502' })).toBe(false);
    expect(verifies(cards, { ...cards.products[0], variant: '777' })).toBe(false);
    expect(cards.products[0].image).toBe('//merchant.example/cdn/shop/files/501.jpg?v=1&amp;width=1200');
  });

  it('prints the cards before the loader tag, which carries the code version', () => {
    const html = renderSnippet({ request: { page_type: 'collection' }, collection: { products: [product(501)] } });
    const tag = loaderTag(html);
    expect(attr(tag, 'data-gc-v')).toBe(String(PASTE_SHOPIFY_CODE_VERSION));
    expect(html.indexOf('data-gc-cards')).toBeLessThan(html.indexOf(tag));
    // Off a product page the loader's product claims are empty, as before.
    expect(attr(tag, 'data-gc-product')).toBe('');
    expect(attr(tag, 'data-gc-shop')).toBe(SHOP);
  });

  it('escapes every free-text value so no card can close the script element or break the JSON', () => {
    const title = 'Abaya "Noor" </script><script>alert(1)</script> & \'co\' \\ \n line';
    const html = renderSnippet({ request: { page_type: 'collection' }, collection: { products: [product(501, { title, handle: 'noor-abaya' })] } });
    const json = /<script type="application\/json" data-gc-cards="[^"]+">([\s\S]*?)<\/script>/.exec(html)![1];
    expect(json).not.toMatch(/[<>]/);
    const cards = cardsOf(html)!;
    expect(cards.products[0].title).toBe('Abaya &quot;Noor&quot; &lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt; &amp; &#39;co&#39; \\ \n line');
  });

  it('allows sold-out products and skips products with no image or variant', () => {
    const html = renderSnippet({ request: { page_type: 'collection' }, collection: { products: [
      product(501, { featured_image: null }), product(502, { selected_or_first_available_variant: null }), product(503),
    ] } });
    const cards = cardsOf(html)!;
    expect(cards.products.map((p) => p.id)).toEqual(['503']);
    expect(verifies(cards, cards.products[0])).toBe(true);
  });

  it(`signs at most ${PASTE_CARD_LIMIT} cards, in one loop with no loop over variants`, () => {
    const many = Array.from({ length: 80 }, (_, i) => product(1000 + i));
    const cards = cardsOf(renderSnippet({ request: { page_type: 'collection' }, collection: { products: many } }))!;
    expect(cards.products).toHaveLength(PASTE_CARD_LIMIT);
    const { snippet } = buildPasteSnippet(connection, 'gc_public_key_42');
    expect(snippet.match(/\{%-?\s*for\b/g)).toHaveLength(1);
    expect(snippet).not.toContain('variants');
  });

  it('signs search results (products only) and the home page from the all-products collection', () => {
    const search = cardsOf(renderSnippet({ request: { page_type: 'search' }, search: { results: [
      { object_type: 'article', id: 9, title: 'Blog' }, { ...product(501), object_type: 'product' },
    ] } }))!;
    expect(search.products.map((p) => p.id)).toEqual(['501']);
    const home = cardsOf(renderSnippet({ request: { page_type: 'index' }, collections: { all: { products: [product(601)] } } }))!;
    expect(home.products.map((p) => p.id)).toEqual(['601']);
    expect(verifies(home, home.products[0])).toBe(true);
  });

  it('prints no cards on a product page, cart or empty collection, and keeps the product page signature', () => {
    const page = renderSnippet({ request: { page_type: 'product' }, product: product(42, { selected_or_first_available_variant: { id: 77 } }),
      customer: { id: 5 } });
    expect(cardsOf(page)).toBeNull();
    const tag = loaderTag(page);
    expect(liquidMacMatches(connection, { siteId: SITE, shopDomain: SHOP, productId: attr(tag, 'data-gc-product')!,
      variantId: attr(tag, 'data-gc-variant')!, issuedAt: attr(tag, 'data-gc-issued-at')!, customerId: attr(tag, 'data-gc-customer')! },
    attr(tag, 'data-gc-signature')!, NOW)).toBe(true);
    expect(attr(tag, 'data-gc-customer')).toBe('5');
    expect(cardsOf(renderSnippet({ request: { page_type: 'cart' } }))).toBeNull();
    expect(cardsOf(renderSnippet({ request: { page_type: 'collection' }, collection: { products: [] } }))).toBeNull();
  });

  it('binds a signed-in customer into every card, as on the product page', () => {
    const cards = cardsOf(renderSnippet({ request: { page_type: 'collection' }, customer: { id: 31 }, collection: { products: [product(501)] } }))!;
    expect(cards.customer).toBe('31');
    expect(verifies(cards, cards.products[0])).toBe(true);
    expect(verifies({ ...cards, customer: '' }, cards.products[0])).toBe(false);
  });

  it('never prints the secret: it occurs once, in an assign tag, and only feeds hmac_sha256', () => {
    const secret = pasteLiquidSecret(SITE, 1)!;
    const { snippet } = buildPasteSnippet(connection, 'gc_public_key_42');
    expect(snippet.split(secret)).toHaveLength(2);
    expect(snippet).toContain(`{%- assign gc_key = '${secret}' -%}`);
    expect([...snippet.matchAll(/gc_key/g)].length).toBe(3);
    expect(snippet.match(/hmac_sha256: gc_key/g)).toHaveLength(2);
    // Any output naming the key prints its MAC, never the key.
    for (const [output] of snippet.matchAll(/\{\{[^}]*gc_key[^}]*\}\}/g)) expect(output).toMatch(/\| hmac_sha256: gc_key \}\}$/);
    for (const scope of [{ request: { page_type: 'collection' }, collection: { products: [product(501)] } },
      { request: { page_type: 'product' }, product: product(42) }]) {
      expect(renderSnippet(scope)).not.toContain(secret);
    }
  });

  it('matches the exact template documented in the paste handoff', async () => {
    const { readFile } = await import('node:fs/promises');
    const doc = (await readFile(new URL('../../../../docs/paste-install-d1a-handoff.md', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
    const documented = /```liquid\n([\s\S]*?)\n```/.exec(doc)![1];
    const secret = pasteLiquidSecret(SITE, 1)!;
    const template = buildPasteSnippet(connection, 'gc_public_key_42').snippet
      .split(secret).join('DERIVED_SECRET').split(SITE).join('SITE_UUID').split('gc_public_key_42').join('EMBED_KEY');
    expect(documented.replace(/\r\n/g, '\n')).toBe(template);
  });

  it('keeps website code unchanged and unversioned', () => {
    const website = buildPasteSnippet({ ...connection, platform: 'website', shop_domain: null }, 'gc_public_key_42');
    expect(website.codeVersion).toBeNull();
    expect(website.snippet).not.toContain('data-gc-v');
    expect(buildPasteSnippet(connection, 'gc_public_key_42').codeVersion).toBe(PASTE_SHOPIFY_CODE_VERSION);
  });
});
