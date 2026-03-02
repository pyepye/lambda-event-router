import { defineRoute, type KinesisFilterInput } from '@lambda-event-router/kinesis';
import { z } from 'zod';

const HighPriorityDataSchema = z.object({
  alertId: z.string(),
  severity: z.enum(['CRITICAL', 'HIGH']),
  message: z.string(),
  source: z.string(),
});

function isHighPriority({ partitionKey }: KinesisFilterInput): boolean {
  return partitionKey.startsWith('priority-');
}

export const highPriorityRoute = defineRoute({
  filters: {
    customFilter: isHighPriority,
  },
  dataSchema: HighPriorityDataSchema,
}).handle(async ({ data, approximateArrivalTimestamp }) => {
  const { alertId, severity, message, source } = data;

  const processingLatencyMs = Date.now() - approximateArrivalTimestamp;
  const escalate = severity === 'CRITICAL' || processingLatencyMs > 5000;
  const channel = escalate ? 'pagerduty' : 'slack';

  console.log('Processing high priority alert', {
    alertId,
    severity,
    message,
    source,
    processingLatencyMs,
    escalate,
    channel,
  });
});
