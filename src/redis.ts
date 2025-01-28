import { exponentialBuckets, Histogram } from "prom-client";
import { Cache, Entity } from "./cache";

import type {
  Redis as IORedisClient,
  Cluster as IORedisCluster,
} from "ioredis";

const cacheValueSize = new Histogram({
  name: "cache_redis_value_size_bytes",
  help: "Latency of cache lookup",
  labelNames: ["key"],
  buckets: exponentialBuckets(100, 10, 5),
  registers: [],
});

type Client = Pick<IORedisClient | IORedisCluster, "get" | "set" | "del">;

export class RedisCache<T> implements Cache<T> {
  private keyTemplate: string | null = null;

  constructor(private client: Client) {}

  setKeyTemplate(keyTemplate: string) {
    if (this.keyTemplate !== null) {
      throw new Error("Cannot change key template");
    }

    this.keyTemplate = keyTemplate;
  }

  async get(key: string): Promise<Entity<T> | undefined> {
    const rawData = await this.client.get(key);

    if (rawData === null) return undefined;

    return JSON.parse(rawData);
  }

  async set(key: string, record: Entity<T>): Promise<void> {
    const buf = Buffer.from(JSON.stringify(record), "utf8");

    if (this.keyTemplate !== null) {
      // JS UTF-16 is 2 bytes per char, 🤞redis client isn't using utf8
      cacheValueSize.observe({ key: this.keyTemplate }, buf.length);
    }

    await this.client.set(key, buf, "PX", record.expiresAt - Date.now());
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}
