import { EventRouter, isObject } from '@lambda-event-router/base';
import type { EventBridgeSchedulerFilterInput } from '@lambda-event-router/eventbridge';
import { createEventBridgeSchedulerRouter } from '@lambda-event-router/eventbridge';
import type { Handler } from 'aws-lambda';

import {
  CleanupSchedulerSchema,
  handleDailyCleanup,
  handleDataSync,
  handleWeeklyReport,
  ReportSchedulerSchema,
  SyncSchedulerSchema,
} from './handlers/eventHandlers.js';

const schedulerRouter = createEventBridgeSchedulerRouter();

function hasSchedulerType(event: unknown): event is Record<string, unknown> & { schedulerType: string } {
  return isObject(event) && Object.hasOwn(event, 'schedulerType') && typeof event.schedulerType === 'string';
}

// Filter functions for scheduler payloads
function isCleanupScheduler({ event }: EventBridgeSchedulerFilterInput): boolean {
  return hasSchedulerType(event) && event.schedulerType === 'daily-cleanup';
}

function isReportScheduler({ event }: EventBridgeSchedulerFilterInput): boolean {
  return hasSchedulerType(event) && event.schedulerType === 'weekly-report';
}

function isSyncScheduler({ event }: EventBridgeSchedulerFilterInput): boolean {
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

const eventRouter = new EventRouter({
  routers: [schedulerRouter],
});

export const handler: Handler = eventRouter.handler();
