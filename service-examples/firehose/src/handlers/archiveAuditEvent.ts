import { logger } from '@lambda-event-router/base';
import { defineRoute, Ok } from '@lambda-event-router/firehose';

import { AUDIT_STREAM_ARN } from '../config.js';
import { AuditEventSchema } from '../utils/schemas.js';

// Audit events reach Firehose through the Kinesis stream, so sourceKinesisStreamArn picks them out on
// its own: a clickstream event carries no source stream for the filter to read.
//
// The tenant id goes back as a Firehose partition key. Dynamic partitioning on this delivery stream is
// what turns it into the S3 prefix the record lands under.
export const archiveAuditEvent = defineRoute({
  filters: {
    sourceKinesisStreamArn: AUDIT_STREAM_ARN,
  },
  dataSchema: AuditEventSchema,
}).handle(async ({ data }) => {
  logger.info({ message: 'Audit event archived', tenantId: data.tenantId, action: data.action });

  return Ok(data, { partitionKeys: { tenantId: data.tenantId } });
});
