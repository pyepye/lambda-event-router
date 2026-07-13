import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/kafka';

import { FAILED_RECORDS_TOPIC } from '../config.js';
import { FailedRecordSchema } from '../utils/schemas.js';

// Lambda writes to this topic once a record has used its retries, so the value is Lambda's failure
// envelope rather than the order or payment that failed. The mapping for this topic has no failure
// destination of its own, which is what stops a quarantined record looping back round.
export const quarantineFailedRecord = defineRoute({
  filters: {
    topic: FAILED_RECORDS_TOPIC,
  },
  valueSchema: FailedRecordSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Failed record quarantined',
    condition: request.value.requestContext.condition,
    attempts: request.value.requestContext.approximateInvokeCount,
    batchSize: request.value.KafkaBatchInfo.batchSize,
    key: request.key,
  });
});
