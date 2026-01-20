import { defineRoute } from '@lambda-event-router/cognito';

// UserMigration - migrate users from legacy system
// Handlers modify the cloned event and return it
export const userMigrationRoute = defineRoute({
  filters: {
    triggerSources: ['UserMigration_Authentication'],
  },
}).handle(async ({ event }) => {
  console.log(`User migration: ${event.userName}`);

  console.log(`validationData: ${event.request.validationData}`);
  // Look up user in legacy system and verify password
  // const legacyUser = await legacyUserService.findByUsername(event.userName);
  // const validPassword = await legacyUserService.verifyPassword(event.userName, event.request.password);

  event.response.userAttributes = {
    email: `${event.userName}@example.com`,
    email_verified: 'true',
    name: event.userName,
  };
  event.response.finalUserStatus = 'CONFIRMED';
  event.response.messageAction = 'SUPPRESS';
  event.response.desiredDeliveryMediums = ['EMAIL'];
  event.response.forceAliasCreation = false;

  return event;
});
