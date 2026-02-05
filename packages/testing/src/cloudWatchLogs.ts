import { gzipSync } from 'node:zlib';
import type { CloudWatchLogsDecodedData, CloudWatchLogsEvent, Context } from 'aws-lambda';
import { createMockContext } from './context.js';

export type CloudWatchLogsEventOverrides = Partial<CloudWatchLogsDecodedData>;

export interface CloudWatchLogsHandlerEvent {
  event: CloudWatchLogsEvent;
  context: Context;
}

export interface CreateCloudWatchLogsHandlerEventOptions {
  event?: CloudWatchLogsEventOverrides;
  context?: Partial<Context>;
}

export function createCloudWatchLogsEvent(overrides: CloudWatchLogsEventOverrides = {}): CloudWatchLogsEvent {
  const decodedData: CloudWatchLogsDecodedData = {
    owner: '123456789012',
    logGroup: '/aws/lambda/my-function',
    logStream: '2024/01/01/[$LATEST]abc123',
    subscriptionFilters: ['my-filter'],
    messageType: 'DATA_MESSAGE',
    logEvents: [{ id: crypto.randomUUID(), timestamp: Date.now(), message: 'test log message' }],
    ...overrides,
  };

  const jsonString = JSON.stringify(decodedData);
  const compressed = gzipSync(Buffer.from(jsonString));
  const encoded = compressed.toString('base64');

  return { awslogs: { data: encoded } };
}

export function createCloudWatchLogsHandlerEvent(
  options: CreateCloudWatchLogsHandlerEventOptions = {},
): CloudWatchLogsHandlerEvent {
  const event = createCloudWatchLogsEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}
