import { type CodeCommitFilterInput, defineRoute } from '@lambda-event-router/codecommit';

import { REPO_NAME } from '../constants.js';

// Match pushes to the main branch (commits pushed to an existing branch)
export const pushRoute = defineRoute({
  filters: {
    repositoryName: REPO_NAME,
    branch: 'main',
  },
}).handle(async ({ references, userIdentityARN, eventTriggerName }) => {
  for (const reference of references) {
    console.log(`Push to main: commit ${reference.commit} by ${userIdentityARN}`);
    console.log(`Trigger: ${eventTriggerName}`);
  }
});

// Match pushes by deploy bot to any branch using custom filter
export const deployBotPushRoute = defineRoute({
  filters: {
    repositoryName: REPO_NAME,
    custom: ({ userIdentityARN }: CodeCommitFilterInput) => {
      // Match automated pushes from the deploy bot IAM role
      const deployBotIdentifier = 'deploy-bot';
      return userIdentityARN.includes(deployBotIdentifier);
    },
  },
}).handle(async ({ references, userIdentityARN }) => {
  for (const reference of references) {
    console.log(`Deploy bot push: ${reference.ref} at ${reference.commit} by ${userIdentityARN}`);
  }
});
