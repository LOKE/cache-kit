import test from "node:test";
import crypto from "crypto";
import Redis from "ioredis";
import assert from "assert/strict";

import { CompositeCache, InMemoryCache, RedisCache } from "./index";

const randomId = () => crypto.randomBytes(16).toString("hex");

const { REDIS_HOST = "localhost" } = process.env;

test("apply - should be able to apply caching to a function", async (t) => {
  const key = randomId(); // cacheKey`${randomId()}:$`;

  const redisClient = new Redis(REDIS_HOST);
  t.after(() => redisClient.quit());

  const cache = new CompositeCache([
    new InMemoryCache({ max: 10 }),
    new RedisCache(redisClient, "test"),
  ]);

  let callCount = 0;

  const testFn = async () => {
    callCount++;
    return { value: "bar", ttl: 30000 };
  };

  assert.equal(await cache.apply(key, testFn), "bar");
  assert.equal(callCount, 1);
  assert.equal(await cache.apply(key, testFn), "bar");
  assert.equal(callCount, 1);
});

test("apply - should only need to call service once in parallel (single flight)", async (t) => {
  const key = randomId(); // cacheKey`${randomId()}:$`;
  let applyCount = 0;
  let callCount = 0;

  const redisClient = new Redis(REDIS_HOST);
  t.after(() => redisClient.quit());

  const cache = new CompositeCache([
    new InMemoryCache({ max: 10 }),
    new RedisCache(redisClient, "test"),
  ]);

  let resolveAllApplied: (_: unknown) => void;
  const allApplied = new Promise((r) => (resolveAllApplied = r));

  async function testFn() {
    const p = cache.apply(key, async () => {
      callCount++;

      await allApplied;

      return { value: "bar", ttl: 30000 };
    });

    // Wait till all 5 requests are queued before resolving the first one
    if (++applyCount === 5) setTimeout(resolveAllApplied, 10);

    return p;
  }

  const [first, , , , last] = await Promise.all([
    testFn(),
    testFn(),
    testFn(),
    testFn(),
    testFn(),
  ]);

  assert.equal(first, "bar");
  assert.equal(last, "bar");
  assert.equal(callCount, 1);
});
