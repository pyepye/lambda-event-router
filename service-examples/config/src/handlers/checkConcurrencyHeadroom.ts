import { defineConfigScheduledRoute } from '@latcher/config';

import { configRuleName } from '../environment.js';

// Always throws, which is the only periodic failure that comes from a handler rather than from routing
// or a schema. The matcher middleware has run by the time it throws.
export const checkConcurrencyHeadroom = defineConfigScheduledRoute({
  filters: {
    configRuleName: configRuleName('concurrencyHeadroom'),
  },
}).handle(async (request) => {
  throw new Error(`Concurrency metrics unavailable for account ${request.accountId}`);
});
