import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Credentials, S3ArtifactLocation } from 'aws-lambda';

// CodePipeline gives each job temporary credentials scoped to the artifact store, and they are the
// only way a Lambda action can write its output artifact. They differ per job, so the client is built
// per call rather than shared. The route check replaces `put` to record the upload.
export const artifactStore = {
  async put(credentials: Credentials, location: S3ArtifactLocation, body: Buffer): Promise<void> {
    const client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: location.bucketName,
        Key: location.objectKey,
        Body: body,
        ContentType: 'application/zip',
      }),
    );
  },
};
