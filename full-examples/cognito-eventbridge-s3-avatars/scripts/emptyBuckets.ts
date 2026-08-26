import { CloudFormationClient, paginateListStackResources } from '@aws-sdk/client-cloudformation';
import { CloudTrailClient, StopLoggingCommand } from '@aws-sdk/client-cloudtrail';
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

// CloudFormation cannot delete a bucket with objects in it. The destroy script runs this first.
const stackName = process.env.STACK_NAME ?? 'cognito-eventbridge-s3-avatars';

// A client with no region fails at the point of use rather than at construction, so check here.
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

if (!region) {
  throw new Error('Set AWS_REGION to the region the stack is deployed in');
}

const cloudFormationClient = new CloudFormationClient({ region });
const cloudTrailClient = new CloudTrailClient({ region });
const s3Client = new S3Client({ region });

interface LiveResource {
  type: string;
  physicalId: string;
}

// Outputs are missing when a create fails, so read the resources instead.
async function liveStackResources(): Promise<LiveResource[]> {
  const resources: LiveResource[] = [];
  try {
    for await (const page of paginateListStackResources({ client: cloudFormationClient }, { StackName: stackName })) {
      for (const summary of page.StackResourceSummaries ?? []) {
        if (summary.ResourceStatus === 'DELETE_COMPLETE' || !summary.PhysicalResourceId) continue;
        resources.push({ type: summary.ResourceType ?? '', physicalId: summary.PhysicalResourceId });
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not exist')) return [];
    throw error;
  }
  return resources;
}

async function emptyBucket(bucket: string): Promise<void> {
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

const resources = await liveStackResources();
const physicalIds = (type: string) =>
  resources.filter((resource) => resource.type === type).map((resource) => resource.physicalId);

// The trail keeps writing to its bucket until it stops logging.
for (const trail of physicalIds('AWS::CloudTrail::Trail')) {
  await cloudTrailClient.send(new StopLoggingCommand({ Name: trail }));
}

const buckets = physicalIds('AWS::S3::Bucket');

if (buckets.length === 0) {
  console.log(`Stack ${stackName} has no buckets to empty.`);
}

for (const bucket of buckets) {
  await emptyBucket(bucket);
}
