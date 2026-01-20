import { defineRoute } from '@lambda-event-router/cognito';

// PostAuthentication - log successful logins
// Handlers modify the cloned event and return it
export const postAuthenticationRoute = defineRoute({
  filters: {
    triggerSources: ['PostAuthentication_Authentication'],
  },
}).handle(async ({ event }) => {
  console.log(`Successful login: ${event.userName}`);
  console.log(`Client: ${event.callerContext.clientId}`);
  console.log(`New device used: ${event.request.newDeviceUsed}`);

  // Track login for audit
  // await auditLog.record({
  //   action: 'login',
  //   userId: event.userName,
  //   clientId: event.callerContext.clientId,
  //   timestamp: new Date().toISOString(),
  // });

  // PostAuthentication has no response fields to modify
  return event;
});
