import type { Context } from 'aws-lambda';

import { sfnClient } from '../src/config.js';
import { stepFunctionsRouter } from '../src/stepfunctions.js';

// The logger builds itself on the first call. JSON is the format the deployed worker writes, and
// constructing a LambdaRouter logs, so src/index.js has to load after this line.
process.env.AWS_LAMBDA_LOG_FORMAT = 'JSON';

const { handler } = await import('../src/index.js');

const ACCOUNT = '123456789012';
const REGION = 'eu-west-2';
const ORDER_ID = 'AB-1029';
const TASK_TOKEN = 'AAAAKgAAAAIAAAAAAAAAAexample-token';

const context = {
  functionName: 'ler-example-stepfunctions-worker',
  awsRequestId: 'check-routes',
  invokedFunctionArn: `arn:aws:lambda:${REGION}:${ACCOUNT}:function:ler-example-stepfunctions-worker`,
  getRemainingTimeInMillis: () => 10_000,
} as unknown as Context;

interface TaskResponse {
  command: string;
  input: Record<string, unknown>;
}

const taskResponses: TaskResponse[] = [];

// The callback handlers report their decision to Step Functions. Record the call instead of making it.
sfnClient.send = (async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
  taskResponses.push({ command: command.constructor.name, input: command.input });
  return {};
}) as unknown as typeof sfnClient.send;

interface Task {
  name: string;
  event: unknown;
  expected: {
    logIncludes?: string[];
    returns?: unknown;
    errorIncludes?: string;
    respondsWith?: { command: string; includes: string[] };
  };
}

const tasks: Task[] = [
  {
    name: 'a reserve-stock payload reaches reserveStock',
    event: { task: 'reserve-stock', orderId: ORDER_ID, sku: 'SKU-8891', quantity: 2 },
    expected: {
      logIncludes: ['Handling Step Functions task', 'Order context resolved', 'Stock reserved'],
      returns: { step: 'reserveStock', reservationId: 'RES-AB-1029', sku: 'SKU-8891', quantity: 2, warehouse: 'LDN-1' },
    },
  },
  {
    name: 'a charge-payment payload reaches chargePayment through an async filter',
    event: { task: 'charge-payment', orderId: ORDER_ID, amountPence: 4250, currency: 'GBP' },
    expected: {
      logIncludes: ['Payment captured'],
      returns: { step: 'chargePayment', paymentId: 'PAY-AB-1029', capturedPence: 4250, currency: 'GBP' },
    },
  },
  {
    name: 'a fraud-review callback reaches approveFraudReview and sends task success',
    event: { TaskToken: TASK_TOKEN, task: 'fraud-review', orderId: ORDER_ID, riskScore: 12 },
    expected: {
      logIncludes: ['Fraud review context resolved', '"taskTokenInInput":false', '"taskTokenInEvent":true'],
      respondsWith: { command: 'SendTaskSuccessCommand', includes: ['"decision":"approved"', TASK_TOKEN] },
    },
  },
  {
    name: 'a manual-release callback falls through to failUnknownCallback',
    event: { TaskToken: TASK_TOKEN, task: 'manual-release', orderId: ORDER_ID, holdReason: 'address-mismatch' },
    expected: {
      logIncludes: ['Unknown callback task refused'],
      respondsWith: { command: 'SendTaskFailureCommand', includes: ['UnknownCallbackTask', 'manual-release'] },
    },
  },
  {
    name: 'a reserve-stock payload with a token skips reserveStock for failUnknownCallback',
    event: { TaskToken: TASK_TOKEN, task: 'reserve-stock', orderId: ORDER_ID, sku: 'SKU-8891', quantity: 2 },
    expected: {
      logIncludes: ['Unknown callback task refused'],
      respondsWith: { command: 'SendTaskFailureCommand', includes: ['UnknownCallbackTask', 'reserve-stock'] },
    },
  },
  {
    name: 'a release-stock-hold payload reaches releaseStockHold, which throws',
    event: { task: 'release-stock-hold', orderId: ORDER_ID, reservationId: 'RES-AB-1029' },
    expected: { errorIncludes: 'Warehouse API unavailable for RES-AB-1029' },
  },
  {
    name: 'a reconcile-ledger payload matches no route',
    event: { task: 'reconcile-ledger', orderId: ORDER_ID, period: '2026-09' },
    expected: { errorIncludes: 'No route matched for Step Functions event' },
  },
  {
    name: 'a charge-payment payload with a worded total fails its schema',
    event: { task: 'charge-payment', orderId: ORDER_ID, amountPence: 'four thousand', currency: 'GBP' },
    expected: { errorIncludes: 'Event validation failed' },
  },
  {
    name: 'a fraud-review callback with no risk score fails its schema',
    event: { TaskToken: TASK_TOKEN, task: 'fraud-review', orderId: ORDER_ID },
    expected: { errorIncludes: 'Event validation failed' },
  },
];

// Handlers report by logging and by what they return, so both are captured.
async function runCapturingLogs(event: unknown): Promise<{ logged: string; result?: unknown; error?: unknown }> {
  const lines: string[] = [];
  const collect = (...args: unknown[]): void => {
    lines.push(JSON.stringify(args));
  };

  const { log, debug, warn, error } = console;
  Object.assign(console, { log: collect, debug: collect, warn: collect, error: collect });

  try {
    const result = await stepFunctionsRouter.handleEvent(event, context);
    return { logged: lines.join('\n'), result };
  } catch (thrown) {
    return { logged: lines.join('\n'), error: thrown };
  } finally {
    Object.assign(console, { log, debug, warn, error });
  }
}

// SendTaskSuccess carries its output as a JSON string, so it is parsed back before matching.
function describeResponse(response: TaskResponse): string {
  const input = { ...response.input };
  if (typeof input.output === 'string') {
    input.output = JSON.parse(input.output);
  }
  return `${response.command} ${JSON.stringify(input)}`;
}

function problemsWith(
  logged: string,
  result: unknown,
  error: unknown,
  responses: TaskResponse[],
  expected: Task['expected'],
): string[] {
  if (expected.errorIncludes) {
    if (error === undefined) return [`did not throw, logged ${logged.slice(0, 200)}`];
    const message = error instanceof Error ? error.message : String(error);
    return message.includes(expected.errorIncludes) ? [] : [`threw ${message}`];
  }

  if (error !== undefined) return [`threw ${error instanceof Error ? error.message : String(error)}`];

  const problems = (expected.logIncludes ?? [])
    .filter((fragment) => !logged.includes(fragment))
    .map((fragment) => `logged nothing containing ${fragment}`);

  if (expected.returns !== undefined && JSON.stringify(result) !== JSON.stringify(expected.returns)) {
    problems.push(`returned ${JSON.stringify(result)}`);
  }

  if (expected.respondsWith) {
    const sent = responses.map(describeResponse).join('\n');
    if (!responses.some((response) => response.command === expected.respondsWith?.command)) {
      problems.push(`sent ${sent || 'nothing'} rather than ${expected.respondsWith.command}`);
    }
    problems.push(
      ...expected.respondsWith.includes
        .filter((fragment) => !sent.includes(fragment))
        .map((fragment) => `sent nothing containing ${fragment}`),
    );
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

for (const task of tasks) {
  taskResponses.length = 0;
  const { logged, result, error } = await runCapturingLogs(task.event);
  report(task.name, problemsWith(logged, result, error, [...taskResponses], task.expected));
}

const scheduledEvent = { source: 'aws.events', 'detail-type': 'Scheduled Event', detail: { orderId: ORDER_ID } };

// A scheduled event reaches the same worker the state machine invokes, so it goes through
// LambdaRouter rather than straight to the router.
async function routerFor(event: unknown): Promise<string> {
  try {
    await handler(event, context, () => {});
    return 'the handler returned';
  } catch (thrown) {
    return thrown instanceof Error ? thrown.message : String(thrown);
  }
}

const routerDeclined = await routerFor(scheduledEvent);
const reconcileDeclined = await routerFor({ task: 'reconcile-ledger', orderId: ORDER_ID, period: '2026-09' });

const claims: [string, boolean][] = [
  ['the router takes a plain task payload', await stepFunctionsRouter.canHandleEvent({ task: 'reserve-stock' })],
  [
    'the router turns an SQS event away',
    !(await stepFunctionsRouter.canHandleEvent({ Records: [{ eventSource: 'aws:sqs' }] })),
  ],
  ['the router turns a bare string away', !(await stepFunctionsRouter.canHandleEvent('reserve-stock'))],
  ['the router turns a scheduled EventBridge event away', !(await stepFunctionsRouter.canHandleEvent(scheduledEvent))],
  [
    'the router turns away a task name no route claims',
    !(await stepFunctionsRouter.canHandleEvent({ task: 'reconcile-ledger' })),
  ],
  ['a scheduled EventBridge event finds no router at all', routerDeclined === 'No router found for event'],
  ['a reconcile-ledger payload finds no router at all', reconcileDeclined === 'No router found for event'],
];

for (const [label, held] of claims) {
  report(label, held ? [] : ['did not hold']);
}

console.log(
  failures.length === 0 ? '\nEvery task landed where it was meant to.' : `\n${failures.length} check(s) failed.`,
);

if (failures.length > 0) process.exitCode = 1;
