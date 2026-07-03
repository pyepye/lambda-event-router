import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';

import { buildSteps, type EventForm, type Expected } from '../src/requests/steps.js';
import { MULTI_VALUE_LISTENER_PORT, SINGLE_VALUE_LISTENER_PORT } from '../src/utils/constants.js';
import { albRequest, listenerOrigin, type RequestResult } from './albRequest.js';

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? process.env.CDK_DEFAULT_REGION;
if (!region) throw new Error('Set AWS_REGION to the region the stack is deployed in.');

const stackName = process.argv[2] ?? 'ler-example-alb';

const cloudFormation = new CloudFormationClient({ region });

const { Stacks } = await cloudFormation.send(new DescribeStacksCommand({ StackName: stackName }));
const outputs = new Map((Stacks?.[0]?.Outputs ?? []).map((entry) => [entry.OutputKey, entry.OutputValue]));

function output(key: string): string {
  const value = outputs.get(key);
  if (!value) throw new Error(`Stack ${stackName} has no output ${key}. Deploy it first.`);
  return value;
}

const host = output('AlbDnsName');

const LISTENER_PORTS: Record<EventForm, number> = {
  'single-value': SINGLE_VALUE_LISTENER_PORT,
  'multi-value': MULTI_VALUE_LISTENER_PORT,
};

const TARGET_GROUP_OUTPUTS: Record<EventForm, string> = {
  'single-value': 'SingleValueTargetGroupArn',
  'multi-value': 'MultiValueTargetGroupArn',
};

function problemsWith(received: RequestResult, expected: Expected): string[] {
  const problems: string[] = [];
  const { status, body } = received;

  if (status !== expected.status) problems.push(`status ${status} (${body.slice(0, 120)})`);
  for (const fragment of expected.bodyIncludes === undefined ? [] : [expected.bodyIncludes].flat()) {
    if (!body.includes(fragment)) problems.push(`body ${body.slice(0, 200)}`);
  }
  if (expected.bodyExcludes !== undefined && body.includes(expected.bodyExcludes)) {
    problems.push(`body holds ${expected.bodyExcludes}`);
  }
  if (expected.bodyIs !== undefined && body !== expected.bodyIs) problems.push(`body ${JSON.stringify(body)}`);
  if (expected.bodyBase64 !== undefined && received.bytes.toString('base64') !== expected.bodyBase64) {
    problems.push(`body holds ${received.bytes.length} bytes that are not the ones expected`);
  }

  for (const [name, value] of Object.entries(expected.headers ?? {})) {
    const actual = received.headers[name];
    if (value === null && actual !== undefined) problems.push(`${name} is ${actual}`);
    if (value !== null && actual !== value) problems.push(`${name} is ${String(actual)}`);
  }

  return problems;
}

const failures: string[] = [];

for (const form of ['single-value', 'multi-value'] as const) {
  const port = LISTENER_PORTS[form];

  for (const step of buildSteps(form, output(TARGET_GROUP_OUTPUTS[form]), listenerOrigin(host, port))) {
    const label = `${form} ${step.name}`;
    try {
      const received = await albRequest(host, port, step.request);
      const problems = problemsWith(received, step.expected);

      if (problems.length === 0) {
        console.log(`ok   ${label}`);
      } else {
        failures.push(label);
        console.log(`FAIL ${label}: ${problems.join(', ')}`);
      }
    } catch (error) {
      failures.push(label);
      console.log(`FAIL ${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

console.log(
  failures.length === 0
    ? `\nEvery step passed. Worker log: ${output('WorkerLogGroupName')}`
    : `\n${failures.length} step(s) failed: ${failures.join('; ')}`,
);

if (failures.length > 0) process.exitCode = 1;
