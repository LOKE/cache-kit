import test from "node:test";

import { LruMemoryCacheStore } from ".";
import { testCache } from "./storetest";

test("LruMemoryCacheStore - testCache", async (t) => {
  const cache = new LruMemoryCacheStore({ max: 100 });

  await testCache(t, cache);
});
