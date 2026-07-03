import type { ALBEvent, ALBResult, Context } from 'aws-lambda';

import { buildSteps, type EventForm, type Expected, type Step } from '../src/requests/steps.js';
import { returnsRouter } from '../src/returnsRouter.js';

const ACCOUNT = '123456789012';
const REGION = 'eu-west-2';

const TARGET_GROUP_ARNS: Record<EventForm, string> = {
  'single-value': `arn:aws:elasticloadbalancing:${REGION}:${ACCOUNT}:targetgroup/ler-example-alb-single/50dc6c495c0c9188`,
  'multi-value': `arn:aws:elasticloadbalancing:${REGION}:${ACCOUNT}:targetgroup/ler-example-alb-multi/9f4bd2a10c3e7701`,
};

// The in-process expectations are the response the router built, so no step compares against this.
// It stands in for the listener the caller reached.
const LISTENER_ORIGIN = `http://ler-example-alb.${REGION}.elb.amazonaws.com`;

const context = {
  functionName: 'ler-example-alb-worker',
  awsRequestId: 'check-routes',
  invokedFunctionArn: `arn:aws:lambda:${REGION}:${ACCOUNT}:function:ler-example-alb-worker`,
  getRemainingTimeInMillis: () => 10_000,
} as unknown as Context;

function everyValue(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function lastValue(value: string | string[]): string {
  const values = everyValue(value);
  return values[values.length - 1] ?? '';
}

// The delivered event, copied field for field. A single-value target group sends `headers` and
// `queryStringParameters` and keeps the last value of a repeat; a multi-value one sends the two
// multi-value maps instead and keeps them all. Both hand the query string over still encoded, and
// both base64 encode a body the load balancer does not treat as text.
function buildEvent(step: Step, form: EventForm): ALBEvent {
  const { method, path, headers, query, body } = step.request;
  const base64 = Buffer.isBuffer(body);

  const single = {
    headers: Object.fromEntries(
      Object.entries(headers ?? {}).map(([name, value]) => [name.toLowerCase(), lastValue(value)]),
    ),
    queryStringParameters: Object.fromEntries(
      Object.entries(query ?? {}).map(([name, value]) => [name, encodeURIComponent(lastValue(value))]),
    ),
  };

  const multi = {
    multiValueHeaders: Object.fromEntries(
      Object.entries(headers ?? {}).map(([name, value]) => [name.toLowerCase(), everyValue(value)]),
    ),
    multiValueQueryStringParameters: Object.fromEntries(
      Object.entries(query ?? {}).map(([name, value]) => [name, everyValue(value).map(encodeURIComponent)]),
    ),
  };

  return {
    httpMethod: method,
    path,
    ...(form === 'single-value' ? single : multi),
    body: body === undefined ? null : base64 ? body.toString('base64') : body,
    isBase64Encoded: body === undefined ? false : base64,
    requestContext: { elb: { targetGroupArn: TARGET_GROUP_ARNS[form] } },
  };
}

// The wire lower cases every response header name, so the router's own casing is folded away
// before the expectations are compared. A multi-value target group reads `multiValueHeaders` and
// sends each entry to the caller, which folds a repeat into one comma joined value.
function receivedHeaders(result: ALBResult): Record<string, string | undefined> {
  const single = Object.entries(result.headers ?? {}).map(
    ([name, value]) => [name.toLowerCase(), String(value)] as const,
  );
  const multi = Object.entries(result.multiValueHeaders ?? {}).map(
    ([name, values]) => [name.toLowerCase(), values.map(String).join(', ')] as const,
  );

  return Object.fromEntries([...single, ...multi]);
}

function problemsWith(result: ALBResult, expected: Expected): string[] {
  const problems: string[] = [];
  const body = result.body ?? '';
  const headers = receivedHeaders(result);

  if (result.statusCode !== expected.status) problems.push(`status ${result.statusCode} (${body.slice(0, 120)})`);
  for (const fragment of expected.bodyIncludes === undefined ? [] : [expected.bodyIncludes].flat()) {
    if (!body.includes(fragment)) problems.push(`body ${body.slice(0, 200)}`);
  }
  if (expected.bodyExcludes !== undefined && body.includes(expected.bodyExcludes)) {
    problems.push(`body holds ${expected.bodyExcludes}`);
  }
  if (expected.bodyIs !== undefined && body !== expected.bodyIs) problems.push(`body ${JSON.stringify(body)}`);
  if (expected.bodyBase64 !== undefined && (body !== expected.bodyBase64 || !result.isBase64Encoded)) {
    problems.push(`body ${body.slice(0, 60)} with isBase64Encoded ${String(result.isBase64Encoded)}`);
  }

  for (const [name, value] of Object.entries(expected.headers ?? {})) {
    const actual = headers[name];
    if (value === null && actual !== undefined) problems.push(`${name} is ${actual}`);
    if (value !== null && actual !== value) problems.push(`${name} is ${String(actual)}`);
  }

  return problems;
}

const failures: string[] = [];

for (const form of ['single-value', 'multi-value'] as const) {
  for (const step of buildSteps(form, TARGET_GROUP_ARNS[form], LISTENER_ORIGIN)) {
    const label = `${form} ${step.name}`;
    const result = await returnsRouter.handleEvent(buildEvent(step, form), context);
    const problems = problemsWith(result, step.expectedInProcess ?? step.expected);

    if (problems.length === 0) {
      console.log(`ok   ${label}`);
    } else {
      failures.push(label);
      console.log(`FAIL ${label}: ${problems.join(', ')}`);
    }
  }
}

// A load balancer only ever delivers its own event shape, so the guard that turns another service's
// event away is reachable here and nowhere else. An API Gateway event carries a path and a method
// and no `requestContext.elb`.
const apiGatewayEvent = { httpMethod: 'GET', path: '/returns/open', requestContext: { stage: 'prod' } };

if (returnsRouter.canHandleEvent(apiGatewayEvent)) {
  failures.push('canHandleEvent an API Gateway event');
  console.log('FAIL canHandleEvent took an API Gateway event');
} else {
  console.log('ok   canHandleEvent turns an API Gateway event away');
}

console.log(
  failures.length === 0 ? '\nEvery route landed where it was meant to.' : `\n${failures.length} step(s) failed.`,
);

if (failures.length > 0) process.exitCode = 1;
