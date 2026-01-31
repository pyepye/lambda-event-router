import type { SESRequest, SESResponse } from '@lambda-event-router/ses';

// SES receipt rules store the raw MIME email in S3 (via an S3 action before the Lambda action).
// The S3 object key is the messageId from the SES event.
// const s3Client = new S3Client({});

export async function processInboundEmail(request: SESRequest): Promise<SESResponse> {
  const { source, subject, recipients, mail } = request;
  console.log(`Inbound email from ${source} to ${recipients.join(', ')}: ${subject}`);

  // Fetch the raw email body from S3 using the messageId as the object key
  const emailBucket = process.env.SES_EMAIL_BUCKET;
  const emailObjectKey = mail.messageId;
  console.log(`Fetching email body from s3://${emailBucket}/${emailObjectKey}`);

  // const command = new GetObjectCommand({ Bucket: emailBucket, Key: emailObjectKey });
  // const response = await s3Client.send(command);
  // const rawEmail = await response.Body?.transformToString();
  // Parse the raw MIME email with a library like mailparser
}

export async function processPartnerEmail(request: SESRequest): Promise<SESResponse> {
  const { source, subject } = request;
  console.log(`Partner email from ${source}: ${subject}`);
}

export async function processInternalEmail(request: SESRequest): Promise<SESResponse> {
  const { source, subject, recipients } = request;
  console.log(`Internal email from ${source} to ${recipients.join(', ')}: ${subject}`);
}

export async function processQuarantinedEmail(request: SESRequest): Promise<SESResponse> {
  const { source, subject, recipients } = request;
  console.log(`Quarantined email from ${source} to ${recipients.join(', ')}: ${subject}`);
}
