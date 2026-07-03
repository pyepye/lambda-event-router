import type { VPCLatticeEvent, VPCLatticeResult } from '@lambda-event-router/vpclattice';
import type { Context } from 'aws-lambda';

import { inventoryRouter } from '../src/inventoryRouter.js';
import { buildSteps, type Expected, type PayloadVersion, type Step } from '../src/ordering/steps.js';

const ACCOUNT = '123456789012';
const REGION = 'eu-west-2';
const CALLER_PRINCIPAL = `arn:aws:sts::${ACCOUNT}:assumed-role/ler-example-vpclattice-ordering/session`;

const context = {
  functionName: 'ler-example-vpclattice-inventory',
  awsRequestId: 'check-routes',
  invokedFunctionArn: `arn:aws:lambda:${REGION}:${ACCOUNT}:function:ler-example-vpclattice-inventory`,
  getRemainingTimeInMillis: () => 10_000,
} as unknown as Context;

function firstValue(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

function everyValue(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

// The delivered event, copied field for field. A 1.0 payload keeps the first value of a repeated
// query param, comma joins a repeated header, and names the caller in a header. A 2.0 payload
// keeps every value and names the caller in the request context. Both leave the query string on
// the path.
function requestTarget(step: Step): string {
  const query = Object.entries(step.request.query ?? {}).flatMap(([name, value]) =>
    everyValue(value).map((entry) => `${encodeURIComponent(name)}=${encodeURIComponent(entry)}`),
  );
  return query.length > 0 ? `${step.request.path}?${query.join('&')}` : step.request.path;
}

function buildEvent(step: Step, version: PayloadVersion): VPCLatticeEvent {
  const { method, headers, body } = step.request;
  const identityHeader = `Principal=${CALLER_PRINCIPAL}; PrincipalOrgID=; PrincipalOrgPaths=; SessionName=ordering; Type=AWS_IAM`;

  if (version === '1.0') {
    return {
      method: method as 'GET',
      raw_path: requestTarget(step),
      headers: {
        ...Object.fromEntries(
          Object.entries(headers ?? {}).map(([name, value]) => [name, everyValue(value).join(',')]),
        ),
        ...(step.request.anonymous ? {} : { 'x-amzn-lattice-identity': identityHeader }),
      },
      query_string_parameters: Object.fromEntries(
        Object.entries(step.request.query ?? {}).map(([name, value]) => [name, firstValue(value)]),
      ),
      is_base64_encoded: false,
      body: body ?? '',
      request_id: 'check-routes',
    };
  }

  return {
    version: '2.0',
    method: method as 'GET',
    path: requestTarget(step),
    headers: Object.fromEntries(Object.entries(headers ?? {}).map(([name, value]) => [name, everyValue(value)])),
    queryStringParameters: Object.fromEntries(
      Object.entries(step.request.query ?? {}).map(([name, value]) => [name, everyValue(value)]),
    ),
    isBase64Encoded: false,
    body,
    requestContext: {
      serviceArn: `arn:aws:vpc-lattice:${REGION}:${ACCOUNT}:service/svc-0123456789abcdef0`,
      serviceNetworkArn: `arn:aws:vpc-lattice:${REGION}:${ACCOUNT}:servicenetwork/sn-0123456789abcdef0`,
      targetGroupArn: `arn:aws:vpc-lattice:${REGION}:${ACCOUNT}:targetgroup/tg-0123456789abcdef0`,
      region: REGION,
      timeEpoch: '1789085369211708',
      identity: step.request.anonymous
        ? { sourceVpcArn: `arn:aws:ec2:${REGION}:${ACCOUNT}:vpc/vpc-0123456789abcdef0` }
        : {
            sourceVpcArn: `arn:aws:ec2:${REGION}:${ACCOUNT}:vpc/vpc-0123456789abcdef0`,
            type: 'AWS_IAM',
            principal: CALLER_PRINCIPAL,
            sessionName: 'ordering',
          },
    },
    requestId: 'check-routes',
  };
}

// The wire lower cases every response header name, so the router's own casing is folded away
// before the expectations are compared.
function receivedHeaders(result: VPCLatticeResult): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(result.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]));
}

function problemsWith(result: VPCLatticeResult, expected: Expected): string[] {
  const problems: string[] = [];
  const body = result.body ?? '';
  const headers = receivedHeaders(result);

  if (result.statusCode !== expected.status) problems.push(`status ${result.statusCode} (${body.slice(0, 120)})`);
  if (expected.bodyIncludes && !body.includes(expected.bodyIncludes)) problems.push(`body ${body.slice(0, 200)}`);
  if (expected.bodyIs !== undefined && body !== expected.bodyIs) problems.push(`body ${JSON.stringify(body)}`);

  for (const [name, value] of Object.entries(expected.headers ?? {})) {
    const actual = headers[name];
    if (value === null && actual !== undefined) problems.push(`${name} is ${actual}`);
    if (value !== null && actual !== value) problems.push(`${name} is ${String(actual)}`);
  }

  return problems;
}

const failures: string[] = [];

for (const version of ['1.0', '2.0'] as const) {
  for (const step of buildSteps(version)) {
    const label = `${version} ${step.name}`;
    const result = await inventoryRouter.handleEvent(buildEvent(step, version), context);
    const problems = problemsWith(result, step.expected);

    if (problems.length === 0) {
      console.log(`ok   ${label}`);
    } else {
      failures.push(label);
      console.log(`FAIL ${label}: ${problems.join(', ')}`);
    }
  }
}

console.log(
  failures.length === 0 ? '\nEvery route landed where it was meant to.' : `\n${failures.length} step(s) failed.`,
);

if (failures.length > 0) process.exitCode = 1;
