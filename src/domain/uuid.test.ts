import { afterEach, describe, expect, it, vi } from "vitest";
import { createUuid } from "./uuid";

const webcrypto = globalThis.crypto;
const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
afterEach(() => vi.unstubAllGlobals());

describe("UUID creation on secure and HTTP origins", () => {
  it("prefers native randomUUID and preserves its receiver", () => {
    const expected = "01234567-89ab-4def-8123-456789abcdef";
    const crypto = {
      randomUUID: vi.fn(function (this: unknown) {
        expect(this).toBe(crypto);
        return expected;
      }),
      getRandomValues: vi.fn(),
    };
    vi.stubGlobal("crypto", crypto);
    expect(createUuid()).toBe(expected);
    expect(crypto.randomUUID).toHaveBeenCalledOnce();
    expect(crypto.getRandomValues).not.toHaveBeenCalled();
  });

  it.each([
    [0, "00000000-0000-4000-8000-000000000000"],
    [255, "ffffffff-ffff-4fff-bfff-ffffffffffff"],
  ])(
    "sets version and variant bits for random bytes filled with %i",
    (byte, expected) => {
      const crypto = {
        getRandomValues: vi.fn(function (this: unknown, bytes: Uint8Array) {
          expect(this).toBe(crypto);
          expect(bytes).toBeInstanceOf(Uint8Array);
          expect(bytes).toHaveLength(16);
          return bytes.fill(byte);
        }),
      };
      vi.stubGlobal("crypto", crypto);
      expect(createUuid()).toBe(expected);
      expect(crypto.getRandomValues).toHaveBeenCalledOnce();
    },
  );

  it("generates distinct valid UUIDs using real getRandomValues without randomUUID", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
    });
    const ids = Array.from({ length: 1000 }, createUuid);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(uuidV4);
  });

  it.each([undefined, {}])(
    "reports browsers without Web Crypto (%j)",
    (crypto) => {
      vi.stubGlobal("crypto", crypto);
      expect(createUuid).toThrow("此浏览器不支持 Web Crypto");
    },
  );
});
