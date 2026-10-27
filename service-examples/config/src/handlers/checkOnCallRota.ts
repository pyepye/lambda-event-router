import { defineRoute } from '@latcher/config';

import { OWNER_TAG } from '../config.js';
import { configRuleName } from '../environment.js';
import { withOwnerContext } from '../middleware/withOwnerContext.js';

// Always throws, which is the only change-triggered failure that comes from a handler rather than from
// routing or a schema. Both middleware have run by the time it throws.
export const checkOnCallRota = defineRoute({
  filters: {
    configRuleName: configRuleName('onCallRota'),
  },
  middleware: [withOwnerContext],
}).handle(async (request) => {
  const owner = request.configurationItem?.tags[OWNER_TAG] ?? 'unknown';
  throw new Error(`On-call directory unavailable for team ${owner}`);
});
