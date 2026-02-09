import { defineRoute } from '@lambda-event-router/dynamodb';

import { STREAM_ARN } from '../constants.js';

// INSERT only - newImage is guaranteed, oldImage is undefined
export const insertRoute = defineRoute({
  filters: {
    eventNames: ['INSERT'],
    eventSourceArns: [STREAM_ARN],
  },
}).handle(async ({ newImage, keys }) => {
  const { pk, sk } = keys;
  console.log(`newImage ${newImage} - pk ${pk} - sk ${sk}`);
});
