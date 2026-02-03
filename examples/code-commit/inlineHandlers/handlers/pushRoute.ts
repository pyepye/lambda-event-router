import { defineRoute } from '@lambda-event-router/code-commit';

import { REPO_NAME } from '../constants.js';

// Match pushes to the main branch (commits pushed to an existing branch)
export const pushRoute = defineRoute({
  filters: {
    repositoryNames: [REPO_NAME],
    branches: ['main'],
  },
}).handle(async ({ references, userIdentityARN, eventTriggerName }) => {
  for (const reference of references) {
    console.log(`Push to main: commit ${reference.commit} by ${userIdentityARN}`);
    console.log(`Trigger: ${eventTriggerName}`);
  }
});
