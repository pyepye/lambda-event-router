import { defineRoute } from '@lambda-event-router/secretsmanager';

// The testSecret step for the search index key always throws, which is the only route here that
// fails inside a handler rather than before one runs. The distinction shows in the log: this event
// has a logRotationStep line, and an unroutable event does not.
export const rejectIndexKey = defineRoute({
  filters: {
    secretId: /search\/index-key/,
  },
}).handle(async (request) => {
  throw new Error(`Search cluster rejected the pending key for ${request.secretId}`);
});
