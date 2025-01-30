import { exponentialBuckets, Histogram } from "prom-client";
import type {
  Redis as IORedisClient,
  Cluster as IORedisCluster,
} from "ioredis";

import { CacheStore, StoreEntity } from "./store";
import { metrics } from "./metrics";

const cacheValueSize = new Histogram({
  name: "cache_redis_value_size_bytes",
  help: "Latency of cache lookup",
  labelNames: ["key"],
  buckets: exponentialBuckets(100, 10, 5),
  registers: [],
});

metrics.push(cacheValueSize);

type Client = Pick<IORedisClient | IORedisCluster, "get" | "set" | "del">;

export class RedisCacheStore<T> implements CacheStore<T> {
  private keyTemplate: string | null = null;

  constructor(private client: Client) {}

  setKeyTemplate(keyTemplate: string) {
    if (this.keyTemplate !== null) {
      throw new Error("Cannot change key template");
    }

    this.keyTemplate = keyTemplate;
  }

  async get(key: string): Promise<StoreEntity<T> | undefined> {
    const rawData = await this.client.get(key);

    if (rawData === null) return undefined;

    return JSON.parse(rawData);
  }

  async set(key: string, record: StoreEntity<T>): Promise<void> {
    const buf = Buffer.from(JSON.stringify(record), "utf8");

    if (this.keyTemplate !== null) {
      cacheValueSize.observe({ key: this.keyTemplate }, buf.length);
    }

    await this.client.set(key, buf, "PX", record.expiresAt - Date.now());
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}
