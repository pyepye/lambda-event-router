import { EventRouter } from '@lambda-event-router/base';
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

// Filter functions for scheduler payloads
function isCleanupScheduler({ event }: EventBridgeSchedulerFilterInput): boolean {
  if (typeof event !== 'object' || event === null) return false;
  return (event as { schedulerType?: string }).schedulerType === 'daily-cleanup';
}

function isReportScheduler({ event }: EventBridgeSchedulerFilterInput): boolean {
  if (typeof event !== 'object' || event === null) return false;
  return (event as { schedulerType?: string }).schedulerType === 'weekly-report';
}

function isSyncScheduler({ event }: EventBridgeSchedulerFilterInput): boolean {
  if (typeof event !== 'object' || event === null) return false;
  return (event as { schedulerType?: string }).schedulerType === 'data-sync';
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
