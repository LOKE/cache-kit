import test from "node:test";

import { LruMemoryCache } from ".";
import { testCache } from "./cachetest";

test("LruMemoryCache - testCache", async (t) => {
  const cache = new LruMemoryCache({ max: 100 });

  await testCache(t, cache);
});
