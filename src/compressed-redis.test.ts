import test from "node:test";
import assert from "node:assert/strict";
import Redis from "ioredis";

import { RedisCacheStore, CompressedRedisCacheStore } from ".";
import { testCache } from "./storetest";

const { REDIS_HOST = "localhost" } = process.env;

test("CompressedRedisCacheStore", async (t) => {
  const redisClient = new Redis(REDIS_HOST);
  t.after(() => redisClient.quit());

  const cache = new CompressedRedisCacheStore(redisClient);

  await testCache(t, cache);

  const uncompressedCache = new RedisCacheStore(redisClient);
  uncompressedCache.setKeyTemplate("-- test --");

  await t.test(
    "CompressedRedisCacheStore can read RedisCacheStore entries",
    async () => {
      const key = "object";
      const value = { a: 1, b: "c" };

      const expiresAt = Date.now() + 5000;
      await uncompressedCache.set(key, { value, expiresAt });

      assert.deepEqual(await cache.get(key), { value, expiresAt });

      await cache.delete(key);
    },
  );
  await t.test(
    "RedisCacheStore treats CachedRedisCacheStore entries as misses",
    async () => {
      const key = "object";
      const value = { a: 1, b: "c" };

      const expiresAt = Date.now() + 5000;
      await cache.set(key, { value, expiresAt });

      assert.deepEqual(await uncompressedCache.get(key), undefined);

      await cache.delete(key);
    },
  );
});
