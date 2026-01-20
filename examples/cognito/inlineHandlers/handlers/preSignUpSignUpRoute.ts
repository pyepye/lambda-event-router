import { defineRoute } from '@lambda-event-router/cognito';
import { z } from 'zod';

const userAttributesSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

// Using the individual trigger source method pattern
// This route only handles PreSignUp_SignUp - no need for triggerSources filter
// Handlers modify the cloned event and return it
export const preSignUpSignUpRoute = defineRoute({
  filters: {
    // triggerSources filter is optional here since we use preSignUpSignUp()
    // which only accepts 'PreSignUp_SignUp'
    triggerSources: ['PreSignUp_SignUp'],
    userAttributes: {
      email: /@(company\.com|partner\.org)$/,
    },
  },
  userAttributesSchema,
}).handle(async ({ userAttributes, event }) => {
  console.log(`Self-registration: ${event.userName}`);
  console.log(`Email: ${userAttributes.email}`);

  // Auto-confirm and auto-verify for trusted domains
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;

  return event;
});
