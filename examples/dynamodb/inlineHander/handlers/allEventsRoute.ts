import { defineRoute } from '@lambda-event-router/dynamodb';

import { STREAM_ARN } from '../constants.js';

// All events - newImage/oldImage depend on eventName
export const allEventsRoute = defineRoute({
  filters: {
    eventNames: ['INSERT', 'MODIFY', 'REMOVE'],
    eventSourceArns: [STREAM_ARN],
  },
}).handle(async ({ newImage, oldImage, keys }) => {
  const { pk, sk } = keys;
  console.log(`newImage ${newImage} - oldImage ${oldImage} - pk ${pk} - sk ${sk}`);
});
