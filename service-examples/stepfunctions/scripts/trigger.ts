import { setTimeout as sleep } from 'node:timers/promises';

import {
  DescribeExecutionCommand,
  ListStateMachinesCommand,
  SFNClient,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn';

import { STATE_MACHINE_NAME } from '../src/config.js';

const ORDER_ID = 'AB-1029';
const POLL_INTERVAL_MS = 2000;
const POLL_ATTEMPTS = 90;

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? process.env.CDK_DEFAULT_REGION;

if (!region) {
  throw new Error('Set AWS_REGION to the region the stack is deployed in.');
}

const sfnClient = new SFNClient({ region });

const { stateMachines } = await sfnClient.send(new ListStateMachinesCommand({ maxResults: 1000 }));
const stateMachineArn = stateMachines?.find((machine) => machine.name === STATE_MACHINE_NAME)?.stateMachineArn;

if (!stateMachineArn) {
  throw new Error(`No state machine named ${STATE_MACHINE_NAME} in ${region}. Deploy the stack first.`);
}

// A fresh execution name per run, so a second run needs no teardown after the first.
const { executionArn } = await sfnClient.send(
  new StartExecutionCommand({
    stateMachineArn,
    name: `run-${Date.now()}`,
    input: JSON.stringify({ orderId: ORDER_ID }),
  }),
);

console.log(`Started ${executionArn}`);

async function waitForExecution(): Promise<{ status: string; output?: string }> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    const execution = await sfnClient.send(new DescribeExecutionCommand({ executionArn }));
    if (execution.status !== 'RUNNING') {
      return { status: execution.status ?? 'UNKNOWN', output: execution.output };
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Execution still running after ${(POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`);
}

const { status, output } = await waitForExecution();

console.log(`Execution ${status}\n`);

if (!output) {
  throw new Error('Execution finished with no output.');
}

interface BranchResult {
  step?: string;
  error?: { Error?: string; Cause?: string };
}

const results = JSON.parse(output) as BranchResult[];

for (const result of results) {
  const outcome = result.error ? `failed with ${result.error.Error}` : 'returned a result';
  console.log(`${result.step ?? 'unnamed'}: ${outcome}`);
}

console.log(`\n${JSON.stringify(results, null, 2)}`);
