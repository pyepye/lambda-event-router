import type { EventFilterInput } from '@lambda-event-router/base';
import { createEventRouter, isObject, LambdaRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import {
  CleanupSchedulerSchema,
  handleDailyCleanup,
  handleDataSync,
  handleWeeklyReport,
  ReportSchedulerSchema,
  SyncSchedulerSchema,
} from './handlers/eventHandlers.js';

const schedulerRouter = createEventRouter();

function hasSchedulerType(event: unknown): event is Record<string, unknown> & { schedulerType: string } {
  return isObject(event) && Object.hasOwn(event, 'schedulerType') && typeof event.schedulerType === 'string';
}

// Filter functions for scheduler payloads
function isCleanupScheduler({ event }: EventFilterInput): boolean {
  return hasSchedulerType(event) && event.schedulerType === 'daily-cleanup';
}

function isReportScheduler({ event }: EventFilterInput): boolean {
  return hasSchedulerType(event) && event.schedulerType === 'weekly-report';
}

function isSyncScheduler({ event }: EventFilterInput): boolean {
  return hasSchedulerType(event) && event.schedulerType === 'data-sync';
}

// Daily cleanup scheduler
schedulerRouter.route({
  filters: {
    customFilter: isCleanupScheduler,
  },
  eventSchema: CleanupSchedulerSchema,
  handler: handleDailyCleanup,
});

// Weekly report scheduler
schedulerRouter.route({
  filters: {
    customFilter: isReportScheduler,
  },
  eventSchema: ReportSchedulerSchema,
  handler: handleWeeklyReport,
});

// Data sync scheduler
schedulerRouter.route({
  filters: {
    customFilter: isSyncScheduler,
  },
  eventSchema: SyncSchedulerSchema,
  handler: handleDataSync,
});

const lambdaRouter = new LambdaRouter({
  routers: [schedulerRouter],
});

export const handler: Handler = lambdaRouter.handler();
