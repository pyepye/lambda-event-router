import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const s3 = new S3Client({});

export function getBucketName(): string {
  const bucket = process.env.BUCKET_NAME;
  if (!bucket) {
    throw new Error('BUCKET_NAME env var is not set');
  }
  return bucket;
}

interface PutAvatarInput {
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
}

export async function putAvatar({ bucket, key, body, contentType }: PutAvatarInput): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

interface GetAvatarInput {
  bucket: string;
  key: string;
}

interface GetAvatarResult {
  buffer: Buffer;
  contentType: string;
}

export async function getAvatar({ bucket, key }: GetAvatarInput): Promise<GetAvatarResult> {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) {
    throw new Error(`No body returned for s3://${bucket}/${key}`);
  }
  const buffer = Buffer.from(await response.Body.transformToByteArray());
  const contentType = response.ContentType ?? 'application/octet-stream';
  return { buffer, contentType };
}

interface DeleteAvatarInput {
  bucket: string;
  key: string;
}

export async function deleteAvatar({ bucket, key }: DeleteAvatarInput): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

interface ListAvatarsForUserNameInput {
  bucket: string;
  userName: string;
}

export async function listAvatarsForUserName({ bucket, userName }: ListAvatarsForUserNameInput): Promise<string[]> {
  const response = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `originals/${userName}.` }));
  const contents = response.Contents ?? [];
  const keys: string[] = [];
  for (const item of contents) {
    if (item.Key) {
      keys.push(item.Key);
    }
  }
  return keys;
}
