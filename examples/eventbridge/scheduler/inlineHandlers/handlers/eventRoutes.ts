import type { EventBridgeSchedulerFilterInput } from '@lambda-event-router/eventbridge';
import { defineEventBridgeSchedulerRoute } from '@lambda-event-router/eventbridge';
import { z } from 'zod';

// Schema for cleanup scheduler payload
const CleanupSchedulerSchema = z.object({
  schedulerType: z.literal('daily-cleanup'),
  config: z.object({
    retentionDays: z.number(),
  }),
});

function isCleanupScheduler({ event }: EventBridgeSchedulerFilterInput): boolean {
  if (typeof event !== 'object' || event === null) return false;
  return (event as { schedulerType?: string }).schedulerType === 'daily-cleanup';
}

// Route EventBridge Scheduler events using customFilter
export const dailyCleanupRoute = defineEventBridgeSchedulerRoute({
  filters: {
    customFilter: isCleanupScheduler,
  },
  eventSchema: CleanupSchedulerSchema,
}).handle(async (event) => {
  console.log(`Daily cleanup triggered with retention: ${event.config.retentionDays} days`);
});

// Schema for report scheduler payload
const ReportSchedulerSchema = z.object({
  schedulerType: z.literal('weekly-report'),
  reportType: z.enum(['sales', 'inventory', 'users']),
  recipients: z.array(z.string()),
});

function isReportScheduler({ event }: EventBridgeSchedulerFilterInput): boolean {
  if (typeof event !== 'object' || event === null) return false;
  return (event as { schedulerType?: string }).schedulerType === 'weekly-report';
}

// Another scheduler route with different payload structure
export const weeklyReportRoute = defineEventBridgeSchedulerRoute({
  filters: {
    customFilter: isReportScheduler,
  },
  eventSchema: ReportSchedulerSchema,
}).handle(async (event) => {
  console.log(`Weekly ${event.reportType} report for: ${event.recipients.join(', ')}`);
});
