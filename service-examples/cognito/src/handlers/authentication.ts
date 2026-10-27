import { logger } from '@latcher/base';
import { defineRoute } from '@latcher/cognito';

const WITHDRAWN_PROGRAMME = 'msc-withdrawn';

// A withdrawn applicant keeps their account but cannot sign in. Throwing here stops Cognito before it
// checks the password.
export const blockWithdrawnApplicant = defineRoute({
  filters: { triggerSource: 'PreAuthentication_Authentication' },
}).handle(async ({ event, userAttributes }) => {
  if (userAttributes['custom:programme'] === WITHDRAWN_PROGRAMME) {
    throw new Error(`Applicant ${event.userName} has withdrawn`);
  }

  logger.info({ message: 'Sign-in allowed', userName: event.userName });

  return event;
});

export const logSignIn = defineRoute({
  filters: { triggerSource: 'PostAuthentication_Authentication' },
}).handle(async ({ event }) => {
  logger.info({
    message: 'Sign-in completed',
    userName: event.userName,
    newDeviceUsed: event.request.newDeviceUsed,
  });

  return event;
});
