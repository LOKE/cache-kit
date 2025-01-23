import test from "node:test";

import { InMemoryCache } from ".";
import { testCache } from "./cachetest";

test("InMemoryCache - testCache", async (t) => {
  const cache = new InMemoryCache({ max: 100 });

  await testCache(t, cache);
});
