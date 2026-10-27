import { logger } from '@latcher/base';
import type { S3LifecycleTransitionRequest } from '@latcher/s3';

export async function coolDownLedger(request: S3LifecycleTransitionRequest): Promise<void> {
  logger.info({
    message: 'Ledger moved to cold storage',
    key: request.key,
    eventName: request.eventName,
  });
}
