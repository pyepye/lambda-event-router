import { defineRoute } from '@lambda-event-router/cognito';

// PreTokenGeneration - add custom claims to tokens
// Handlers modify the cloned event and return it
export const preTokenGenerationRoute = defineRoute({
  filters: {
    triggerSource: ['TokenGeneration_Authentication', 'TokenGeneration_RefreshTokens'],
  },
}).handle(async ({ event }) => {
  console.log(`Token generation for: ${event.userName}`);
  console.log(`Groups: ${event.request.groupConfiguration.groupsToOverride?.join(', ') || 'none'}`);

  event.response.claimsOverrideDetails = {
    claimsToAddOrOverride: {
      'custom:tier': event.request.userAttributes['custom:tier'] || 'free',
      'custom:org_id': event.request.userAttributes['custom:org_id'] || '',
    },
  };

  return event;
});
