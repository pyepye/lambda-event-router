import { CodePipelineClient, StartPipelineExecutionCommand } from '@aws-sdk/client-codepipeline';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { PIPELINE_NAME, RELEASE_BUNDLE_KEY } from '../src/config.js';
import { zipSingleFile } from '../src/utils/zip.js';

// The bucket name comes from the CDK outputs. Pass it as an arg or set the env var.
const bucket = process.argv[2] ?? process.env.RELEASE_BUCKET_NAME;

if (!bucket) {
  throw new Error('Usage: pnpm run release <releaseBucketName>');
}

// A client with no region fails at the point of use rather than at construction, so check here.
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

if (!region) {
  throw new Error('Set AWS_REGION to the region the stack is deployed in');
}

const s3Client = new S3Client({ region });
const codePipelineClient = new CodePipelineClient({ region });

const manifest = JSON.stringify({ service: 'checkout-service', builtAt: new Date().toISOString() });

await s3Client.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: RELEASE_BUNDLE_KEY,
    Body: zipSingleFile('manifest.json', manifest),
    ContentType: 'application/zip',
  }),
);

const { pipelineExecutionId } = await codePipelineClient.send(
  new StartPipelineExecutionCommand({ name: PIPELINE_NAME }),
);

console.log(`Uploaded ${RELEASE_BUNDLE_KEY} to ${bucket} and started execution ${pipelineExecutionId}.`);
