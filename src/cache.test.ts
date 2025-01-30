import test from "node:test";
import crypto from "crypto";
import Redis from "ioredis";
import assert from "assert/strict";
import { nullLogger } from "@loke/logger";

import { Cache, LruMemoryCacheStore, RedisCacheStore } from ".";

const randomId = () => crypto.randomBytes(16).toString("hex");

const { REDIS_HOST = "localhost" } = process.env;

test("apply - should be able to apply caching to a function", async (t) => {
  const id = randomId();

  const redisClient = new Redis(REDIS_HOST);
  t.after(() => redisClient.quit());

  const cache = new Cache(
    "test:{id}",
    [new LruMemoryCacheStore({ max: 10 }), new RedisCacheStore(redisClient)],
    nullLogger,
  );

  let callCount = 0;

  const testFn = async () => {
    callCount++;
    return { value: "bar", ttl: 30000 };
  };

  assert.equal(await cache.apply({ id }, testFn), "bar");
  assert.equal(callCount, 1);
  assert.equal(await cache.apply({ id }, testFn), "bar");
  assert.equal(callCount, 1);
});

test("apply - number keys should be valid", async (t) => {
  const id = Math.floor(Math.random() * 1000);

  const redisClient = new Redis(REDIS_HOST);
  t.after(() => redisClient.quit());

  const cache = new Cache(
    "test-number:{id}",
    [new LruMemoryCacheStore({ max: 10 }), new RedisCacheStore(redisClient)],
    nullLogger,
  );

  let callCount = 0;

  const testFn = async () => {
    callCount++;
    return { value: "bar", ttl: 30000 };
  };

  assert.equal(await cache.apply({ id }, testFn), "bar");
  assert.equal(callCount, 1);
  assert.equal(await cache.apply({ id }, testFn), "bar");
  assert.equal(callCount, 1);
});

test("apply - should only need to call service once in parallel (single flight)", async (t) => {
  const id = randomId();
  let applyCount = 0;
  let callCount = 0;

  const redisClient = new Redis(REDIS_HOST);
  t.after(() => redisClient.quit());

  const cache = new Cache(
    "test:{id}",
    [new LruMemoryCacheStore({ max: 10 }), new RedisCacheStore(redisClient)],
    nullLogger,
  );

  let resolveAllApplied: (_: unknown) => void;
  const allApplied = new Promise((r) => (resolveAllApplied = r));

  async function testFn() {
    const p = cache.apply({ id }, async () => {
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

test("apply - should pass through errors", async (t) => {
  const id = randomId();

  const redisClient = new Redis(REDIS_HOST);
  t.after(() => redisClient.quit());

  const cache = new Cache(
    "test:{id}",
    [new LruMemoryCacheStore({ max: 10 }), new RedisCacheStore(redisClient)],
    nullLogger,
  );

  const errToThrow = new Error("test error");

  const testFn = async () => {
    throw errToThrow;
  };

  try {
    await cache.apply({ id }, testFn);
    assert.fail("should have thrown");
  } catch (err) {
    assert.equal(err, errToThrow);
  }
});
