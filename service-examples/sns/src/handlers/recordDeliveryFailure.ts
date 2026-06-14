import { isObject, logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/sns';

import { DELIVERY_FAILURES_TOPIC_ARN } from '../config.js';

// Reads the SNS message id of the order that failed out of Lambda's failure envelope, so an entry on
// the delivery failures topic can be traced back to the message the trigger published.
function failedMessageId(envelope: Record<string, unknown>): string | undefined {
  const requestPayload = isObject(envelope.requestPayload) ? envelope.requestPayload : undefined;
  const records = Array.isArray(requestPayload?.Records) ? requestPayload.Records : [];
  const firstRecord = isObject(records[0]) ? records[0] : undefined;
  const sns = isObject(firstRecord?.Sns) ? firstRecord.Sns : undefined;
  return typeof sns?.MessageId === 'string' ? sns.MessageId : undefined;
}

// Lambda republishes an invocation that has run out of retries to the delivery failures topic, and the
// worker subscribes to that topic too. Matched by topic ARN alone.
// This route carries no schema and never throws on purpose. A failure here would be republished to the
// same topic and loop.
export const recordDeliveryFailure = defineRoute({
  filters: {
    topicArn: DELIVERY_FAILURES_TOPIC_ARN,
  },
}).handle(async (request) => {
  const envelope = isObject(request.body) ? request.body : {};
  const response = isObject(envelope.responsePayload) ? envelope.responsePayload : {};

  logger.error({
    message: 'Order dead lettered',
    failedMessageId: failedMessageId(envelope),
    errorType: response.errorType,
    errorMessage: response.errorMessage,
    bodyType: typeof request.body,
  });
});
