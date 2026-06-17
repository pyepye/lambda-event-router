import { defineRoute } from '@lambda-event-router/kinesis';

import { QUARANTINED_DEVICE_KEY, TELEMETRY_STREAM_ARN } from '../config.js';
import { ReadingSchema } from '../utils/schemas.js';

// The quarantined device is matched by an exact partition key, and every reading from it is refused.
// This is the only route that fails inside the handler rather than on a filter or a schema. The
// difference shows in the logs: the middleware chain has already run, so this record has a
// `Handling Kinesis record` line. A record that fails validation has none.
export const quarantineDevice = defineRoute({
  filters: {
    eventSourceArn: TELEMETRY_STREAM_ARN,
    partitionKey: QUARANTINED_DEVICE_KEY,
  },
  dataSchema: ReadingSchema,
}).handle(async (request) => {
  throw new Error(`Device ${request.data.deviceId} is quarantined`);
});
