import { LRUCache } from "lru-cache";
import { Cache, Key, Record } from "./cache";

type Options<T> =
  | {
      max: number;
    }
  | {
      maxSize: number;
      sizeCalculation: (value: Record<T>, key: string) => number;
    };

export class InMemoryCache<T> implements Cache<T> {
  private cache: LRUCache<string, Record<T>>;

  constructor(opts: Options<T>) {
    this.cache = new LRUCache<string, Record<T>>(opts);
  }

  async get(key: Key): Promise<Record<T> | undefined> {
    return this.cache.get(key);
  }

  set(key: Key, record: Record<T>): Promise<void> {
    const ttl = record.expiresAt - Date.now();

    this.cache.set(key, record, { ttl });

    return Promise.resolve();
  }

  delete(key: Key): Promise<void> {
    this.cache.delete(key);

    return Promise.resolve();
  }
}
