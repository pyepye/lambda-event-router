import { z } from 'zod';

import { defineEventRoute } from '@lambda-event-router/base';

// --- EventBridge Scheduler: templated input for scheduled cleanup ---

const ScheduledCleanupSchema = z.object({
  action: z.literal('scheduled-cleanup'),
  config: z.object({
    retentionDays: z.number(),
    targetTable: z.string(),
  }),
});

export const scheduledCleanupRoute = defineEventRoute({
  filters: {
    customFilter: ({ event }) => event.action === 'scheduled-cleanup',
  },
  eventSchema: ScheduledCleanupSchema,
}).handle(async ({ event }) => {
  console.log(
    `Scheduled cleanup: removing records older than ${event.config.retentionDays} days from ${event.config.targetTable}`,
  );
});

// --- Step Functions Task: order processing ---

const ProcessOrderSchema = z.object({
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

export const processOrderRoute = defineEventRoute({
  filters: {
    customFilter: ({ event }) => event.taskType === 'process-order',
  },
  eventSchema: ProcessOrderSchema,
}).handle(async ({ event }) => {
  console.log(
    `Processing order ${event.orderId} with ${event.items.length} items (${event.shippingPriority} shipping)`,
  );
});

// --- IoT Core Rules Engine: temperature sensor reading ---

const TemperatureReadingSchema = z.object({
  deviceId: z.string(),
  sensorType: z.literal('temperature'),
  reading: z.object({
    value: z.number(),
    unit: z.string(),
  }),
  timestamp: z.string(),
});

export const temperatureReadingRoute = defineEventRoute({
  filters: {
    customFilter: ({ event }) => event.sensorType === 'temperature',
  },
  eventSchema: TemperatureReadingSchema,
}).handle(async ({ event }) => {
  console.log(`Device ${event.deviceId}: ${event.reading.value}${event.reading.unit} at ${event.timestamp}`);
});

// --- Direct Lambda Invocation: report generation command ---

const GenerateReportSchema = z.object({
  command: z.literal('generate-report'),
  reportId: z.string(),
  format: z.enum(['pdf', 'csv']),
  parameters: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
});

export const generateReportRoute = defineEventRoute({
  filters: {
    customFilter: ({ event }) => event.command === 'generate-report',
  },
  eventSchema: GenerateReportSchema,
}).handle(async ({ event }) => {
  console.log(
    `Generating ${event.format} report ${event.reportId} for ${event.parameters.startDate} to ${event.parameters.endDate}`,
  );
});
