import type { PreTokenGenerationTriggerEvent } from 'aws-lambda';

import type { PreTokenGenerationRequest } from '@lambda-event-router/cognito';

// Handlers modify the cloned event and return it
export async function preTokenGeneration(request: PreTokenGenerationRequest): Promise<PreTokenGenerationTriggerEvent> {
  const { event, triggerSource } = request;

  console.log(`Token generation for: ${event.userName}`);
  console.log(`Trigger: ${triggerSource}`);
  console.log(`Groups: ${event.request.groupConfiguration.groupsToOverride?.join(', ') || 'none'}`);

  // Add custom claims to the token
  event.response.claimsOverrideDetails = {
    claimsToAddOrOverride: {
      // Add custom claims
      'custom:tier': event.request.userAttributes['custom:tier'] || 'free',
      'custom:org_id': event.request.userAttributes['custom:org_id'] || '',
    },
    // Optionally suppress certain claims
    // claimsToSuppress: ['email'],
    // Override group configuration
    // groupOverrideDetails: {
    //   groupsToOverride: ['admin', 'users'],
    // },
  };

  return event;
}
