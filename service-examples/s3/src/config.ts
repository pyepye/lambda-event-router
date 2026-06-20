import { S3Client } from '@aws-sdk/client-s3';

// Lambda sets AWS_REGION, so the client resolves one without being told. The trigger script resolves
// its own region up front instead, because a client with no region fails at the point of use.
export const s3Client = new S3Client({});

// The bucket filters match against these. CDK injects them as env vars on the worker.
export const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET ?? '';
export const REPORTS_BUCKET = process.env.REPORTS_BUCKET ?? '';

// An upload above this size is rejected instead of scanned.
export const MAX_UPLOAD_BYTES = 1024 * 1024;
