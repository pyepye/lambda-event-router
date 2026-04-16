import { defineRoute } from '@lambda-event-router/codecommit';

import { REPO_NAME } from '../constants.js';

// Match branch deletion events
export const branchDeletedRoute = defineRoute({
  filters: {
    repositoryName: REPO_NAME,
  },
}).handle(async ({ references, userIdentityARN }) => {
  for (const reference of references) {
    console.log(`Branch deleted: ${reference.ref} by ${userIdentityARN}`);
  }
});
