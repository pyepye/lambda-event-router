import { defineRoute } from '@lambda-event-router/cognito';

// Handle admin-created users differently from self-registration
// Handlers modify the cloned event and return it
export const preSignUpAdminRoute = defineRoute({
  filters: {
    triggerSource: 'PreSignUp_AdminCreateUser',
  },
}).handle(async ({ event }) => {
  console.log(`Admin creating user: ${event.userName}`);
  console.log(`User attributes: ${JSON.stringify(event.request.userAttributes)}`);

  // Admin-created users are pre-verified
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;
  event.response.autoVerifyPhone = true;

  return event;
});
