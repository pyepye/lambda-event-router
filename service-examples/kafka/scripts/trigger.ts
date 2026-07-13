import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';

import { PRODUCER_FUNCTION_NAME } from '../src/config.js';

// A client with no region fails at the point of use, which reads as an SDK fault rather than a
// missing setting.
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

if (!region) {
  throw new Error('Set AWS_REGION to the region the stack is deployed in');
}

const lambdaClient = new LambdaClient({ region });

const response = await lambdaClient.send(new InvokeCommand({ FunctionName: PRODUCER_FUNCTION_NAME }));
const payload = response.Payload ? Buffer.from(response.Payload).toString('utf-8') : '';

if (response.FunctionError) {
  console.error(`${PRODUCER_FUNCTION_NAME} failed: ${payload}`);
  process.exitCode = 1;
} else {
  console.log(`${PRODUCER_FUNCTION_NAME} returned ${payload}`);
}
