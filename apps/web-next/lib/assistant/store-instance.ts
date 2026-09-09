import { RedisBudgetStore } from './distributed-budget';

/* Process restarts and extra replicas must not refill a visitor's budget.
   The in-memory adapter is retained only for deterministic unit tests. */
export const store = new RedisBudgetStore();
