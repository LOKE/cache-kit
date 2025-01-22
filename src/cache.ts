export type Key = string;

export type Cache<T> = {
  get: (key: Key) => Promise<T | undefined> | undefined;
  set: (key: Key, value: Promise<T | undefined>, ttl: number) => Promise<void>;
  delete: (key: Key) => Promise<void>;
};

export type Resolver<T> = Pick<Cache<T>, "get">;
