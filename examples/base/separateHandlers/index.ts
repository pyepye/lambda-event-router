import type { Handler } from 'aws-lambda';

import { createEventRouter, LambdaRouter } from '@lambda-event-router/base';

import {
  GenerateReportSchema,
  handleGenerateReport,
  handleProcessOrder,
  handleScheduledCleanup,
  handleTemperatureReading,
  ProcessOrderSchema,
  ScheduledCleanupSchema,
  TemperatureReadingSchema,
} from './handlers/eventHandlers.js';

const eventRouter = createEventRouter();

// EventBridge Scheduler: templated input for scheduled cleanup
eventRouter.route({
  filters: {
    custom: ({ event }) => event.action === 'scheduled-cleanup',
  },
  eventSchema: ScheduledCleanupSchema,
  handler: handleScheduledCleanup,
});

// Step Functions Task: order processing
eventRouter.route({
  filters: {
    custom: ({ event }) => event.taskType === 'process-order',
  },
  eventSchema: ProcessOrderSchema,
  handler: handleProcessOrder,
});

// IoT Core Rules Engine: temperature sensor reading
eventRouter.route({
  filters: {
    custom: ({ event }) => event.sensorType === 'temperature',
  },
  eventSchema: TemperatureReadingSchema,
  handler: handleTemperatureReading,
});

// Direct Lambda Invocation: report generation command
eventRouter.route({
  filters: {
    custom: ({ event }) => event.command === 'generate-report',
  },
  eventSchema: GenerateReportSchema,
  handler: handleGenerateReport,
});

const lambdaRouter = new LambdaRouter({
  routers: [eventRouter],
});

export const handler: Handler = lambdaRouter.handler();
