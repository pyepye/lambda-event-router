import type { FirehoseRecordTransformationStatus, FirehoseTransformationMetadata } from 'aws-lambda';

export interface FirehoseResponseResult {
  status: FirehoseRecordTransformationStatus;
  data?: string;
  metadata?: FirehoseTransformationMetadata;
}

const VALID_STATUSES: ReadonlySet<string> = new Set(['Ok', 'Dropped', 'ProcessingFailed']);

export function isFirehoseResponse(value: unknown): value is FirehoseResponseResult {
  if (typeof value !== 'object' || value === null) return false;
  if (!('status' in value)) return false;
  return typeof value.status === 'string' && VALID_STATUSES.has(value.status);
}

export function Ok(data?: unknown, metadata?: FirehoseTransformationMetadata): FirehoseResponseResult {
  if (data === undefined) {
    return { status: 'Ok' };
  }

  const stringified = typeof data === 'string' ? data : JSON.stringify(data);
  const encoded = Buffer.from(stringified).toString('base64');

  if (metadata) {
    return { status: 'Ok', data: encoded, metadata };
  }

  return { status: 'Ok', data: encoded };
}

export function Dropped(): FirehoseResponseResult {
  return { status: 'Dropped' };
}

export function Failed(): FirehoseResponseResult {
  return { status: 'ProcessingFailed' };
}
