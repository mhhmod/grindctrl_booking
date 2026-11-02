// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), remove: vi.fn(), storageFrom: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/messenger/db', () => ({
  getMessengerServiceClient: () => ({ rpc: mocks.rpc, storage: { from: mocks.storageFrom } }),
}));
vi.mock('@/lib/messenger/attachments', () => ({ ATTACHMENT_BUCKET: 'messenger-attachments' }));

import { cleanupInactiveStoreChat } from './chat-retention';

const counts = { conversations: 1, messages: 3, attachments: 1, events: 1, feedback: 1, unanswered: 1, pending: 0 };
const task = { conversation_id: 'conversation-a', attachment_paths: ['site-a/conversation-a/image.jpg'] };
function respond(tasks = [task]) {
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === 'shopify_chat_retention_batch') return { data: tasks, error: null };
    if (name === 'shopify_chat_retention_finish') return { data: counts, error: null };
    return { data: 2, error: null };
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.storageFrom.mockReturnValue({ remove: mocks.remove });
  mocks.remove.mockResolvedValue({ data: [{ name: 'image.jpg' }], error: null });
  respond();
});

describe('Store Chat retention worker', () => {
  it('caps work, deletes Storage before rows, and returns counts only', async () => {
    const result = await cleanupInactiveStoreChat(1000);
    expect(mocks.rpc.mock.calls[0]).toEqual(['shopify_chat_retention_batch', { p_limit: 25, p_claim: expect.any(String) }]);
    expect(mocks.storageFrom).toHaveBeenCalledWith('messenger-attachments');
    expect(mocks.remove).toHaveBeenCalledWith(task.attachment_paths);
    expect(mocks.rpc).toHaveBeenCalledWith('shopify_chat_retention_finish', {
      p_conversation: task.conversation_id, p_claim: mocks.rpc.mock.calls[0][1].p_claim, p_paths: task.attachment_paths,
    });
    expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[1]);
    expect(result).toEqual({ ...counts, scanned: 1, storageObjects: 1, visitors: 2, failed: 0 });
    expect(Object.values(result).every((value) => typeof value === 'number')).toBe(true);
  });

  it.each([[-2, 1], [2.9, 2], [Number.NaN, 25], [Infinity, 25]])('normalizes limit %s to %s', async (input, expected) => {
    await cleanupInactiveStoreChat(input);
    expect(mocks.rpc.mock.calls[0][1].p_limit).toBe(expected);
  });

  it('keeps rows pending when Storage removal fails and still sweeps orphan visitors', async () => {
    mocks.remove.mockResolvedValue({ error: { message: 'sensitive-object-path' } });
    expect(await cleanupInactiveStoreChat()).toMatchObject({ failed: 1, conversations: 0, attachments: 0, visitors: 2 });
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(['shopify_chat_retention_batch', 'shopify_chat_retention_visitors']);
  });

  it('allows already-absent objects on retry and does not recount deleted rows on the next run', async () => {
    mocks.remove.mockResolvedValue({ data: [], error: null });
    expect(await cleanupInactiveStoreChat()).toMatchObject({ conversations: 1, storageObjects: 0, failed: 0 });
    respond([]);
    expect(await cleanupInactiveStoreChat()).toMatchObject({ scanned: 0, conversations: 0, storageObjects: 0, failed: 0 });
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });

  it('records partial attachment progress without claiming conversation deletion', async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({
      data: name === 'shopify_chat_retention_batch' ? [task]
        : name === 'shopify_chat_retention_finish' ? { ...counts, conversations: 0, messages: 0, pending: 1 }
          : 0,
      error: null,
    }));
    expect(await cleanupInactiveStoreChat()).toMatchObject({ conversations: 0, messages: 0, attachments: 1, pending: 1, failed: 0 });
  });

  it('fails visibly on a lost finalization lease without pretending rows were deleted', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'shopify_chat_retention_batch'
      ? { data: [task], error: null } : name === 'shopify_chat_retention_finish'
        ? { data: null, error: { message: 'claim lost' } } : { data: 0, error: null });
    expect(await cleanupInactiveStoreChat()).toMatchObject({ conversations: 0, attachments: 0, failed: 1 });
  });

  it('refuses oversized object manifests and oversized claim results', async () => {
    respond([{ ...task, attachment_paths: Array.from({ length: 101 }, (_, index) => `${index}.jpg`) }]);
    expect(await cleanupInactiveStoreChat()).toMatchObject({ failed: 1 });
    expect(mocks.remove).not.toHaveBeenCalled();
    respond(Array.from({ length: 26 }, () => task));
    await expect(cleanupInactiveStoreChat()).rejects.toThrow('chat_retention_claim_failed');
  });

  it('rejects invalid completion counts and visitor failures', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'shopify_chat_retention_batch'
      ? { data: [task], error: null } : name === 'shopify_chat_retention_finish'
        ? { data: { ...counts, messages: -1 }, error: null } : { data: 26, error: null });
    expect(await cleanupInactiveStoreChat()).toMatchObject({ conversations: 0, messages: 0, visitors: 0, failed: 2 });
  });
});
