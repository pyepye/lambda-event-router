import { z } from 'zod';

export const CleanupSchedulerSchema = z.object({
  schedulerType: z.literal('daily-cleanup'),
  config: z.object({
    retentionDays: z.number(),
  }),
});

export async function handleDailyCleanup(event: z.infer<typeof CleanupSchedulerSchema>): Promise<void> {
  console.log(`Daily cleanup triggered with retention: ${event.config.retentionDays} days`);
}

export const ReportSchedulerSchema = z.object({
  schedulerType: z.literal('weekly-report'),
  reportType: z.enum(['sales', 'inventory', 'users']),
  recipients: z.array(z.string()),
});

export async function handleWeeklyReport(event: z.infer<typeof ReportSchedulerSchema>): Promise<void> {
  console.log(`Weekly ${event.reportType} report for: ${event.recipients.join(', ')}`);
}

export const SyncSchedulerSchema = z.object({
  schedulerType: z.literal('data-sync'),
  source: z.string(),
  destination: z.string(),
  fullSync: z.boolean(),
});

export async function handleDataSync(event: z.infer<typeof SyncSchedulerSchema>): Promise<void> {
  const syncType = event.fullSync ? 'full' : 'incremental';
  console.log(`${syncType} sync from ${event.source} to ${event.destination}`);
}
