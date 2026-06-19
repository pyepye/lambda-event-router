import { logger } from '@lambda-event-router/base';
import { Dropped, defineRoute } from '@lambda-event-router/firehose';

import { CLICKSTREAM_ARN } from '../config.js';
import { eventTypeOf } from '../utils/events.js';

// Load balancer pings are thrown away rather than stored. A dropped record is not an error, so it
// reaches neither the data prefix nor the error prefix in S3.
export const dropHealthCheckPing = defineRoute({
  filters: {
    deliveryStreamArn: CLICKSTREAM_ARN,
    custom: ({ data }) => eventTypeOf(data) === 'healthCheck',
  },
}).handle(async ({ recordId }) => {
  logger.info({ message: 'Health check ping dropped', recordId });

  return Dropped();
});
