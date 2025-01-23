import { TestContext } from "node:test";
import assert from "node:assert/strict";

import type { Cache } from "./cache";

export async function testCache(t: TestContext, cache: Cache<unknown>) {
  assert.deepEqual(await cache.get("unset"), undefined);

  const cases = [
    { key: "null", value: null },
    { key: "string", value: "foo" },
    { key: "number", value: 1 },
    { key: "object", value: { a: 1, b: "c" } },
  ];

  for (const { key, value } of cases) {
    await t.test(`should be able to put and get ${key}`, async () => {
      const expiresAt = Date.now() + 5000;
      await cache.set(key, { value, expiresAt });

      assert.deepEqual(await cache.get(key), { value, expiresAt });

      await cache.delete(key);

      assert.equal(await cache.get(key), undefined);
    });
  }
}
