import {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  type InputLogEvent,
  PutLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';

import {
  AUDIT_LOG_GROUP,
  CHECKOUT_LOG_GROUP,
  LEGACY_LOG_GROUP,
  PAYMENTS_LOG_GROUP,
  REFUNDS_LOG_GROUP,
} from '../src/config.js';

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? process.env.CDK_DEFAULT_REGION;

if (!region) {
  throw new Error('Set AWS_REGION to the region the stack is deployed in.');
}

const logsClient = new CloudWatchLogsClient({ region });

// A fresh stream per run, so a second run needs no teardown after the first.
const logStreamName = `run-${Date.now()}`;

// PutLogEvents rejects a batch that is not in timestamp order, so each line gets the next millisecond.
function timestamped(messages: string[]): InputLogEvent[] {
  const start = Date.now();
  return messages.map((message, index) => ({ message, timestamp: start + index }));
}

const deliveries: [string, string[]][] = [
  [
    // Four lines through two filters. checkout-errors takes the one ERROR line, checkout-traffic
    // takes all four, so this group produces two deliveries down two different routes.
    CHECKOUT_LOG_GROUP,
    [
      'INFO checkout started order=AB-1029',
      'INFO basket priced order=AB-1029 total=4250',
      'ERROR payment authorisation failed order=AB-1029 code=51',
      'INFO checkout abandoned order=AB-1029',
    ],
  ],
  [
    // One declined line among three, which is what the custom filter looks for.
    PAYMENTS_LOG_GROUP,
    [
      '{"event":"payment.authorised","orderRef":"AB-1029","amount":4250}',
      '{"event":"payment.declined","orderRef":"AB-1030","reason":"insufficient_funds"}',
      '{"event":"payment.authorised","orderRef":"AB-1031","amount":990}',
    ],
  ],
  [
    // Same wildcard as the payments group and nothing declined, so the custom filter turns it down.
    REFUNDS_LOG_GROUP,
    [
      '{"event":"refund.issued","orderRef":"AB-1002","amount":1500}',
      '{"event":"refund.issued","orderRef":"AB-1004","amount":2300}',
    ],
  ],
  [
    AUDIT_LOG_GROUP,
    [
      '{"actor":"admin@example.com","action":"role.granted","subject":"ops-oncall"}',
      '{"actor":"admin@example.com","action":"key.rotated","subject":"checkout-api"}',
    ],
  ],
  [LEGACY_LOG_GROUP, ['nightly reconciliation completed rows=18422']],
];

for (const [logGroupName, messages] of deliveries) {
  await logsClient.send(new CreateLogStreamCommand({ logGroupName, logStreamName }));
  await logsClient.send(new PutLogEventsCommand({ logGroupName, logStreamName, logEvents: timestamped(messages) }));
  console.log(`Wrote ${messages.length} line(s) to ${logGroupName}/${logStreamName}`);
}

console.log(`\nWrote to ${deliveries.length} log groups behind 6 subscription filters.`);
