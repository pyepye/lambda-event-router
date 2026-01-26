import type { Context } from 'aws-lambda';

export function createMockContext(overrides: Partial<Context> = {}): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: crypto.randomUUID(),
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2024/01/01/[$LATEST]abc123',
    getRemainingTimeInMillis: (): number => 30000,
    done: (): void => {},
    fail: (): void => {},
    succeed: (): void => {},
    ...overrides,
  };
}
