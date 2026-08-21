import { SendMessageBatchCommand } from '@aws-sdk/client-sqs';

import { QUEUE_URL, sqs } from '../config.js';

const MAX_BATCH_ENTRIES = 10;

export interface OutboundMessage {
  type: string;
  data: unknown;
}

export async function sendSQSMessages(messages: OutboundMessage[]): Promise<void> {
  for (let start = 0; start < messages.length; start += MAX_BATCH_ENTRIES) {
    const entries = messages.slice(start, start + MAX_BATCH_ENTRIES).map((message, index) => ({
      Id: String(start + index),
      MessageBody: JSON.stringify(message.data),
      MessageAttributes: {
        type: { DataType: 'String', StringValue: message.type },
      },
    }));

    const result = await sqs.send(new SendMessageBatchCommand({ QueueUrl: QUEUE_URL, Entries: entries }));

    // SendMessageBatch reports per-entry failures in the response rather than throwing.
    if (result.Failed?.length) {
      const reasons = result.Failed.map((failure) => failure.Message ?? failure.Code).join(', ');
      throw new Error(`Failed to send ${result.Failed.length} SQS messages: ${reasons}`);
    }
  }
}
