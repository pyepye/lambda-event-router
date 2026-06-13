import {
  type MessageAttributeValue,
  SendMessageBatchCommand,
  type SendMessageBatchRequestEntry,
} from '@aws-sdk/client-sqs';

import { sqsClient } from '../src/config.js';

// Queue URLs come from the CDK outputs. Pass them as args or set the env vars.
const notificationsUrl = process.argv[2] ?? process.env.NOTIFICATIONS_QUEUE_URL;
const priorityUrl = process.argv[3] ?? process.env.PRIORITY_QUEUE_URL;

if (!(notificationsUrl && priorityUrl)) {
  throw new Error('Usage: pnpm send <notificationsQueueUrl> <priorityQueueUrl>');
}

// One batch per queue. Several records in a single invocation is the only way to see partial batch
// failures and FIFO group ordering, and sending them one at a time does not reliably produce that.
function channel(value: string): Record<string, MessageAttributeValue> {
  return { channel: { DataType: 'String', StringValue: value } };
}

function notification(subject: string, category: string): string {
  return JSON.stringify({ recipient: 'ada@example.com', subject, body: 'Thanks for your order.', category });
}

const notificationEntries: SendMessageBatchRequestEntry[] = [
  {
    // sendEmail. retryCount is a Number attribute, so the handler receives 2 rather than '2'.
    Id: 'email',
    MessageAttributes: { ...channel('email'), retryCount: { DataType: 'Number', StringValue: '2' } },
    MessageBody: notification('Your receipt', 'transactional'),
  },
  {
    // holdMarketing. Matches sendEmail's channel filter too, but the custom body filter is
    // registered first and wins.
    Id: 'marketing',
    MessageAttributes: channel('email'),
    MessageBody: notification('Summer sale', 'marketing'),
  },
  {
    // failDelivery throws, so this failure comes from the handler rather than from a schema.
    Id: 'sms-handler-throws',
    MessageAttributes: channel('sms'),
    MessageBody: notification('Your code is 4821', 'transactional'),
  },
  {
    // No channel attribute and not marketing, so no route matches at all.
    Id: 'unroutable',
    MessageBody: notification('Nobody wants this', 'transactional'),
  },
  {
    // Reaches sendEmail, then fails NotificationSchema because subject is missing.
    Id: 'bad-body',
    MessageAttributes: channel('email'),
    MessageBody: JSON.stringify({ recipient: 'ada@example.com', body: 'No subject here.' }),
  },
  {
    // Reaches sendEmail, then fails NotificationAttributesSchema because retryCount will not coerce.
    Id: 'bad-attribute',
    MessageAttributes: { ...channel('email'), retryCount: { DataType: 'String', StringValue: 'soon' } },
    MessageBody: notification('Attributes are wrong', 'transactional'),
  },
  {
    // Not JSON, so the body reaches the schema as a raw string and fails.
    Id: 'not-json',
    MessageAttributes: channel('email'),
    MessageBody: 'this is not json',
  },
];

function alert(tenantId: string, alertId: string, message: string, severity: string): string {
  return JSON.stringify({ tenantId, alertId, message, severity });
}

const priorityEntries: SendMessageBatchRequestEntry[] = [
  // tenant-42 fails in the middle. The router marks the failing record and everything after it in
  // the group, so a-3 never runs and retries alongside a-2.
  { Id: 'a-1', MessageGroupId: 'tenant-42', MessageBody: alert('tenant-42', 'a-1', 'CPU usage high', 'warning') },
  { Id: 'a-2', MessageGroupId: 'tenant-42', MessageBody: JSON.stringify({ tenantId: 'tenant-42' }) },
  { Id: 'a-3', MessageGroupId: 'tenant-42', MessageBody: alert('tenant-42', 'a-3', 'CPU usage critical', 'critical') },
  // tenant-99 is a second group, processed in parallel with tenant-42 and unharmed by its failure.
  { Id: 'b-1', MessageGroupId: 'tenant-99', MessageBody: alert('tenant-99', 'b-1', 'Disk filling up', 'warning') },
  { Id: 'b-2', MessageGroupId: 'tenant-99', MessageBody: alert('tenant-99', 'b-2', 'Disk almost full', 'warning') },
  { Id: 'b-3', MessageGroupId: 'tenant-99', MessageBody: alert('tenant-99', 'b-3', 'Disk full', 'critical') },
];

await sqsClient.send(new SendMessageBatchCommand({ QueueUrl: notificationsUrl, Entries: notificationEntries }));
await sqsClient.send(new SendMessageBatchCommand({ QueueUrl: priorityUrl, Entries: priorityEntries }));

console.log(`Sent ${notificationEntries.length} notifications and ${priorityEntries.length} priority alerts.`);
