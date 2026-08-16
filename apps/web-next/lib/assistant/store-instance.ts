import { InMemoryStore } from './rate-limiter-store';

/* One shared instance for the whole process, so every route handler draws
   against the same budget for a given tenant. Swap for a Redis-backed store
   here (same RateLimiterStore interface) the moment this runs on more than
   one server instance. */
export const store = new InMemoryStore();
