import { Cache, Key, Record } from "./cache";

export class CompositeCache<T> implements Cache<T> {
  private inflights = new Map<string, Promise<T>>();

  constructor(private caches: Cache<T>[]) {}

  async get(key: string): Promise<Record<T> | undefined> {
    for (const cache of this.caches) {
      const value = await cache.get(key);
      if (value !== undefined) return value;
    }

    return undefined;
  }

  async set(key: string, record: Record<T>): Promise<void> {
    await Promise.all(this.caches.map((cache) => cache.set(key, record)));
  }

  async delete(key: string): Promise<void> {
    await Promise.all(this.caches.map((cache) => cache.delete(key)));
  }

  apply(
    key: Key,
    promiseFn: () => Promise<{ value: T; ttl: number }>
  ): Promise<T> {
    let inflight = this.inflights.get(key);

    if (!inflight) {
      inflight = (async (): Promise<T> => {
        try {
          for (let i = 0; i < this.caches.length; i++) {
            const record = await this.caches[i].get(key);
            if (record == undefined) continue;

            // Backfill caches
            for (let j = 0; j < i; j++) {
              // TODO: catch and log
              this.caches[j].set(key, record);
            }

            return record.value;
          }

          // TODO: handle errors
          const record = await promiseFn().then((result) => {
            return {
              value: result.value,
              expiresAt: Date.now() + result.ttl,
            };
          });

          for (const cache of this.caches) {
            // TODO: catch and log
            cache.set(key, record);
          }

          return record?.value;
        } finally {
          this.inflights.delete(key);
        }
      })();

      this.inflights.set(key, inflight);
    }

    return inflight;
  }
}
