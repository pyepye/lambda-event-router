import { logger } from '@lambda-event-router/base';
import type { S3ObjectAclRequest } from '@lambda-event-router/s3';

// ObjectAcl:Put only fires on a bucket where ACLs are enabled, so the uploads bucket sets its
// object ownership to ObjectWriter.
export async function auditAclChange(request: S3ObjectAclRequest): Promise<void> {
  logger.info({
    message: 'Object ACL change audited',
    key: request.key,
  });
}
