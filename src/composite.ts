import { Cache, Key, Record } from "./cache";

export class CompositeCache<T> implements Cache<T> {
  constructor(private caches: Cache<T>[]) {}

  async get(key: string): Promise<Record<T> | undefined> {
    for (const cache of this.caches) {
      const value = await cache.get(key);
      if (value !== undefined) return value;
    }

    return undefined;
  }

  async set(
    key: string,
    record: Promise<Record<T> | undefined>
  ): Promise<void> {
    await Promise.all(this.caches.map((cache) => cache.set(key, record)));
  }

  async delete(key: string): Promise<void> {
    await Promise.all(this.caches.map((cache) => cache.delete(key)));
  }

  async apply(
    key: Key,
    promiseFn: () => Promise<{ value: T; ttl: number }>
  ): Promise<T> {
    for (let i = 0; i < this.caches.length; i++) {
      const recordP = this.caches[i].get(key);
      if (recordP == undefined) continue;

      // Backfill caches
      for (let j = 0; j < i; j++) {
        // TODO: catch and log
        this.caches[j].set(key, recordP);
      }

      const record = await recordP;

      if (record !== undefined) return record.value;
    }

    // TODO: handle errors
    const recordP = promiseFn().then((result) => {
      return {
        value: result.value,
        expiresAt: Date.now() + result.ttl,
      };
    });

    for (const cache of this.caches) {
      // TODO: catch and log
      cache.set(key, recordP);
    }

    const record = await recordP;

    return record?.value;
  }
}
