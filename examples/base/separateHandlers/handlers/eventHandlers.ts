import { z } from 'zod';

import type { EventRequest } from '@lambda-event-router/base';

// --- EventBridge Scheduler: templated input for scheduled cleanup ---

export const ScheduledCleanupSchema = z.object({
  action: z.literal('scheduled-cleanup'),
  config: z.object({
    retentionDays: z.number(),
    targetTable: z.string(),
  }),
});

type TScheduledCleanup = z.infer<typeof ScheduledCleanupSchema>;

export async function handleScheduledCleanup({ event }: EventRequest<TScheduledCleanup>): Promise<void> {
  console.log(
    `Scheduled cleanup: removing records older than ${event.config.retentionDays} days from ${event.config.targetTable}`,
  );
}

// --- Step Functions Task: order processing ---

export const ProcessOrderSchema = z.object({
  taskType: z.literal('process-order'),
  orderId: z.string(),
  items: z.array(
    z.object({
      sku: z.string(),
      quantity: z.number(),
    }),
  ),
  shippingPriority: z.enum(['standard', 'express', 'overnight']),
});

type TProcessOrder = z.infer<typeof ProcessOrderSchema>;

export async function handleProcessOrder({ event }: EventRequest<TProcessOrder>): Promise<void> {
  console.log(
    `Processing order ${event.orderId} with ${event.items.length} items (${event.shippingPriority} shipping)`,
  );
}

// --- IoT Core Rules Engine: temperature sensor reading ---

export const TemperatureReadingSchema = z.object({
  deviceId: z.string(),
  sensorType: z.literal('temperature'),
  reading: z.object({
    value: z.number(),
    unit: z.string(),
  }),
  timestamp: z.string(),
});

type TTemperatureReading = z.infer<typeof TemperatureReadingSchema>;

export async function handleTemperatureReading({ event }: EventRequest<TTemperatureReading>): Promise<void> {
  console.log(`Device ${event.deviceId}: ${event.reading.value}${event.reading.unit} at ${event.timestamp}`);
}

// --- Direct Lambda Invocation: report generation command ---

export const GenerateReportSchema = z.object({
  command: z.literal('generate-report'),
  reportId: z.string(),
  format: z.enum(['pdf', 'csv']),
  parameters: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
});

type TGenerateReport = z.infer<typeof GenerateReportSchema>;

export async function handleGenerateReport({ event }: EventRequest<TGenerateReport>): Promise<void> {
  console.log(
    `Generating ${event.format} report ${event.reportId} for ${event.parameters.startDate} to ${event.parameters.endDate}`,
  );
}
