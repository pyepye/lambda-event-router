import { logger } from '@lambda-event-router/base';
import { defineRoute, Ok } from '@lambda-event-router/firehose';

import { CLICKSTREAM_ARN } from '../config.js';
import { withVisitorContext } from '../middleware/withVisitorContext.js';
import { eventTypeOf } from '../utils/events.js';
import { SignUpSchema } from '../utils/schemas.js';

// Sign ups reach S3 with the email masked. Ok(data) replaces the record, so what lands in the bucket
// is what this returns rather than what was put. Ok stringifies and base64 encodes it.
export const redactVisitorEmail = defineRoute({
  filters: {
    deliveryStreamArn: CLICKSTREAM_ARN,
    custom: ({ data }) => eventTypeOf(data) === 'signUp',
  },
  dataSchema: SignUpSchema,
  middleware: [withVisitorContext],
}).handle(async ({ data }) => {
  const domain = data.email.split('@').at(1) ?? 'unknown';
  const redacted = { ...data, email: `redacted@${domain}` };

  logger.info({ message: 'Sign up redacted', visitorId: data.visitorId, domain });

  return Ok(redacted);
});
