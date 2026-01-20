import type { PostAuthenticationRequest } from '@lambda-event-router/cognito';
import type { PostAuthenticationTriggerEvent } from 'aws-lambda';

// No response modification needed for PostAuthentication
export async function postAuthentication(
  cognitoRequest: PostAuthenticationRequest,
): Promise<PostAuthenticationTriggerEvent> {
  const { event, triggerSource } = cognitoRequest;

  console.log(`Successful login: ${event.userName}`);
  console.log(`Client: ${event.callerContext.clientId}`);
  console.log(`User attributes: ${event.request.userAttributes}`);
  console.log(`triggerSource: ${triggerSource}`);

  // Update last login timestamp
  // await userService.updateLastLogin(event.userName);

  // Log for audit
  // await auditLog.record({
  //   action: 'login',
  //   userId: event.userName,
  //   clientId: event.callerContext.clientId,
  //   timestamp: new Date().toISOString(),
  // });

  return event;
}
