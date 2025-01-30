import { Counter, Histogram } from "prom-client";
import { metrics } from "./metrics";

import { CacheStore } from "./store";

const queryCount = new Counter({
  name: "cache_queries_total",
  help: "Total number of cache lookups made.",
  labelNames: ["key"],
  registers: [],
});
const hitCount = new Counter({
  name: "cache_hits_total",
  help: "Total number of cache hits",
  labelNames: ["key", "layer"],
  registers: [],
});
const queryDuration = new Histogram({
  name: "cache_query_duration_seconds",
  help: "Latency of cache lookup",
  labelNames: ["key"],
  registers: [],
});

const serviceQueryCount = new Counter({
  name: "cached_service_queries_total",
  help: "Number of lookups made to cache backing services",
  labelNames: ["key"],
  registers: [],
});
const serviceQueryDuration = new Histogram({
  name: "cached_service_query_duration_seconds",
  help: "Cached backing service latencies in seconds.",
  labelNames: ["key"],
  registers: [],
});

metrics.push(
  queryCount,
  hitCount,
  queryDuration,
  serviceQueryCount,
  serviceQueryDuration,
);

export class Cache<const KT extends string> {
  private inflights = new Map<string, Promise<unknown>>();
  private formatKey: (params: KeyParams<KT>) => string;

  constructor(
    private keyTemplate: KT,
    private caches: CacheStore<unknown>[],
    private logger: {
      error: (message?: string, ...optionalParams: string[]) => void;
    },
  ) {
    this.formatKey = parseKeyTemplate(keyTemplate);

    for (const cache of this.caches) {
      cache.setKeyTemplate(keyTemplate);
    }

    queryCount.inc({ key: this.keyTemplate }, 0);
    hitCount.inc({ key: this.keyTemplate, layer: 0 }, 0);
    serviceQueryCount.inc({ key: this.keyTemplate }, 0);
  }

  async get(params: KeyParams<KT>): Promise<unknown | undefined> {
    for (const cache of this.caches) {
      const entry = await cache.get(this.formatKey(params));
      if (entry !== undefined) return entry.value;
    }

    return undefined;
  }

  async set(params: KeyParams<KT>, value: unknown, ttl: number): Promise<void> {
    const entity = {
      value,
      expiresAt: Date.now() + ttl,
    };

    await Promise.all(
      this.caches.map((cache) => cache.set(this.formatKey(params), entity)),
    );
  }

  async delete(params: KeyParams<KT>): Promise<void> {
    await Promise.all(
      this.caches.map((cache) => cache.delete(this.formatKey(params))),
    );
  }

  apply<V>(
    params: KeyParams<KT>,
    promiseFn: () => Promise<{ value: V; ttl: number }>,
  ): Promise<V> {
    queryCount.inc({ key: this.keyTemplate });
    const endHitTimer = queryDuration.startTimer({ key: this.keyTemplate });

    const key = this.formatKey(params);
    let inflight = this.inflights.get(key);

    if (!inflight) {
      inflight = (async () => {
        try {
          for (let i = 0; i < this.caches.length; i++) {
            const record = await this.caches[i].get(key);
            if (record == undefined) continue;

            hitCount.inc({ key: this.keyTemplate, layer: i + 1 });
            endHitTimer();

            // Backfill caches
            for (let j = 0; j < i; j++) {
              this.caches[j].set(key, record).catch((err) => {
                this.logger.error("Failed to set cache", err);
              });
            }

            return record.value;
          }

          serviceQueryCount.inc({ key: this.keyTemplate });
          const endServiceTimer = serviceQueryDuration.startTimer({
            key: this.keyTemplate,
          });

          const record = await promiseFn().then((result) => {
            endServiceTimer();

            return {
              value: result.value,
              expiresAt: Date.now() + result.ttl,
            };
          });

          for (const cache of this.caches) {
            cache.set(key, record).catch((err) => {
              this.logger.error("Failed to set cache", err);
            });
          }

          return record?.value;
        } finally {
          this.inflights.delete(key);
        }
      })();

      this.inflights.set(key, inflight);
    } else {
      hitCount.inc({ key: this.keyTemplate, layer: 0 });
    }

    return inflight as Promise<V>;
  }
}

type KeyParams<T extends string> =
  T extends `${string}{${infer Param}}${infer Rest}`
    ? Record<Param, string | number> & KeyParams<Rest>
    : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      {};

function parseKeyTemplate<const T extends string>(keyTemplate: T) {
  return (params: KeyParams<T>): string => {
    return keyTemplate.replace(/{([^{}]+)}/g, (_, key) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      encodeURIComponent((params as any)[key]),
    );
  };
}
