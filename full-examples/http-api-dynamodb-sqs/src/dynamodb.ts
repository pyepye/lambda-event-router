import { createDynamoDBMatcher } from '@latcher/dynamodb';

import { orderProcessor } from './dynamodb-handlers/orderProcessor.js';
import { stockMonitor } from './dynamodb-handlers/stockMonitor.js';
import { logStreamInvocation } from './middleware/logInvocation.js';

export const dynamoDBMatcher = createDynamoDBMatcher({
  keys: { partitionKey: 'pk', sortKey: 'sk' },
  batchItemFailures: true,
  middleware: [logStreamInvocation],
});

dynamoDBMatcher.route(orderProcessor).route(stockMonitor);
