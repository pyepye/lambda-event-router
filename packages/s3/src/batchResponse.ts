import type { S3BatchResultResultCode } from 'aws-lambda';

export interface S3BatchResponse {
  resultCode: S3BatchResultResultCode;
  resultString?: string;
}

const VALID_RESULT_CODES: ReadonlySet<string> = new Set(['Succeeded', 'TemporaryFailure', 'PermanentFailure']);

export function isS3BatchResponse(value: unknown): value is S3BatchResponse {
  if (typeof value !== 'object' || value === null) return false;
  if (!('resultCode' in value)) return false;
  return typeof value.resultCode === 'string' && VALID_RESULT_CODES.has(value.resultCode);
}

export function Succeeded(resultString?: string): S3BatchResponse {
  return { resultCode: 'Succeeded', resultString: resultString ?? '' };
}

export function TemporaryFailure(resultString?: string): S3BatchResponse {
  return { resultCode: 'TemporaryFailure', resultString: resultString ?? '' };
}

export function PermanentFailure(resultString?: string): S3BatchResponse {
  return { resultCode: 'PermanentFailure', resultString: resultString ?? '' };
}
