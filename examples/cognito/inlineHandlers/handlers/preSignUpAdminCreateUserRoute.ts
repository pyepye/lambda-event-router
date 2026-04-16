import { defineRoute } from '@lambda-event-router/cognito';

// Using the individual trigger source method pattern
// This route only handles PreSignUp_AdminCreateUser
// Handlers modify the cloned event and return it
export const preSignUpAdminCreateUserRoute = defineRoute({
  filters: {
    // TODO: This is wrong?
    // triggerSource filter is optional since we use preSignUpAdminCreateUser()
    triggerSource: 'PreSignUp_AdminCreateUser',
  },
}).handle(async ({ event }) => {
  console.log(`Admin creating user: ${event.userName}`);

  // Admin-created users are automatically confirmed
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;
  event.response.autoVerifyPhone = true;

  return event;
});
