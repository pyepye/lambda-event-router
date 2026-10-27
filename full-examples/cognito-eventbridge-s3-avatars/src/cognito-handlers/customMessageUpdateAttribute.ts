import type { CustomMessageTriggerEvent } from 'aws-lambda';

import { logger } from '@latcher/base';
import type { CustomMessageRequest } from '@latcher/cognito';

import { uploadAvatarForUserName } from '../utils/gravatar.js';

export async function customMessageUpdateAttribute(request: CustomMessageRequest): Promise<CustomMessageTriggerEvent> {
  const { event } = request;
  const { userName } = event;
  const newEmail = event.request.userAttributes.email;
  if (newEmail) {
    // Fires while Cognito is sending the verification code, before the user has confirmed they own the new email.
    // If they never enter the code, the avatar will remain pinned to the unverified email until the next change.
    await uploadAvatarForUserName(newEmail, userName);
    logger.info({ message: 'Avatar updated for new email', userName });
  }

  // codeParameter is the {####} placeholder. Cognito swaps the real code in after the handler returns.
  event.response.emailSubject = 'Verify your new email address';
  event.response.emailMessage = `Hi,\n\nYour verification code is: ${event.request.codeParameter}\n\nWe have already updated your avatar to match this new email address.`;
  event.response.smsMessage = `Your verification code is: ${event.request.codeParameter}`;

  return event;
}
