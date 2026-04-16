import { defineRoute } from '@lambda-event-router/cognito';

// PreAuthentication - validate user before authentication proceeds
// Handlers modify the cloned event and return it
export const preAuthenticationRoute = defineRoute({
  filters: {
    triggerSource: 'PreAuthentication_Authentication',
  },
}).handle(async ({ event }) => {
  console.log(`Pre-authentication check: ${event.userName}`);
  console.log(`Client: ${event.callerContext.clientId}`);

  // Check for suspicious activity
  if (event.request.validationData?.suspicious === 'true') {
    throw new Error('Suspicious login attempt detected');
  }

  // PreAuthentication has no response fields to modify
  return event;
});
