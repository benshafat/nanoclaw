/**
 * A platform rejection of rendered markup ("can't parse entities" — Telegram's
 * MarkdownV2 400) is deterministic per message, so the delivery poll's retries
 * can never succeed on it. The bridge resends once through the raw/plain path:
 * delivery outranks formatting (the 2026-09-24 silent-loss incident). Any
 * other error passes through untouched so the normal retry path still applies.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Adapter } from 'chat';

import { postTextWithPlainFallback } from './chat-sdk-bridge.js';

function adapterWith(postMessage: ReturnType<typeof vi.fn>): Adapter {
  return { postMessage } as unknown as Adapter;
}

describe('postTextWithPlainFallback', () => {
  it('passes a successful markdown post through untouched', async () => {
    const postMessage = vi.fn().mockResolvedValue({ id: 'm-1' });
    const result = await postTextWithPlainFallback(adapterWith(postMessage), 'tid-1', { markdown: 'hello' });
    expect(result).toEqual({ id: 'm-1' });
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith('tid-1', { markdown: 'hello' });
  });

  it("resends as raw text when the platform can't parse entities", async () => {
    const postMessage = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("Bad Request: can't parse entities: Can't find end of a URL at byte offset 1070"),
      )
      .mockResolvedValueOnce({ id: 'm-2' });
    const result = await postTextWithPlainFallback(adapterWith(postMessage), 'tid-1', { markdown: 'hello _world_' });
    expect(result).toEqual({ id: 'm-2' });
    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenLastCalledWith('tid-1', { raw: 'hello _world_' });
  });

  it('keeps files on the raw resend', async () => {
    const files = [{ data: Buffer.from('x'), filename: 'a.pdf' }];
    const postMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("can't parse entities"))
      .mockResolvedValueOnce({ id: 'm-3' });
    await postTextWithPlainFallback(adapterWith(postMessage), 'tid-1', { markdown: 'doc', files });
    expect(postMessage).toHaveBeenLastCalledWith('tid-1', { raw: 'doc', files });
  });

  it('rethrows other errors without a raw resend', async () => {
    const postMessage = vi.fn().mockRejectedValue(new Error('Too Many Requests: retry after 30'));
    await expect(postTextWithPlainFallback(adapterWith(postMessage), 'tid-1', { markdown: 'hello' })).rejects.toThrow(
      'Too Many Requests',
    );
    expect(postMessage).toHaveBeenCalledTimes(1);
  });
});
