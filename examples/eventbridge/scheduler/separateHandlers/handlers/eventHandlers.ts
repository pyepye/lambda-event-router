import type { EventBridgeSchedulerRequest } from '@lambda-event-router/eventbridge';
import { z } from 'zod';

export const CleanupSchedulerSchema = z.object({
  schedulerType: z.literal('daily-cleanup'),
  config: z.object({
    retentionDays: z.number(),
  }),
});

type TCleanupScheduler = z.infer<typeof CleanupSchedulerSchema>;

export async function handleDailyCleanup({ event }: EventBridgeSchedulerRequest<TCleanupScheduler>): Promise<void> {
  console.log(`Daily cleanup triggered with retention: ${event.config.retentionDays} days`);
}

export const ReportSchedulerSchema = z.object({
  schedulerType: z.literal('weekly-report'),
  reportType: z.enum(['sales', 'inventory', 'users']),
  recipients: z.array(z.string()),
});

type TReportScheduler = z.infer<typeof ReportSchedulerSchema>;

export async function handleWeeklyReport({ event }: EventBridgeSchedulerRequest<TReportScheduler>): Promise<void> {
  console.log(`Weekly ${event.reportType} report for: ${event.recipients.join(', ')}`);
}

export const SyncSchedulerSchema = z.object({
  schedulerType: z.literal('data-sync'),
  source: z.string(),
  destination: z.string(),
  fullSync: z.boolean(),
});

type TSyncScheduler = z.infer<typeof SyncSchedulerSchema>;

export async function handleDataSync({ event }: EventBridgeSchedulerRequest<TSyncScheduler>): Promise<void> {
  const syncType = event.fullSync ? 'full' : 'incremental';
  console.log(`${syncType} sync from ${event.source} to ${event.destination}`);
}
