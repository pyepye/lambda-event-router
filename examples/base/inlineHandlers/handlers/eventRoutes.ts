import type { EventFilterInput } from '@lambda-event-router/base';
import { defineEventRoute, isObject } from '@lambda-event-router/base';
import { z } from 'zod';

// Schema for cleanup scheduler payload
const CleanupSchedulerSchema = z.object({
  schedulerType: z.literal('daily-cleanup'),
  config: z.object({
    retentionDays: z.number(),
  }),
});

function hasSchedulerType(event: unknown): event is Record<string, unknown> & { schedulerType: string } {
  return isObject(event) && Object.hasOwn(event, 'schedulerType') && typeof event.schedulerType === 'string';
}

function isCleanupScheduler({ event }: EventFilterInput): boolean {
  return hasSchedulerType(event) && event.schedulerType === 'daily-cleanup';
}

// Route EventBridge Scheduler events using customFilter
export const dailyCleanupRoute = defineEventRoute({
  filters: {
    customFilter: isCleanupScheduler,
  },
  eventSchema: CleanupSchedulerSchema,
}).handle(async ({ event }) => {
  console.log(`Daily cleanup triggered with retention: ${event.config.retentionDays} days`);
});

// Schema for report scheduler payload
const ReportSchedulerSchema = z.object({
  schedulerType: z.literal('weekly-report'),
  reportType: z.enum(['sales', 'inventory', 'users']),
  recipients: z.array(z.string()),
});

function isReportScheduler({ event }: EventFilterInput): boolean {
  return hasSchedulerType(event) && event.schedulerType === 'weekly-report';
}

// Another scheduler route with different payload structure
export const weeklyReportRoute = defineEventRoute({
  filters: {
    customFilter: isReportScheduler,
  },
  eventSchema: ReportSchedulerSchema,
}).handle(async ({ event }) => {
  console.log(`Weekly ${event.reportType} report for: ${event.recipients.join(', ')}`);
});
