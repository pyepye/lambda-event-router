import { createDynamoDBRouter } from '@lambda-event-router/dynamodb';

import { orderProcessor } from './dynamodb-handlers/orderProcessor.js';
import { stockMonitor } from './dynamodb-handlers/stockMonitor.js';
import { logStreamInvocation } from './middleware/logInvocation.js';

export const dynamoDBRouter = createDynamoDBRouter({
  keys: { partitionKey: 'pk', sortKey: 'sk' },
  batchItemFailures: true,
  middleware: [logStreamInvocation],
});

dynamoDBRouter.route(orderProcessor).route(stockMonitor);
