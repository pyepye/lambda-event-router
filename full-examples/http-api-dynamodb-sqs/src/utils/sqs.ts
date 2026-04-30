import {
  type MessageAttributeValue,
  type MessageSystemAttributeValue,
  SendMessageBatchCommand,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';

import { sqs } from '../config.js';
import { buildHeaderFromSegment } from './traceId/segment.js';
import { tracer } from './traceId/tracer.js';

// The X-Ray-captured SQS client auto-injects AWSTraceHeader using the *primary* lambda segment's
// trace_id. That ignores any subsegment we manually re-rooted onto an upstream trace (DDB stream
// stitching). Build the header from the currently-active (sub)segment so it carries the right
// trace_id all the way through the SQS hop.
function buildTraceSystemAttributes(): Record<string, MessageSystemAttributeValue> | undefined {
  const header = buildHeaderFromSegment(tracer.getSegment());
  if (!header) return undefined;
  return { AWSTraceHeader: { DataType: 'String', StringValue: header } };
}

export async function sendSQSMessage(queueUrl: string, type: string, data: unknown): Promise<void> {
  const messageAttributes: Record<string, MessageAttributeValue> = {
    type: { DataType: 'String', StringValue: type },
  };
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageAttributes: messageAttributes,
      MessageSystemAttributes: buildTraceSystemAttributes(),
      MessageBody: JSON.stringify(data),
    }),
  );
}

export interface OutboundMessage {
  type: string;
  data: unknown;
}

export async function sendSQSMessages(queueUrl: string, messages: OutboundMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const messageSystemAttributes = buildTraceSystemAttributes();
  const entries = messages.map((message, index) => ({
    Id: String(index),
    MessageBody: JSON.stringify(message.data),
    MessageAttributes: {
      type: { DataType: 'String', StringValue: message.type },
    },
    MessageSystemAttributes: messageSystemAttributes,
  }));

  await sqs.send(new SendMessageBatchCommand({ QueueUrl: queueUrl, Entries: entries }));
}
