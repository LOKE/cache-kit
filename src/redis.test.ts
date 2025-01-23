import test from "node:test";
import Redis from "ioredis";

import { RedisCache } from ".";
import { testCache } from "./cachetest";

const { REDIS_HOST = "localhost" } = process.env;

test("RedisCache", async (t) => {
  const redisClient = new Redis(REDIS_HOST);
  t.after(() => redisClient.quit());

  const cache = new RedisCache(redisClient, "test");

  await testCache(t, cache);
});
