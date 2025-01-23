export type Key = string;

export type Record<T> = {
  value: T;
  expiresAt: number;
};

export type Cache<T> = {
  get: (key: Key) => Promise<Record<T> | undefined>;
  set: (key: Key, record: Record<T>) => Promise<void>;
  delete: (key: Key) => Promise<void>;
};
