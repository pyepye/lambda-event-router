import { logger } from '@lambda-event-router/base';
import type { SQSRequest } from '@lambda-event-router/sqs';

import { closeBridgedSegment, openBridgedSegmentWithUpstream } from './segment.js';
import { tracer } from './tracer.js';

function readQueueName(eventSourceArn: string): string {
  const lastSegment = eventSourceArn.split(':').pop();
  return lastSegment ?? eventSourceArn;
}

// Relies on the convention that each route in this example is matched by `messageAttributes.type`.
// Reading it lets us name the bridged segment per-route without changes to packages/sqs.
function readRouteName(messageAttributes: SQSRequest['messageAttributes']): string {
  const type = messageAttributes.type;
  if (typeof type === 'string') return type;
  return '?';
}

export async function sqsTracingMiddleware(
  request: SQSRequest,
  next: (request: SQSRequest) => Promise<void>,
): Promise<void> {
  const traceHeader = request.record.attributes.AWSTraceHeader;
  const queueName = readQueueName(request.record.eventSourceARN);
  const routeName = readRouteName(request.messageAttributes);

  const opened = openBridgedSegmentWithUpstream(tracer, `SQS ${queueName} ${routeName}`, traceHeader);
  logger.appendKeys({ xrayTraceId: traceHeader, _X_AMZN_TRACE_ID: process.env._X_AMZN_TRACE_ID });
  try {
    await next(request);
  } finally {
    if (opened) closeBridgedSegment(tracer, opened);
    logger.removeKeys(['xrayTraceId', '_X_AMZN_TRACE_ID']);
  }
}
