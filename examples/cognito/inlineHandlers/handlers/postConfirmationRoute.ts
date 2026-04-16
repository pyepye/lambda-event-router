import { defineRoute } from '@lambda-event-router/cognito';

// PostConfirmation - handle user confirmation events
// Handlers modify the cloned event and return it
export const postConfirmationRoute = defineRoute({
  filters: {
    triggerSource: 'PostConfirmation_ConfirmSignUp',
  },
}).handle(async ({ event }) => {
  console.log(`User confirmed: ${event.userName}`);
  console.log(`Email: ${event.request.userAttributes.email}`);

  // Add user to external system after confirmation
  // await externalService.createUser({
  //   userId: event.userName,
  //   email: event.request.userAttributes.email,
  // });

  // PostConfirmation has no response fields to modify
  return event;
});
