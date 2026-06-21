import { logger } from '@lambda-event-router/base';
import type { PreTokenGenerationRequest } from '@lambda-event-router/cognito';
import { defineRoute } from '@lambda-event-router/cognito';
import type { PreTokenGenerationTriggerEvent } from 'aws-lambda';

// Refresh tokens get their own route so the claim says which grant produced the token. Registered
// ahead of addApplicantClaims, which the family method points at all five token sources.
export const markRefreshedToken = defineRoute({
  filters: { triggerSource: 'TokenGeneration_RefreshTokens' },
}).handle(async ({ event }) => {
  event.response.claimsOverrideDetails = {
    claimsToAddOrOverride: { portal: 'applicants', tokenSource: 'refresh' },
  };

  logger.info({ message: 'Refresh token claims added', userName: event.userName });

  return event;
});

export async function addApplicantClaims({
  event,
  userAttributes,
  triggerSource,
}: PreTokenGenerationRequest): Promise<PreTokenGenerationTriggerEvent> {
  event.response.claimsOverrideDetails = {
    claimsToAddOrOverride: {
      portal: 'applicants',
      tokenSource: 'sign-in',
      programme: userAttributes['custom:programme'] ?? 'unassigned',
    },
  };

  logger.info({ message: 'Sign-in token claims added', userName: event.userName, triggerSource });

  return event;
}
