# LOKE cache-kit

## Examples

### Basic usage

For the most common cases you a simple 2 layer LRU + Redis cache is sufficient.

```typescript
import { CompositeCache, RedisCache LruCache } from '@loke/cache-kit';
import Redis from "ioredis";
import { create as createLogger } from "@loke/logger";


const logger = createLogger();
const redisClient = new Redis(process.env.REDIS_HOST);


const cache = new CompositeCache(
  "users:{userId}"
    // Caches will be checked in order, and the first cache to return a value
    // will be used
  [
    new LruCache({ max: 1000 }),
    new RedisCache(redisClient, "tidy-api"),
  ],
  logger
);


const userId = 123;

const user = cache.apply(
  { userId },
  async () => {
    // This function will only be called if the cache is empty
    const value = await fetchUser(userId);

    // the ttl is returned as part of the result so it can vary per request
    return {
      value,
      ttl: 60 * 60 * 1000, // 1 hour in milliseconds
    };
  }
);
```

### Single flight cache

In cases where you don't want the overhead of storing the value in a cache, you
can use a single flight cache. Concurrent requests will piggyback on the result
of the first request.

```typescript
import { CompositeCache } from '@loke/cache-kit';
import { create as createLogger } from "@loke/logger";


const logger = createLogger();


const cache = new CompositeCache(
  "users:{userId}"
  // An empty list of caches will result in a single flight only cache, where
  // the value is only cached for the duration of the request
  [],
  logger
);
```

## TODO

- [ ] JSON reviver support
