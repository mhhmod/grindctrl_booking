import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

/* A widget_domains table in memory, behind the slice of the Supabase query
   builder domains.ts uses, so isolation is checked against real filtering
   rather than mocked return values. */
const table = vi.hoisted(() => ({ rows: [] as Row[] }));

vi.mock('server-only', () => ({}));
vi.mock('./db', () => ({
  getMessengerServiceClient: () => ({
    from: (name: string) => {
      if (name !== 'widget_domains') throw new Error(`unexpected table ${name}`);
      let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
      let payload: Row = {};
      const filters: Array<[string, unknown]> = [];
      const matching = () => table.rows.filter((row) => filters.every(([col, val]) => row[col] === val));
      const run = () => {
        if (op === 'insert') {
          const row = { id: `dom-${table.rows.length + 1}`, verified_at: null, last_checked_at: null, created_at: String(table.rows.length), ...payload };
          table.rows.push(row);
          return [row];
        }
        const rows = matching();
        if (op === 'update') rows.forEach((row) => Object.assign(row, payload));
        if (op === 'delete') table.rows = table.rows.filter((row) => !rows.includes(row));
        return rows;
      };
      const builder = {
        select: () => builder,
        insert: (values: Row) => ((op = 'insert'), (payload = values), builder),
        update: (values: Row) => ((op = 'update'), (payload = values), builder),
        delete: () => ((op = 'delete'), builder),
        eq: (col: string, val: unknown) => (filters.push([col, val]), builder),
        order: () => builder,
        single: async () => {
          const rows = run();
          return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: 'not one row' } };
        },
        maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
        then: (resolve: (value: unknown) => void) => resolve({ data: run(), error: null }),
      };
      return builder;
    },
  }),
}));

import {
  addSiteDomain,
  checkSiteDomain,
  DomainError,
  listSiteDomains,
  MAX_DOMAINS_PER_SITE,
  newVerificationToken,
  normalizeStorefrontDomain,
  removeSiteDomain,
  txtRecordFor,
  verifyDomainTxt,
} from './domains';

beforeEach(() => {
  table.rows = [];
});

function published(record: { value: string }) {
  return vi.fn(async () => [[record.value.slice(0, 20), record.value.slice(20)]]);
}

describe('normalizeStorefrontDomain', () => {
  it.each([
    ['shop.example.com', 'shop.example.com'],
    ['  HTTPS://Shop.Example.com/products/abaya?x=1 ', 'shop.example.com'],
    ['example.com.', 'example.com'],
    ['http://www.example.co.uk', 'www.example.co.uk'],
    ['متجر.مصر', 'xn--pgbep1f.xn--wgbh1c'],
  ])('accepts %s', (input, expected) => {
    expect(normalizeStorefrontDomain(input)).toBe(expected);
  });

  it.each([
    '',
    'localhost',
    'shop',
    '192.168.1.10',
    '[::1]',
    'maison.myshopify.com',
    'grindctrl.cloud',
    'evil.grindctrl.cloud',
    '*.example.com',
    'example.com:8080',
    'user:pass@example.com',
    'ftp://example.com',
    `${'a'.repeat(64)}.com`,
  ])('refuses %s', (input) => {
    expect(normalizeStorefrontDomain(input)).toBeNull();
  });
});

describe('verifyDomainTxt', () => {
  it('matches the exact record, joining a value split into strings', async () => {
    const token = newVerificationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{24}$/);
    const record = txtRecordFor('shop.example.com', token);
    expect(record.name).toBe('_grindctrl-verification.shop.example.com');
    const resolve = published(record);
    await expect(verifyDomainTxt('shop.example.com', token, resolve)).resolves.toBe(true);
    expect(resolve).toHaveBeenCalledWith(record.name);
  });

  it('reads a wrong value, a missing record and a resolver error as not verified', async () => {
    const token = newVerificationToken();
    await expect(verifyDomainTxt('a.com', token, async () => [['grindctrl-verification=other']])).resolves.toBe(false);
    await expect(verifyDomainTxt('a.com', token, async () => { throw Object.assign(new Error('x'), { code: 'ENOTFOUND' }); })).resolves.toBe(false);
  });

  it('gives up on a resolver that never answers', async () => {
    vi.useFakeTimers();
    try {
      const pending = verifyDomainTxt('a.com', 't', () => new Promise(() => {}));
      await vi.advanceTimersByTimeAsync(5_000);
      await expect(pending).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('site domains', () => {
  it('adds a pending domain with our own strong token, once', async () => {
    const first = await addSiteDomain('site-a', 'https://Shop.Example.com/');
    expect(first).toMatchObject({ domain: 'shop.example.com', status: 'pending', txtName: '_grindctrl-verification.shop.example.com' });
    expect(first.txtValue).toMatch(/^grindctrl-verification=[A-Za-z0-9_-]{24}$/);
    expect(table.rows[0]).toMatchObject({ verification_method: 'dns_txt', pattern: 'shop.example.com', widget_site_id: 'site-a' });
    await expect(addSiteDomain('site-a', 'shop.example.com')).resolves.toEqual(first);
    expect(table.rows).toHaveLength(1);
  });

  it('refuses bad input, a full list, and a host another site has proven', async () => {
    await expect(addSiteDomain('site-a', 'localhost')).rejects.toEqual(new DomainError('invalid_domain'));
    for (let i = 0; i < MAX_DOMAINS_PER_SITE; i++) await addSiteDomain('site-a', `s${i}.example.com`);
    await expect(addSiteDomain('site-a', 'one-more.example.com')).rejects.toEqual(new DomainError('limit_reached'));
    table.rows.push({ id: 'b1', widget_site_id: 'site-b', pattern: 'taken.example.com', verification_status: 'verified', verification_method: 'shopify_admin' });
    await expect(addSiteDomain('site-c', 'taken.example.com')).rejects.toEqual(new DomainError('taken'));
  });

  it('verifies on a published record and keeps a verified host on a later miss', async () => {
    const added = await addSiteDomain('site-a', 'shop.example.com');
    const missing = await checkSiteDomain('site-a', added.id, async () => []);
    expect(missing.status).toBe('failed');
    expect(missing.lastCheckedAt).not.toBeNull();

    const verified = await checkSiteDomain('site-a', added.id, published({ value: added.txtValue }));
    expect(verified.status).toBe('verified');
    expect(verified.verifiedAt).not.toBeNull();

    const blip = await checkSiteDomain('site-a', added.id, async () => []);
    expect(blip.status).toBe('verified');
  });

  it('will not prove a host for a second site', async () => {
    const added = await addSiteDomain('site-a', 'shop.example.com');
    table.rows.push({ id: 'b1', widget_site_id: 'site-b', pattern: 'shop.example.com', verification_status: 'verified', verification_method: 'dns_txt' });
    await expect(checkSiteDomain('site-a', added.id, published({ value: added.txtValue }))).rejects.toEqual(new DomainError('taken'));
    expect(table.rows.find((row) => row.id === added.id)?.verification_status).toBe('pending');
  });

  it("never lets one site read, check or remove another site's domain", async () => {
    const theirs = await addSiteDomain('site-b', 'theirs.example.com');
    await expect(checkSiteDomain('site-a', theirs.id, published({ value: theirs.txtValue }))).rejects.toEqual(new DomainError('not_found'));
    await expect(removeSiteDomain('site-a', theirs.id)).rejects.toEqual(new DomainError('not_found'));
    await expect(listSiteDomains('site-a')).resolves.toEqual([]);
    expect(table.rows.find((row) => row.id === theirs.id)?.verification_status).toBe('pending');
  });

  it("leaves Shopify's own rows to the Shopify sync", async () => {
    table.rows.push({ id: 's1', widget_site_id: 'site-a', domain: 'brand.com', pattern: 'brand.com', verification_status: 'verified', verification_method: 'shopify_admin' });
    await expect(listSiteDomains('site-a')).resolves.toEqual([]);
    await expect(removeSiteDomain('site-a', 's1')).rejects.toEqual(new DomainError('not_found'));
    expect(table.rows).toHaveLength(1);
  });

  it('removes its own domain', async () => {
    const added = await addSiteDomain('site-a', 'shop.example.com');
    await removeSiteDomain('site-a', added.id);
    expect(table.rows).toEqual([]);
  });
});
