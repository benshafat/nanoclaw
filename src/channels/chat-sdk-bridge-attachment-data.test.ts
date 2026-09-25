/**
 * chat >= 4.41 may resolve fetchData() with an ArrayBuffer instead of a
 * Buffer. Stringifying an ArrayBuffer with toString('base64') yields the
 * literal "[object ArrayBuffer]" — which downstream base64-decoding turns
 * into a constant 12-byte stub for every attachment (the 2026-09-25 audio
 * regression). The encoder must produce the real bytes for every shape the
 * SDK can return.
 */
import { describe, expect, it } from 'vitest';

import { attachmentDataToBase64 } from './chat-sdk-bridge.js';

const BYTES = [0x4f, 0x67, 0x67, 0x53, 0x00, 0x02]; // "OggS" + 2 bytes
const EXPECTED = Buffer.from(BYTES).toString('base64');

describe('attachmentDataToBase64', () => {
  it('encodes a Buffer', () => {
    expect(attachmentDataToBase64(Buffer.from(BYTES))).toBe(EXPECTED);
  });

  it('encodes an ArrayBuffer', () => {
    const ab = new Uint8Array(BYTES).buffer;
    expect(attachmentDataToBase64(ab)).toBe(EXPECTED);
  });

  it('encodes a Uint8Array view', () => {
    // Not in the declared union, but cheap to survive if the SDK drifts again.
    const view = new Uint8Array(BYTES);
    expect(attachmentDataToBase64(view as unknown as Buffer)).toBe(EXPECTED);
  });

  it('never produces the "[object ArrayBuffer]" stub', () => {
    const ab = new Uint8Array(BYTES).buffer;
    expect(attachmentDataToBase64(ab)).not.toContain('object');
  });
});
