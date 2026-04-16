import { defineRoute } from '@lambda-event-router/cognito';
import { z } from 'zod';

const userAttributesSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

// Handle self-registration only
// Auto-confirm users from trusted email domains
// Handlers modify the cloned event and return it
export const preSignUpRoute = defineRoute({
  filters: {
    triggerSource: 'PreSignUp_SignUp',
    // Only match users from allowed domains
    userAttributes: {
      email: /@(company\.com|partner\.org)$/,
    },
  },
  userAttributesSchema,
}).handle(async ({ userAttributes, event }) => {
  console.log(`Self-registration: ${event.userName} from client ${event.callerContext.clientId}`);
  console.log(`Email: ${userAttributes.email}`);

  // Auto-confirm and auto-verify for trusted domains
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;

  return event;
});
