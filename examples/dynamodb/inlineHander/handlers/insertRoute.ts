import { type DynamoDBFilterInput, defineRoute } from '@lambda-event-router/dynamodb';

import { STREAM_ARN } from '../constants.js';

// INSERT only - newImage is guaranteed, oldImage is undefined
export const insertRoute = defineRoute({
  filters: {
    eventName: 'INSERT',
    eventSourceArn: STREAM_ARN,
  },
}).handle(async ({ newImage, keys }) => {
  const { pk, sk } = keys;
  console.log(`newImage ${newImage} - pk ${pk} - sk ${sk}`);
});

// Match inserts where the new record has a PENDING status - filters on record data, not source ARN
export const pendingStatusInsertRoute = defineRoute({
  filters: {
    eventName: 'INSERT',
    eventSourceArn: STREAM_ARN,
    custom: ({ record }: DynamoDBFilterInput) => {
      const statusAttribute = record.dynamodb?.NewImage?.status;
      return statusAttribute?.S === 'PENDING';
    },
  },
}).handle(async ({ newImage, keys }) => {
  const { pk, sk } = keys;
  console.log(`Pending item inserted - pk ${pk} - sk ${sk} - newImage ${newImage}`);
});
