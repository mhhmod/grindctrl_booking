import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { cleanupExpiredMock, sweepOrphansMock } = vi.hoisted(() => ({
  cleanupExpiredMock: vi.fn(),
  sweepOrphansMock: vi.fn(),
}));

vi.mock('@/lib/try-on/persistence', () => ({
  TRYON_CLEANUP_BATCH_LIMIT: 50,
  TRYON_ORPHAN_SWEEP_LIMIT: 25,
  cleanupExpiredTryOnResults: (...args: unknown[]) => cleanupExpiredMock(...args),
  sweepOrphanedTryOnResults: (...args: unknown[]) => sweepOrphansMock(...args),
}));

import { POST } from './route';

const SECRET = 'cleanup-secret-with-at-least-32-bytes-123456';
const PATH_CANARY = 'jobs/tryon_private/result.png';

function request(token?: string) {
  return new NextRequest('http://localhost/api/internal/try-on/cleanup', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
}

describe('POST /api/internal/try-on/cleanup', () => {
  beforeEach(() => {
    process.env.TRYON_CLEANUP_SECRET = SECRET;
    cleanupExpiredMock.mockReset().mockResolvedValue({ scanned: 2, deleted: 2, failed: 0 });
    sweepOrphansMock.mockReset().mockResolvedValue({
      foldersScanned: 3,
      objectsScanned: 2,
      candidates: 1,
      deleted: 1,
      skipped: 1,
      failed: 0,
    });
  });

  afterEach(() => {
    delete process.env.TRYON_CLEANUP_SECRET;
    vi.restoreAllMocks();
  });

  it.each([
    { label: 'missing runtime secret', runtimeSecret: undefined, token: SECRET },
    { label: 'missing bearer', runtimeSecret: SECRET, token: undefined },
    { label: 'wrong same-length bearer', runtimeSecret: SECRET, token: 'x'.repeat(SECRET.length) },
    { label: 'wrong-length bearer', runtimeSecret: SECRET, token: 'short' },
  ])('fails closed for $label', async ({ runtimeSecret, token }) => {
    if (runtimeSecret === undefined) delete process.env.TRYON_CLEANUP_SECRET;
    else process.env.TRYON_CLEANUP_SECRET = runtimeSecret;

    const response = await POST(request(token));

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(cleanupExpiredMock).not.toHaveBeenCalled();
    expect(sweepOrphansMock).not.toHaveBeenCalled();
  });

  it('runs fixed bounded cleanup operations and logs counts plus correlation only', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    const response = await POST(request(SECRET));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      correlationId: expect.any(String),
      data: {
        expired: { scanned: 2, deleted: 2, failed: 0 },
        orphans: {
          foldersScanned: 3,
          objectsScanned: 2,
          candidates: 1,
          deleted: 1,
          skipped: 1,
          failed: 0,
        },
        failedOperations: 0,
      },
    });
    expect(cleanupExpiredMock).toHaveBeenCalledWith(50);
    expect(sweepOrphansMock).toHaveBeenCalledWith(25);
    expect(info).toHaveBeenCalledWith(
      '[try-on-cleanup] completed',
      expect.objectContaining({ correlationId: body.correlationId, failedOperations: 0 }),
    );
    const logText = JSON.stringify(info.mock.calls);
    expect(logText).not.toContain(SECRET);
    expect(logText).not.toContain(PATH_CANARY);
    expect(logText).not.toContain('myshopify.com');
  });

  it('fails the run when fulfilled cleanup summaries report partial failures across tenants', async () => {
    cleanupExpiredMock.mockResolvedValue({ scanned: 6, deleted: 4, failed: 2 });
    sweepOrphansMock.mockResolvedValue({
      foldersScanned: 5,
      objectsScanned: 4,
      candidates: 3,
      deleted: 2,
      skipped: 1,
      failed: 1,
    });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoLog = vi.spyOn(console, 'info').mockImplementation(() => {});

    const response = await POST(request(SECRET));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({
      ok: false,
      correlationId: expect.any(String),
      error: 'Try-on cleanup did not complete.',
      data: {
        expired: { scanned: 6, deleted: 4, failed: 2 },
        orphans: {
          foldersScanned: 5,
          objectsScanned: 4,
          candidates: 3,
          deleted: 2,
          skipped: 1,
          failed: 1,
        },
        failedOperations: 3,
      },
    });
    expect(errorLog).toHaveBeenCalledWith(
      '[try-on-cleanup] failed',
      expect.objectContaining({ correlationId: body.correlationId, failedOperations: 3 }),
    );
    expect(infoLog).not.toHaveBeenCalled();
  });

  it('fails one run visibly and lets the next schedule retry the backlog', async () => {
    cleanupExpiredMock
      .mockRejectedValueOnce(new Error(`storage unavailable: ${PATH_CANARY}`))
      .mockResolvedValueOnce({ scanned: 4, deleted: 4, failed: 0 });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoLog = vi.spyOn(console, 'info').mockImplementation(() => {});

    const failed = await POST(request(SECRET));
    const failedBody = await failed.json();
    const retried = await POST(request(SECRET));

    expect(failed.status).toBe(500);
    expect(failedBody).toMatchObject({
      ok: false,
      data: {
        expired: null,
        failedOperations: 1,
      },
    });
    expect(retried.status).toBe(200);
    expect(cleanupExpiredMock).toHaveBeenCalledTimes(2);
    expect(sweepOrphansMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(PATH_CANARY);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(SECRET);
    expect(infoLog).toHaveBeenCalledTimes(1);
  });
});
