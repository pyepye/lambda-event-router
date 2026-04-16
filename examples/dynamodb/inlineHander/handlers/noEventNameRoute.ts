import { defineRoute } from '@lambda-event-router/dynamodb';

export const noEventNameRoute = defineRoute({
  filters: { eventSourceArn: 'asd' },
}).handle(async ({ eventName }) => {
  console.log(`eventName ${eventName}`);
});
