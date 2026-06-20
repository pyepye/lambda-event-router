import { PermanentFailure } from '@lambda-event-router/s3';

export interface EnrolmentRecord {
  enrolmentId: string;
  status: 'ready' | 'locked' | 'corrupt' | 'withdrawn';
}

// Thrown rather than returned, so a check buried in a call stack can end a batch task without every
// caller in between passing a result code back up. The router catches an S3BatchResponse and reports
// it as that task's result.
export function assertArchivable(record: EnrolmentRecord): void {
  if (record.status === 'withdrawn') {
    throw PermanentFailure(`Enrolment ${record.enrolmentId} is withdrawn`);
  }
}
