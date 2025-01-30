import test from "node:test";
import Redis from "ioredis";

import { RedisCacheStore } from ".";
import { testCache } from "./storetest";

const { REDIS_HOST = "localhost" } = process.env;

test("RedisCacheStore", async (t) => {
  const redisClient = new Redis(REDIS_HOST);
  t.after(() => redisClient.quit());

  const cache = new RedisCacheStore(redisClient);

  await testCache(t, cache);
});
