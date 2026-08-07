import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

// CloudFormation cannot delete a bucket with objects in it, and Config writes to this one. The destroy
// script runs this first.
const stackName = process.env.STACK_NAME ?? 'ler-example-config';

// A client with no region fails at the point of use rather than at construction, so check here.
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

if (!region) {
  throw new Error('Set AWS_REGION to the region the stack is deployed in');
}

const cloudFormationClient = new CloudFormationClient({ region });
const s3Client = new S3Client({ region });

async function deliveryBucketName(): Promise<string | undefined> {
  try {
    const { Stacks = [] } = await cloudFormationClient.send(new DescribeStacksCommand({ StackName: stackName }));
    return Stacks[0]?.Outputs?.find((output) => output.OutputKey === 'DeliveryBucketName')?.OutputValue;
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not exist')) return undefined;
    throw error;
  }
}

const bucket = await deliveryBucketName();

if (!bucket) {
  console.log(`Stack ${stackName} has no delivery bucket to empty.`);
} else {
  let deleted = 0;
  let continuationToken: string | undefined;

  do {
    const page = await s3Client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }),
    );
    const keys = (page.Contents ?? []).flatMap((object) => (object.Key ? [{ Key: object.Key }] : []));

    if (keys.length > 0) {
      await s3Client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }));
      deleted += keys.length;
    }

    continuationToken = page.NextContinuationToken;
  } while (continuationToken);

  console.log(`Deleted ${deleted} objects from ${bucket}.`);
}
