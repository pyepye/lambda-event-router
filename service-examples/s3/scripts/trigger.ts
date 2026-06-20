import {
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectTaggingCommand,
  PutObjectAclCommand,
  PutObjectCommand,
  PutObjectTaggingCommand,
  RestoreObjectCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

import { MAX_UPLOAD_BYTES, s3Client } from '../src/config.js';
import { runArchiveJob } from './batchJob.js';
import { readStackOutputs } from './stack.js';

const stackName = process.argv[2] ?? process.env.STACK_NAME ?? 'ler-example-s3';

const SMALL_DOCUMENT = 'A scanned page.';
const OVERSIZED_DOCUMENT = 'x'.repeat(MAX_UPLOAD_BYTES + 1);
// A new bucket carries TransitionDefaultMinimumObjectSize of all_storage_classes_128K, so a
// lifecycle transition skips anything smaller. The ledger has to clear that floor to move.
const COLD_LEDGER = `entry,amount\n${'1,250\n'.repeat(35_000)}`;

const outputs = await readStackOutputs(stackName);

async function put(bucket: string, key: string, body: string, storageClass?: 'GLACIER'): Promise<string> {
  const { VersionId } = await s3Client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, StorageClass: storageClass }),
  );
  return VersionId ?? '';
}

// ObjectCreated:Post comes from a browser form post and nothing else. PutObject reports Put.
async function postForm(bucket: string, key: string, body: string): Promise<void> {
  const { url, fields } = await createPresignedPost(s3Client, { Bucket: bucket, Key: key, Expires: 300 });
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value);
  }
  form.append('file', new Blob([body]), key.split('/').at(-1));

  const response = await fetch(url, { method: 'POST', body: form });
  if (!response.ok) {
    throw new Error(`Presigned POST to ${key} returned ${response.status}: ${await response.text()}`);
  }
}

// A single part is enough. CompleteMultipartUpload reports its own event name whatever the part count.
async function uploadInParts(bucket: string, key: string, body: string): Promise<void> {
  const { UploadId } = await s3Client.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key }));
  const { ETag } = await s3Client.send(
    new UploadPartCommand({ Bucket: bucket, Key: key, UploadId, PartNumber: 1, Body: body }),
  );
  await s3Client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId,
      MultipartUpload: { Parts: [{ PartNumber: 1, ETag }] },
    }),
  );
}

const { uploadsBucket, reportsBucket } = outputs;

await put(uploadsBucket, 'documents/passport.pdf', SMALL_DOCUMENT);
await put(uploadsBucket, 'documents/handbook.docx', SMALL_DOCUMENT);
await put(uploadsBucket, 'documents/thesis.pdf', OVERSIZED_DOCUMENT);
await put(uploadsBucket, 'documents/installer.exe', SMALL_DOCUMENT);
await put(uploadsBucket, 'documents/draft.pdf', SMALL_DOCUMENT);
const supersededVersion = await put(uploadsBucket, 'documents/superseded.pdf', SMALL_DOCUMENT);
await put(uploadsBucket, 'reviews/case-4821.json', JSON.stringify({ caseId: '4821' }));
await put(uploadsBucket, 'misc/notes.txt', 'Nothing routes this.');
await put(uploadsBucket, 'archive/transcript-2019.csv', 'year,grade\n2019,A', 'GLACIER');
await put(uploadsBucket, 'archive/expiring/old-form.pdf', SMALL_DOCUMENT);
await put(uploadsBucket, 'archive/cooling/ledger.csv', COLD_LEDGER);

await postForm(uploadsBucket, 'forms/photo.jpg', 'A passport photo.');
await uploadInParts(uploadsBucket, 'transcripts/2026-intake.csv', 'student,course\n1,Physics');

await s3Client.send(
  new PutObjectTaggingCommand({
    Bucket: uploadsBucket,
    Key: 'documents/passport.pdf',
    Tagging: { TagSet: [{ Key: 'retention', Value: 'seven-years' }] },
  }),
);
await s3Client.send(new DeleteObjectTaggingCommand({ Bucket: uploadsBucket, Key: 'documents/passport.pdf' }));
await s3Client.send(new PutObjectAclCommand({ Bucket: uploadsBucket, Key: 'documents/passport.pdf', ACL: 'private' }));

// Naming a version deletes it for good. Leaving the version off writes a delete marker instead.
await s3Client.send(
  new DeleteObjectCommand({ Bucket: uploadsBucket, Key: 'documents/superseded.pdf', VersionId: supersededVersion }),
);
await s3Client.send(new DeleteObjectCommand({ Bucket: uploadsBucket, Key: 'documents/draft.pdf' }));

// Standard retrieval, so the Completed event lands three to five hours later.
await s3Client.send(
  new RestoreObjectCommand({
    Bucket: uploadsBucket,
    Key: 'archive/transcript-2019.csv',
    RestoreRequest: { Days: 1, GlacierJobParameters: { Tier: 'Standard' } },
  }),
);

await put(reportsBucket, 'reports/weekly-enrolments.csv', 'week,total\n1,412');
await s3Client.send(
  new CopyObjectCommand({
    Bucket: reportsBucket,
    Key: 'reports/archive/weekly-enrolments-2026-01.csv',
    CopySource: `${reportsBucket}/reports/weekly-enrolments.csv`,
  }),
);
await s3Client.send(new DeleteObjectCommand({ Bucket: reportsBucket, Key: 'reports/weekly-enrolments.csv' }));

console.log('Sent 22 notification events across the uploads and reports buckets.');

await runArchiveJob(outputs);

console.log('Done. The failing objects finished retrying while the batch job ran, so the log is complete.');
