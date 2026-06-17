import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/kinesis';

import { TELEMETRY_STREAM_ARN } from '../config.js';
import { ReadingSchema } from '../utils/schemas.js';

// Every telemetry record that is not from the quarantined device. Matched by stream ARN alone, so it
// is registered last.
export const recordDeviceReading = defineRoute({
  filters: {
    eventSourceArn: TELEMETRY_STREAM_ARN,
  },
  dataSchema: ReadingSchema,
}).handle(async (request) => {
  logger.info({
    message: 'Device reading recorded',
    runId: request.data.runId,
    deviceId: request.data.deviceId,
    metric: request.data.metric,
    value: request.data.value,
  });
});
