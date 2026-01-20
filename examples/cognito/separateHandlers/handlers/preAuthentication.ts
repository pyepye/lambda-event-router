import type { PreAuthenticationRequest } from '@lambda-event-router/cognito';
import type { PreAuthenticationTriggerEvent } from 'aws-lambda';

// No response modification needed for PreAuthentication
export async function preAuthentication(request: PreAuthenticationRequest): Promise<PreAuthenticationTriggerEvent> {
  const { event, triggerSource } = request;

  console.log(`Pre-authentication check: ${event.userName}`);
  console.log(`Client: ${event.callerContext.clientId}`);
  console.log(`Trigger: ${triggerSource}`);

  // Check if user is blocked
  // const isBlocked = await userService.isBlocked(event.userName);
  // if (isBlocked) {
  //   throw new Error('User is blocked');
  // }

  // Check for suspicious activity
  if (event.request.validationData?.suspicious === 'true') {
    throw new Error('Suspicious login attempt detected');
  }

  return event;
}
