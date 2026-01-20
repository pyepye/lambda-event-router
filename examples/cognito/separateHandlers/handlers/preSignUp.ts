import type { PreSignUpRequest } from '@lambda-event-router/cognito';
import type { PreSignUpTriggerEvent } from 'aws-lambda';
import { z } from 'zod';

export const UserAttributesSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

type UserAttributes = z.infer<typeof UserAttributesSchema>;

// Handlers modify the cloned event and return it
export async function preSignUp(request: PreSignUpRequest<UserAttributes>): Promise<PreSignUpTriggerEvent> {
  const { userAttributes, event } = request;

  console.log(`Self-registration: ${event.userName} from client ${event.callerContext.clientId}`);
  console.log(`Email: ${userAttributes.email}`);

  // Auto-confirm and auto-verify for trusted domains
  const isTrustedDomain = userAttributes.email.endsWith('@company.com');

  event.response.autoConfirmUser = isTrustedDomain;
  event.response.autoVerifyEmail = isTrustedDomain;

  return event;
}

export async function preSignUpAdmin(request: PreSignUpRequest): Promise<PreSignUpTriggerEvent> {
  const { event } = request;

  console.log(`Admin creating user: ${event.userName}`);
  console.log(`User attributes: ${event.request.userAttributes}`);

  // Admin-created users are pre-verified
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;
  event.response.autoVerifyPhone = true;

  return event;
}
