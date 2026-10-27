import type { CustomMessageTriggerEvent } from 'aws-lambda';

import { logger } from '@latcher/base';
import type { CustomMessageRequest } from '@latcher/cognito';

// Returning the event untouched leaves Cognito's own wording in place.
export async function keepDefaultMessage({
  event,
  triggerSource,
}: CustomMessageRequest): Promise<CustomMessageTriggerEvent> {
  logger.info({ message: 'Cognito default message left in place', userName: event.userName, triggerSource });

  return event;
}
