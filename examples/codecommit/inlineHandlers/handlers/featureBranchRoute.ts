import { defineRoute } from '@lambda-event-router/codecommit';

import { REPO_NAME } from '../constants.js';

// Match any activity on branches prefixed with 'feature/'
export const featureBranchRoute = defineRoute({
  filters: {
    repositoryNames: [REPO_NAME],
    branchPrefixes: ['feature/'],
  },
}).handle(async ({ references, userIdentityARN }) => {
  for (const reference of references) {
    console.log(`Feature branch activity: ${reference.ref} commit ${reference.commit} by ${userIdentityARN}`);
  }
});
