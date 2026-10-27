import { logger } from '@latcher/base';
import type { S3ObjectAclRequest } from '@latcher/s3';

// ObjectAcl:Put only fires on a bucket where ACLs are enabled, so the uploads bucket sets its
// object ownership to ObjectWriter.
export async function auditAclChange(request: S3ObjectAclRequest): Promise<void> {
  logger.info({
    message: 'Object ACL change audited',
    key: request.key,
  });
}
