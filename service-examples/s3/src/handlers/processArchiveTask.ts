import { GetObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '@lambda-event-router/base';
import type { S3BatchRequest, S3BatchResponse } from '@lambda-event-router/s3';
import { PermanentFailure, Succeeded, TemporaryFailure } from '@lambda-event-router/s3';

import { s3Client } from '../config.js';
import { assertArchivable, type EnrolmentRecord } from '../utils/enrolment.js';

// The only route S3 Batch reaches, and it takes no filters. Reading the object proves the bucket and
// key the router derived from the task are the real ones: a wrong key gets NoSuchKey from S3.
export async function processArchiveTask(request: S3BatchRequest): Promise<S3BatchResponse> {
  const object = await s3Client.send(new GetObjectCommand({ Bucket: request.bucket, Key: request.key }));
  const record = JSON.parse((await object.Body?.transformToString()) ?? '') as EnrolmentRecord;

  assertArchivable(record);

  if (record.status === 'locked') {
    return TemporaryFailure(`Enrolment ${record.enrolmentId} is locked by another job`);
  }

  if (record.status === 'corrupt') {
    return PermanentFailure(`Enrolment ${record.enrolmentId} failed its checksum`);
  }

  logger.info({
    message: 'Enrolment archived',
    enrolmentId: record.enrolmentId,
    key: request.key,
  });

  return Succeeded(`Archived enrolment ${record.enrolmentId}`);
}
