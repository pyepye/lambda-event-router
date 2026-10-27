import { logger } from '@latcher/base';
import { defineRoute } from '@latcher/cognito';

export const provisionUser = defineRoute({
  filters: { triggerSource: 'PostConfirmation_ConfirmSignUp' },
}).handle(async ({ event, userAttributes }) => {
  logger.info({ message: 'User provisioned', userName: event.userName, email: userAttributes.email });

  return event;
});

export const recordPasswordReset = defineRoute({
  filters: { triggerSource: 'PostConfirmation_ConfirmForgotPassword' },
}).handle(async ({ event }) => {
  logger.info({ message: 'Password reset completed', userName: event.userName });

  return event;
});
