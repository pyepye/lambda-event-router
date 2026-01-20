import type { UserMigrationRequest } from '@lambda-event-router/cognito';
import type { UserMigrationTriggerEvent } from 'aws-lambda';

// Handlers modify the cloned event and return it
export async function userMigration(request: UserMigrationRequest): Promise<UserMigrationTriggerEvent> {
  const { event, triggerSource } = request;

  console.log(`User migration: ${event.userName}`);
  console.log(`Trigger: ${triggerSource}`);

  console.log(`validationData: ${event.request.validationData}`);

  // Look up user in legacy system
  // const legacyUser = await legacyUserService.findByUsername(event.userName);
  // if (!legacyUser) {
  //   throw new Error('User not found in legacy system');
  // }

  // Verify password against legacy system (for authentication trigger)
  // if (triggerSource === 'UserMigration_Authentication') {
  //   const validPassword = await legacyUserService.verifyPassword(event.userName, event.request.password);
  //   if (!validPassword) {
  //     throw new Error('Invalid password');
  //   }
  // }

  // Return user attributes to create in Cognito
  event.response.userAttributes = {
    email: `${event.userName}@example.com`, // Replace with actual lookup
    email_verified: 'true',
    name: event.userName,
  };
  event.response.finalUserStatus = 'CONFIRMED';
  event.response.messageAction = 'SUPPRESS'; // Don't send welcome email
  event.response.desiredDeliveryMediums = ['EMAIL'];
  event.response.forceAliasCreation = false;

  return event;
}
