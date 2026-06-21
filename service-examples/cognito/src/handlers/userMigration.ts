import { logger } from '@lambda-event-router/base';
import type { UserMigrationRequest } from '@lambda-event-router/cognito';
import type { UserMigrationTriggerEvent } from 'aws-lambda';

import { findLegacyApplicant } from '../utils/legacyPortal.js';

// Registered through the family method, so both migration sources land here. A UserMigration event
// carries no user, so request.userAttributes is empty and a userAttributesSchema on this route would
// fail every event.
export async function migrateLegacyApplicant({
  event,
  triggerSource,
}: UserMigrationRequest): Promise<UserMigrationTriggerEvent> {
  const applicant = findLegacyApplicant(event.userName);
  if (!applicant) throw new Error(`No legacy record for ${event.userName}`);

  const signingIn = triggerSource === 'UserMigration_Authentication';
  if (signingIn && event.request.password !== applicant.password) {
    throw new Error(`Legacy password rejected for ${event.userName}`);
  }

  event.response.userAttributes = {
    email: applicant.email,
    email_verified: 'true',
    'custom:programme': applicant.programme,
  };
  // A forgot-password migration has no password to carry over, so the user has to set one.
  event.response.finalUserStatus = signingIn ? 'CONFIRMED' : 'RESET_REQUIRED';
  event.response.desiredDeliveryMediums = ['EMAIL'];
  // A sign-in needs no welcome mail. A reset does, because the code travels in it.
  if (signingIn) event.response.messageAction = 'SUPPRESS';

  logger.info({ message: 'Legacy applicant migrated', userName: event.userName, triggerSource });

  return event;
}
