import { gzipSync } from 'node:zlib';
import type { CloudWatchLogsDecodedData, CloudWatchLogsEvent, CloudWatchLogsLogEvent, Context } from 'aws-lambda';
import { cloudwatchRouter } from '../src/cloudwatch.js';
import {
  AUDIT_LOG_GROUP,
  AUDIT_TRAFFIC_FILTER,
  CHECKOUT_ERRORS_FILTER,
  CHECKOUT_LOG_GROUP,
  CHECKOUT_TRAFFIC_FILTER,
  LEGACY_LOG_GROUP,
  LEGACY_TRAFFIC_FILTER,
  PAYMENTS_LOG_GROUP,
  PAYMENTS_TRAFFIC_FILTER,
  REFUNDS_LOG_GROUP,
  REFUNDS_TRAFFIC_FILTER,
} from '../src/config.js';

// The logger builds itself on the first call rather than on import, so setting this here still lands.
// JSON is the format the deployed worker writes.
process.env.AWS_LAMBDA_LOG_FORMAT = 'JSON';

const ACCOUNT = '123456789012';
const REGION = 'eu-west-2';

const context = {
  functionName: 'ler-example-cloudwatch-worker',
  awsRequestId: 'check-routes',
  invokedFunctionArn: `arn:aws:lambda:${REGION}:${ACCOUNT}:function:ler-example-cloudwatch-worker`,
  getRemainingTimeInMillis: () => 10_000,
} as unknown as Context;

interface Delivery {
  name: string;
  logGroup: string;
  subscriptionFilter: string;
  messages: string[];
  messageType?: 'DATA_MESSAGE' | 'CONTROL_MESSAGE';
  expected: { logIncludes?: string[]; errorIncludes?: string };
}

// The delivered event, copied field for field. CloudWatch Logs gzips the decoded payload and sends
// it base64 encoded under awslogs.data.
function buildEvent(delivery: Delivery): CloudWatchLogsEvent {
  const logEvents: CloudWatchLogsLogEvent[] = delivery.messages.map((message, index) => ({
    id: `3${index}`.padEnd(56, '0'),
    timestamp: 1_726_300_000_000 + index,
    message,
  }));

  const decoded: CloudWatchLogsDecodedData = {
    owner: ACCOUNT,
    logGroup: delivery.logGroup,
    logStream: 'run-check-routes',
    subscriptionFilters: [delivery.subscriptionFilter],
    messageType: delivery.messageType ?? 'DATA_MESSAGE',
    logEvents,
  };

  return { awslogs: { data: gzipSync(Buffer.from(JSON.stringify(decoded))).toString('base64') } };
}

const deliveries: Delivery[] = [
  {
    name: 'checkout error line reaches escalateCheckoutFailure',
    logGroup: CHECKOUT_LOG_GROUP,
    subscriptionFilter: CHECKOUT_ERRORS_FILTER,
    messages: ['ERROR payment authorisation failed order=AB-1029 code=51'],
    expected: { logIncludes: ['Handling log delivery', 'Incident opened', 'Checkout failure escalated'] },
  },
  {
    name: 'checkout traffic reaches indexCheckoutTraffic',
    logGroup: CHECKOUT_LOG_GROUP,
    subscriptionFilter: CHECKOUT_TRAFFIC_FILTER,
    messages: ['INFO checkout started order=AB-1029', 'INFO checkout abandoned order=AB-1029'],
    expected: { logIncludes: ['Checkout traffic indexed', '"indexedCount":2'] },
  },
  {
    name: 'a declined payment reaches quarantineDeclinedPayment',
    logGroup: PAYMENTS_LOG_GROUP,
    subscriptionFilter: PAYMENTS_TRAFFIC_FILTER,
    messages: ['{"event":"payment.authorised"}', '{"event":"payment.declined"}'],
    expected: { logIncludes: ['Declined payment quarantined', '"declinedCount":1', '"heldCount":2'] },
  },
  {
    name: 'refunds reach archivePaymentTraffic',
    logGroup: REFUNDS_LOG_GROUP,
    subscriptionFilter: REFUNDS_TRAFFIC_FILTER,
    messages: ['{"event":"refund.issued"}'],
    expected: { logIncludes: ['Payment traffic archived', '"archivedCount":1'] },
  },
  {
    name: 'audit records reach forwardAuditToSiem, which throws',
    logGroup: AUDIT_LOG_GROUP,
    subscriptionFilter: AUDIT_TRAFFIC_FILTER,
    messages: ['{"action":"role.granted"}'],
    expected: { errorIncludes: 'SIEM endpoint unreachable' },
  },
  {
    name: 'an audit control message reaches the same route',
    logGroup: AUDIT_LOG_GROUP,
    subscriptionFilter: AUDIT_TRAFFIC_FILTER,
    messages: ['CWL CONTROL MESSAGE: Checking health of destination Lambda.'],
    messageType: 'CONTROL_MESSAGE',
    expected: { errorIncludes: 'SIEM endpoint unreachable' },
  },
  {
    name: 'a checkout control message matches no route',
    logGroup: CHECKOUT_LOG_GROUP,
    subscriptionFilter: CHECKOUT_TRAFFIC_FILTER,
    messages: ['CWL CONTROL MESSAGE: Checking health of destination Lambda.'],
    messageType: 'CONTROL_MESSAGE',
    expected: { errorIncludes: `No route matched for log group ${CHECKOUT_LOG_GROUP}` },
  },
  {
    name: 'the legacy group matches no route',
    logGroup: LEGACY_LOG_GROUP,
    subscriptionFilter: LEGACY_TRAFFIC_FILTER,
    messages: ['nightly reconciliation completed rows=18422'],
    expected: { errorIncludes: `No route matched for log group ${LEGACY_LOG_GROUP}` },
  },
];

// Handlers report by logging, so the log is the only place a route match shows up.
async function runCapturingLogs(event: CloudWatchLogsEvent): Promise<{ logged: string; error?: unknown }> {
  const lines: string[] = [];
  const collect = (...args: unknown[]): void => {
    lines.push(JSON.stringify(args));
  };

  const { log, debug, warn, error } = console;
  Object.assign(console, { log: collect, debug: collect, warn: collect, error: collect });

  try {
    await cloudwatchRouter.handleEvent(event, context);
    return { logged: lines.join('\n') };
  } catch (thrown) {
    return { logged: lines.join('\n'), error: thrown };
  } finally {
    Object.assign(console, { log, debug, warn, error });
  }
}

function problemsWith(logged: string, error: unknown, expected: Delivery['expected']): string[] {
  if (expected.errorIncludes) {
    if (error === undefined) return [`did not throw, logged ${logged.slice(0, 200)}`];
    const message = error instanceof Error ? error.message : String(error);
    return message.includes(expected.errorIncludes) ? [] : [`threw ${message}`];
  }

  if (error !== undefined) return [`threw ${error instanceof Error ? error.message : String(error)}`];

  return (expected.logIncludes ?? [])
    .filter((fragment) => !logged.includes(fragment))
    .map((fragment) => `logged nothing containing ${fragment}`);
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

for (const delivery of deliveries) {
  const { logged, error } = await runCapturingLogs(buildEvent(delivery));
  report(delivery.name, problemsWith(logged, error, delivery.expected));
}

const sampleEvent = buildEvent(deliveries[0] as Delivery);

const claims: [string, boolean][] = [
  ['the router takes a CloudWatch Logs event', cloudwatchRouter.canHandleEvent(sampleEvent)],
  ['the router turns an SQS event away', !cloudwatchRouter.canHandleEvent({ Records: [] })],
  ['the router turns a plain object away', !cloudwatchRouter.canHandleEvent({ awslogs: { data: 123 } })],
];

for (const [label, held] of claims) {
  report(label, held ? [] : ['did not hold']);
}

console.log(
  failures.length === 0 ? '\nEvery delivery landed where it was meant to.' : `\n${failures.length} check(s) failed.`,
);

if (failures.length > 0) process.exitCode = 1;
