import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';

import type { Report } from '../src/orderingService.js';

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? process.env.CDK_DEFAULT_REGION;
if (!region) throw new Error('Set AWS_REGION to the region the stack is deployed in.');

const stackName = process.argv[2] ?? 'ler-example-vpclattice';

const cloudFormation = new CloudFormationClient({ region });
const lambda = new LambdaClient({ region });

const { Stacks } = await cloudFormation.send(new DescribeStacksCommand({ StackName: stackName }));
const outputs = new Map((Stacks?.[0]?.Outputs ?? []).map((entry) => [entry.OutputKey, entry.OutputValue]));

function output(key: string): string {
  const value = outputs.get(key);
  if (!value) throw new Error(`Stack ${stackName} has no output ${key}. Deploy it first.`);
  return value;
}

// The Lattice service only resolves inside the associated VPC, so the requests are made by the
// ordering function and this prints what it reports back.
const invocation = await lambda.send(
  new InvokeCommand({ FunctionName: output('OrderingFunctionName'), Payload: '{}' }),
);

if (!invocation.Payload) throw new Error('The ordering function returned nothing.');
const payload = Buffer.from(invocation.Payload).toString();

if (invocation.FunctionError) {
  console.log(payload);
  throw new Error(`The ordering function failed: ${invocation.FunctionError}`);
}

const report = JSON.parse(payload) as Report;
for (const line of report.lines) console.log(line);

console.log(
  report.failures.length === 0
    ? `\nEvery step passed. Inventory log: ${output('InventoryLogGroupName')}`
    : `\n${report.failures.length} step(s) failed: ${report.failures.join('; ')}`,
);

if (report.failures.length > 0) process.exitCode = 1;
