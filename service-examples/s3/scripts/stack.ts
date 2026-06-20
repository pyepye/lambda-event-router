import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';

export interface StackOutputs {
  uploadsBucket: string;
  reportsBucket: string;
  batchOpsBucket: string;
  workerFunctionArn: string;
  batchJobRoleArn: string;
  accountId: string;
}

const cloudFormationClient = new CloudFormationClient({});

// The SDK reads the region from AWS_REGION and then from the profile. Failing here says so once,
// rather than letting every client fail separately at the point of use.
export async function resolveRegion(): Promise<string> {
  try {
    const region = await cloudFormationClient.config.region();
    if (region) return region;
  } catch {
    // Fall through to the same message.
  }
  throw new Error('No AWS region. Set AWS_REGION, or set a region on the profile you are using.');
}

export async function readStackOutputs(stackName: string): Promise<StackOutputs> {
  const { Stacks } = await cloudFormationClient.send(new DescribeStacksCommand({ StackName: stackName }));
  const outputs = Stacks?.[0]?.Outputs ?? [];

  const read = (key: string): string => {
    const value = outputs.find((output) => output.OutputKey === key)?.OutputValue;
    if (!value) throw new Error(`Stack ${stackName} has no output named ${key}. Deploy it first.`);
    return value;
  };

  const workerFunctionArn = read('WorkerFunctionArn');

  return {
    uploadsBucket: read('UploadsBucketName'),
    reportsBucket: read('ReportsBucketName'),
    batchOpsBucket: read('BatchOpsBucketName'),
    workerFunctionArn,
    batchJobRoleArn: read('BatchJobRoleArn'),
    // arn:aws:lambda:<region>:<account>:function:<name>
    accountId: workerFunctionArn.split(':')[4] ?? '',
  };
}
