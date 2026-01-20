import type { PostConfirmationRequest } from '@lambda-event-router/cognito';
import type { PostConfirmationTriggerEvent } from 'aws-lambda';

// No response modification needed for PostConfirmation
export async function postConfirmation(request: PostConfirmationRequest): Promise<PostConfirmationTriggerEvent> {
  const { event, triggerSource } = request;

  console.log(`User confirmed: ${event.userName}`);
  console.log(`Trigger: ${triggerSource}`);
  console.log(`Email: ${event.request.userAttributes.email}`);

  // Add user to external system after confirmation
  // await externalService.createUser({
  //   userId: event.userName,
  //   email: event.request.userAttributes.email,
  // });

  return event;
}
