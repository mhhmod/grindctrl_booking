import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));

type QueryResult = { data: unknown; error: { message: string } | null };

type Builder = {
  operation: 'select' | 'delete' | 'insert' | 'update' | null;
  payload: unknown;
  eqCalls: Array<[string, unknown]>;
  isCalls: Array<[string, unknown]>;
  select: (columns?: string) => Builder;
  delete: () => Builder;
  insert: (payload: unknown) => Builder;
  update: (payload: unknown) => Builder;
  eq: (column: string, value: unknown) => Builder;
  is: (column: string, value: unknown) => Builder;
  maybeSingle: () => Promise<QueryResult>;
  then: <T>(
    onFulfilled: (value: QueryResult) => T,
    onRejected?: (reason: unknown) => T,
  ) => Promise<T>;
};

function makeBuilder(result: QueryResult): Builder {
  const builder: Builder = {
    operation: null,
    payload: null,
    eqCalls: [],
    isCalls: [],
    select: () => {
      if (!builder.operation) builder.operation = 'select';
      return builder;
    },
    delete: () => {
      builder.operation = 'delete';
      return builder;
    },
    insert: (payload) => {
      builder.operation = 'insert';
      builder.payload = payload;
      return builder;
    },
    update: (payload) => {
      builder.operation = 'update';
      builder.payload = payload;
      return builder;
    },
    eq: (column, value) => {
      builder.eqCalls.push([column, value]);
      return builder;
    },
    is: (column, value) => {
      builder.isCalls.push([column, value]);
      return builder;
    },
    maybeSingle: () => Promise.resolve(result),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return builder;
}

const fromMock = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (table: string) => fromMock(table) }),
}));

import { consumeShopLinkCode, createShopLinkCode, isShopLinked } from './shop-links';

const NOW = '2026-09-10T10:00:00.000Z';
const activeLink = {
  code: 'ABCDEFGH',
  clerk_user_id: 'user_owner',
  expires_at: '2026-09-10T10:10:00.000Z',
  consumed_at: null,
};

function queueBuilders(...builders: Builder[]) {
  const queue = [...builders];
  fromMock.mockImplementation(() => {
    const next = queue.shift();
    if (!next) throw new Error('Unexpected Supabase query');
    return next;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  mocks.auth.mockResolvedValue({ userId: 'user_owner' });
});

describe('createShopLinkCode', () => {
  it('requires a signed-in dashboard owner', async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    await expect(createShopLinkCode()).rejects.toThrow('Unauthorized');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('invalidates a prior unconsumed code and creates a ten-minute code', async () => {
    const removePrior = makeBuilder({ data: null, error: null });
    const insertCode = makeBuilder({ data: null, error: null });
    queueBuilders(removePrior, insertCode);

    const result = await createShopLinkCode();

    expect(result).toEqual({
      code: expect.stringMatching(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/),
      expiresAt: '2026-09-10T10:10:00.000Z',
    });

    expect(removePrior.operation).toBe('delete');
    expect(removePrior.eqCalls).toContainEqual(['clerk_user_id', 'user_owner']);
    expect(removePrior.isCalls).toContainEqual(['consumed_at', null]);
    expect(insertCode.operation).toBe('insert');
    expect(insertCode.payload).toEqual({
      code: result.code,
      clerk_user_id: 'user_owner',
      expires_at: '2026-09-10T10:10:00.000Z',
    });
  });
});

describe('consumeShopLinkCode', () => {
  it('links an unowned shop and records which shop consumed the code', async () => {
    const findCode = makeBuilder({ data: activeLink, error: null });
    const findShop = makeBuilder({ data: { owner_clerk_user_id: null }, error: null });
    const linkShop = makeBuilder({ data: { owner_clerk_user_id: 'user_owner' }, error: null });
    const consumeCode = makeBuilder({ data: null, error: null });
    queueBuilders(findCode, findShop, linkShop, consumeCode);

    await expect(consumeShopLinkCode('abcd- efgh', 'real-shop.myshopify.com')).resolves.toBe(
      'linked',
    );

    expect(findCode.eqCalls).toContainEqual(['code', 'ABCDEFGH']);
    expect(findShop.eqCalls).toContainEqual(['shop_domain', 'real-shop.myshopify.com']);
    expect(linkShop.payload).toEqual({ owner_clerk_user_id: 'user_owner' });
    expect(linkShop.eqCalls).toContainEqual(['shop_domain', 'real-shop.myshopify.com']);
    expect(consumeCode.payload).toEqual({
      consumed_at: NOW,
      consumed_shop_domain: 'real-shop.myshopify.com',
    });
  });

  it('treats a re-link to the same owner as success without updating the shop', async () => {
    const findCode = makeBuilder({ data: activeLink, error: null });
    const findShop = makeBuilder({ data: { owner_clerk_user_id: 'user_owner' }, error: null });
    const consumeCode = makeBuilder({ data: null, error: null });
    queueBuilders(findCode, findShop, consumeCode);

    await expect(consumeShopLinkCode('ABCDEFGH', 'real-shop.myshopify.com')).resolves.toBe(
      'linked',
    );

    expect(fromMock).toHaveBeenCalledTimes(3);
    expect(consumeCode.operation).toBe('update');
  });

  it('refuses a shop owned by another account without touching either record', async () => {
    const findCode = makeBuilder({ data: activeLink, error: null });
    const findShop = makeBuilder({ data: { owner_clerk_user_id: 'user_someone_else' }, error: null });
    queueBuilders(findCode, findShop);

    await expect(consumeShopLinkCode('ABCDEFGH', 'real-shop.myshopify.com')).resolves.toBe(
      'already_owned',
    );

    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(findShop.operation).toBe('select');
  });

  it('rejects an expired code', async () => {
    queueBuilders(
      makeBuilder({
        data: { ...activeLink, expires_at: '2026-09-10T09:59:59.999Z' },
        error: null,
      }),
    );

    await expect(consumeShopLinkCode('ABCDEFGH', 'real-shop.myshopify.com')).resolves.toBe(
      'expired',
    );
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown code', async () => {
    queueBuilders(makeBuilder({ data: null, error: null }));

    await expect(consumeShopLinkCode('not-real', 'real-shop.myshopify.com')).resolves.toBe(
      'invalid',
    );
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a consumed code on a second use', async () => {
    const firstFind = makeBuilder({ data: activeLink, error: null });
    const firstShop = makeBuilder({ data: { owner_clerk_user_id: 'user_owner' }, error: null });
    const firstConsume = makeBuilder({ data: null, error: null });
    const secondFind = makeBuilder({ data: { ...activeLink, consumed_at: NOW }, error: null });
    queueBuilders(firstFind, firstShop, firstConsume, secondFind);

    await expect(consumeShopLinkCode('ABCDEFGH', 'real-shop.myshopify.com')).resolves.toBe(
      'linked',
    );
    await expect(consumeShopLinkCode('ABCDEFGH', 'real-shop.myshopify.com')).resolves.toBe(
      'invalid',
    );
    expect(fromMock).toHaveBeenCalledTimes(4);
  });
});

describe('isShopLinked', () => {
  it.each([
    [{ owner_clerk_user_id: 'user_owner' }, true],
    [{ owner_clerk_user_id: null }, false],
    [null, false],
  ] as const)('maps the stored owner state to %s', async (data, expected) => {
    const findShop = makeBuilder({ data, error: null });
    queueBuilders(findShop);

    await expect(isShopLinked('real-shop.myshopify.com')).resolves.toBe(expected);
    expect(findShop.eqCalls).toContainEqual(['shop_domain', 'real-shop.myshopify.com']);
  });
});
