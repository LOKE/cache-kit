import { LRUCache } from "lru-cache";
import { Counter } from "prom-client";

import { CacheStore, StoreEntity } from "./store";
import { metrics } from "./metrics";

const evictionsCount = new Counter({
  name: "cache_lru_evictions_total",
  help: "Total number of cache evictions",
  labelNames: ["key"],
  registers: [],
});

const setCount = new Counter({
  name: "cache_lru_sets_total",
  help: "Total number of cache sets",
  labelNames: ["key"],
  registers: [],
});

metrics.push(evictionsCount, setCount);

type Options<T> =
  | {
      max: number;
    }
  | {
      maxSize: number;
      sizeCalculation: (value: StoreEntity<T>, key: string) => number;
    };

export class LruMemoryCacheStore<T> implements CacheStore<T> {
  private cache: LRUCache<string, StoreEntity<T>>;
  private keyTemplate: string | null = null;

  constructor(opts: Options<T>) {
    this.cache = new LRUCache<string, StoreEntity<T>>({
      dispose: (key, value, reason) => {
        if (reason === "evict") {
          if (!this.keyTemplate) throw new Error("Key template not set");
          evictionsCount.inc({ key: this.keyTemplate });
        }
      },
      ...opts,
    });
  }

  setKeyTemplate(keyTemplate: string) {
    if (this.keyTemplate !== null) {
      throw new Error("Cannot change key template");
    }

    this.keyTemplate = keyTemplate;

    evictionsCount.inc({ key: keyTemplate }, 0);
    setCount.inc({ key: keyTemplate }, 0);
  }

  async get(key: string): Promise<StoreEntity<T> | undefined> {
    return this.cache.get(key);
  }

  set(key: string, record: StoreEntity<T>): Promise<void> {
    const ttl = record.expiresAt - Date.now();

    this.cache.set(key, record, { ttl });

    if (!this.keyTemplate) throw new Error("Key template not set");
    setCount.inc({ key: this.keyTemplate });

    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.cache.delete(key);

    return Promise.resolve();
  }
}
