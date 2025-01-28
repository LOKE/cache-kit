import { LRUCache } from "lru-cache";
import { Cache, Entity } from "./cache";

type Options<T> =
  | {
      max: number;
    }
  | {
      maxSize: number;
      sizeCalculation: (value: Entity<T>, key: string) => number;
    };

export class LruMemoryCache<T> implements Cache<T> {
  private cache: LRUCache<string, Entity<T>>;
  private keyTemplate: string | null = null;

  constructor(opts: Options<T>) {
    this.cache = new LRUCache<string, Entity<T>>(opts);
  }

  setKeyTemplate(keyTemplate: string) {
    if (this.keyTemplate !== null) {
      throw new Error("Cannot change key template");
    }

    this.keyTemplate = keyTemplate;
  }

  async get(key: string): Promise<Entity<T> | undefined> {
    return this.cache.get(key);
  }

  set(key: string, record: Entity<T>): Promise<void> {
    const ttl = record.expiresAt - Date.now();

    this.cache.set(key, record, { ttl });

    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.cache.delete(key);

    return Promise.resolve();
  }
}
