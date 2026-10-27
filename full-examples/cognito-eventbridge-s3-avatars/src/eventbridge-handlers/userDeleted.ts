import { logger } from '@latcher/base';
import type { EventBridgeRequest } from '@latcher/eventbridge';
import { z } from 'zod';

import { deleteAvatar, getBucketName, listAvatarsForUserName } from '../utils/s3.js';

// CloudTrail redacts requestParameters.username for Cognito API calls
// ("HIDDEN_DUE_TO_SECURITY_REASONS"), but exposes the sub in additionalEventData.
// The sub matches event.userName from the postConfirmation Lambda trigger
// when the pool uses email as a sign-in alias, so it's what avatars are keyed by.
export const CognitoCloudTrailDetailSchema = z.object({
  eventName: z.enum(['AdminDeleteUser', 'DeleteUser']),
  additionalEventData: z.object({
    sub: z.string(),
  }),
});

export type CognitoCloudTrailDetail = z.infer<typeof CognitoCloudTrailDetailSchema>;

export async function userDeleted(request: EventBridgeRequest<CognitoCloudTrailDetail>): Promise<void> {
  const { sub } = request.detail.additionalEventData;
  const bucket = getBucketName();

  const keys = await listAvatarsForUserName({ bucket, userName: sub });
  const deletes = keys.map((key) => deleteAvatar({ bucket, key }));
  await Promise.all(deletes);

  logger.info({ message: 'Avatars deleted for removed user', userName: sub, keys });
}
