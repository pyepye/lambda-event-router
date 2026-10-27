import type { PostConfirmationTriggerEvent } from 'aws-lambda';

import { logger } from '@latcher/base';
import type { PostConfirmationRequest } from '@latcher/cognito';

import { uploadAvatarForUserName } from '../utils/gravatar.js';

export async function postConfirmation(request: PostConfirmationRequest): Promise<PostConfirmationTriggerEvent> {
  const { event } = request;
  const { userName } = event;
  const email = event.request.userAttributes.email;

  if (!email) {
    throw new Error(`No email attribute found for user ${userName}`);
  }

  await uploadAvatarForUserName(email, userName);
  logger.info({ message: 'Avatar created for new user', userName });

  return event;
}
