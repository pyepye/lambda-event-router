import { defineRoute } from '@lambda-event-router/codecommit';

import { REPO_NAME } from '../constants.js';

// Match branch creation events
export const branchCreatedRoute = defineRoute({
  filters: {
    repositoryNames: [REPO_NAME],
  },
}).handle(async ({ references, userIdentityARN }) => {
  for (const reference of references) {
    console.log(`Branch created: ${reference.ref} at commit ${reference.commit} by ${userIdentityARN}`);
  }
});
