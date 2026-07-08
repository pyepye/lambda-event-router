import type { ConnectEvent } from '@lambda-event-router/connect';
import type { Context } from 'aws-lambda';

import type { Expected, RouterStep } from '../src/contactFlow/steps.js';
import { DEPLOYED_INSTANCE_ARN, routerSteps } from '../src/contactFlow/steps.js';

// The instanceArn filters read the environment when the router module loads, so the value has to be
// in place before the import runs.
process.env.CONNECT_INSTANCE_ARN = DEPLOYED_INSTANCE_ARN;
const { connectRouter } = await import('../src/connect.js');

const ACCOUNT = '123456789012';
const REGION = 'eu-west-2';

const context = {
  functionName: 'ler-example-connect-worker',
  awsRequestId: 'check-routes',
  invokedFunctionArn: `arn:aws:lambda:${REGION}:${ACCOUNT}:function:ler-example-connect-worker`,
  getRemainingTimeInMillis: () => 10_000,
} as unknown as Context;

// The delivered event, copied field for field. A chat contact has no customer endpoint and no queue,
// and Connect sends both as null rather than leaving them off.
function buildEvent(step: RouterStep): ConnectEvent {
  return {
    Name: 'ContactFlowEvent',
    Details: {
      ContactData: {
        Attributes: step.attributes ?? {},
        Channel: step.channel,
        ContactId: 'check-routes-contact',
        CustomerEndpoint: null,
        InitialContactId: 'check-routes-contact',
        InitiationMethod: step.initiationMethod,
        InstanceARN: step.instanceArn ?? DEPLOYED_INSTANCE_ARN,
        PreviousContactId: 'check-routes-contact',
        Queue: null,
        SystemEndpoint: null,
        MediaStreams: { Customer: { Audio: null } },
      },
      Parameters: step.parameters ?? {},
    },
  };
}

function problemsWith(result: unknown, error: unknown, expected: Expected): string[] {
  const problems: string[] = [];

  if (error !== undefined) {
    const message = error instanceof Error ? error.message : String(error);
    if (!expected.errorIncludes) return [`threw ${message}`];
    if (!message.includes(expected.errorIncludes)) problems.push(`threw ${message}`);
    return problems;
  }

  const serialised = JSON.stringify(result) ?? 'undefined';

  if (expected.errorIncludes) return [`returned ${serialised.slice(0, 200)} instead of throwing`];
  for (const fragment of expected.resultIncludes ?? []) {
    if (!serialised.includes(fragment)) problems.push(`returned ${serialised.slice(0, 200)}`);
  }

  return problems;
}

const failures: string[] = [];

function report(label: string, problems: string[]): void {
  if (problems.length === 0) {
    console.log(`ok   ${label}`);
    return;
  }
  failures.push(label);
  console.log(`FAIL ${label}: ${problems.join(', ')}`);
}

for (const step of routerSteps) {
  const event = buildEvent(step);
  try {
    report(step.name, problemsWith(await connectRouter.handleEvent(event, context), undefined, step.expected));
  } catch (error) {
    report(step.name, problemsWith(undefined, error, step.expected));
  }
}

const claims: [string, boolean][] = [
  ['the router takes a contact flow event', connectRouter.canHandleEvent(buildEvent(routerSteps[0] as RouterStep))],
  ['the router turns a plain object away', !connectRouter.canHandleEvent({ Details: {} })],
  ['the router turns an SQS event away', !connectRouter.canHandleEvent({ Records: [] })],
];

for (const [label, held] of claims) {
  report(label, held ? [] : ['did not hold']);
}

console.log(
  failures.length === 0 ? '\nEvery block landed where it was meant to.' : `\n${failures.length} step(s) failed.`,
);

if (failures.length > 0) process.exitCode = 1;
