import { defineRoute } from '@lambda-event-router/dynamodb-stream';

export const noEventNameRoute = defineRoute({
  filters: { eventSourceArns: ['asd'] },
}).handle(async ({ eventName }) => {
  console.log(`eventName ${eventName}`);
});
