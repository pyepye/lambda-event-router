import type { EC2StateChangeDetail, EventBridgeRequest, ScheduledEventDetail } from '@lambda-event-router/eventbridge';
import type { S3ObjectCreatedNotificationEventDetail } from 'aws-lambda';
import { z } from 'zod';

// AWS event types are automatically inferred from the type map
export async function handleEC2StateChange({
  source,
  detailType,
  detail,
  account,
  region,
  time,
}: EventBridgeRequest<EC2StateChangeDetail>): Promise<void> {
  console.log(`EC2 state change from ${source}: ${detailType}`);
  console.log(`Instance: ${detail['instance-id']} changed to ${detail.state}`);
  console.log(`Account: ${account}, Region: ${region}, Time: ${time}`);
}

export async function handleS3Notification({
  detailType,
  detail,
}: EventBridgeRequest<S3ObjectCreatedNotificationEventDetail>): Promise<void> {
  console.log(`S3 ${detailType}: ${detail.object.key} in ${detail.bucket.name}`);
}

export async function handleScheduledRule({
  time,
  resources,
}: EventBridgeRequest<ScheduledEventDetail>): Promise<void> {
  console.log(`Scheduled rule triggered at ${time}`);
  console.log(`Rule: ${resources[0]}`);
}

export const OrderDetailSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  amount: z.number(),
  currency: z.string(),
});

export async function handleOrderCreated({
  source,
  detail,
  resources,
}: EventBridgeRequest<z.infer<typeof OrderDetailSchema>>): Promise<void> {
  console.log(`Order created event from ${source}`);
  console.log(`Order: ${detail.orderId} for customer ${detail.customerId}`);
  console.log(`Amount: ${detail.amount} ${detail.currency}`);
  console.log(`Resources: ${resources.join(', ')}`);
}

export async function handleOrderStatusChange({
  detailType,
  detail,
}: EventBridgeRequest<z.infer<typeof OrderDetailSchema>>): Promise<void> {
  console.log(`Order ${detail.orderId} - ${detailType}`);
  console.log(`Customer: ${detail.customerId}, Amount: ${detail.amount} ${detail.currency}`);
}

// =============================================================================
// EventBridge Scheduler Handlers (custom payloads)
// =============================================================================

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
