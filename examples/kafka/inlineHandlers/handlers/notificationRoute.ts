import { z } from 'zod';

import { defineRoute } from '@lambda-event-router/kafka';

import { MSK_CLUSTER_ARN, NOTIFICATIONS_TOPIC } from '../constants.js';

const NotificationValueSchema = z.object({
  userId: z.string(),
  channel: z.enum(['EMAIL', 'SMS', 'PUSH']),
  message: z.string(),
});

// eventSourceArns filter only applies to MSK events (not self-managed Kafka)
export const notificationRoute = defineRoute({
  filters: {
    topic: NOTIFICATIONS_TOPIC,
    eventSourceArn: MSK_CLUSTER_ARN,
  },
  valueSchema: NotificationValueSchema,
}).handle(async (request) => {
  const { userId, channel, message } = request.value;
  console.log(`Sending ${channel} notification to ${userId}: ${message}`);
});
