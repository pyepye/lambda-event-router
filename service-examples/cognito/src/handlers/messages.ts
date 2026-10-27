import { logger } from '@latcher/base';
import type { CustomMessageRequest } from '@latcher/cognito';
import { defineRoute } from '@latcher/cognito';
import type { CustomMessageTriggerEvent } from 'aws-lambda';

// codeParameter is the placeholder {####}, not the code itself. Cognito swaps the real code in after
// the handler returns, so the message has to keep the placeholder.
export const writeResetEmail = defineRoute({
  filters: { triggerSource: 'CustomMessage_ForgotPassword' },
}).handle(async ({ event }) => {
  event.response.emailSubject = 'Reset your applicant portal password';
  event.response.emailMessage = `Use ${event.request.codeParameter} to set a new password.`;

  logger.info({ message: 'Reset email written', userName: event.userName });

  return event;
});

// The family method catches every other message source, and returning the event untouched leaves
// Cognito's own wording in place.
export async function logDefaultMessage({
  event,
  triggerSource,
}: CustomMessageRequest): Promise<CustomMessageTriggerEvent> {
  logger.info({ message: 'Cognito default message left in place', userName: event.userName, triggerSource });

  return event;
}
