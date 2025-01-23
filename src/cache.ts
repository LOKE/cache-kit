export type Key = string;

export type Record<T> = {
  value: T;
  expiresAt: number;
};

export type Cache<T> = {
  get: (key: Key) => Promise<Record<T> | undefined> | undefined;
  set: (key: Key, value: Promise<Record<T> | undefined>) => Promise<void>;
  delete: (key: Key) => Promise<void>;
};
