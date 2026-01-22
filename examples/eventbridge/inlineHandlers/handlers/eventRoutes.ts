import { defineRoute } from '@lambda-event-router/eventbridge';
import { z } from 'zod';

// Handle EC2 instance state changes from AWS
// Type is automatically inferred from sources + detailTypes
export const ec2StateChangeRoute = defineRoute({
  filters: {
    sources: ['aws.ec2'],
    detailTypes: ['EC2 Instance State-change Notification'],
  },
}).handle(async ({ source, detailType, detail, account, region, time }) => {
  console.log(`EC2 state change from ${source}: ${detailType}`);
  console.log(`Instance: ${detail['instance-id']} changed to ${detail.state}`);
  console.log(`Account: ${account}, Region: ${region}, Time: ${time}`);
});

// Schema for custom order events
const OrderDetailSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  amount: z.number(),
  currency: z.string(),
});

// Handle custom order created events from your application
export const orderCreatedRoute = defineRoute({
  filters: {
    sources: ['myapp.orders'],
    detailTypes: ['Order Created'],
  },
  detailSchema: OrderDetailSchema,
}).handle(async ({ source, detailType, detail, resources }) => {
  console.log(`Order created event from ${source} - detailType: ${detailType}`);
  console.log(`Order: ${detail.orderId} for customer ${detail.customerId}`);
  console.log(`Amount: ${detail.amount} ${detail.currency}`);
  console.log(`Resources: ${resources.join(', ')}`);
});

// Handle order updated events with multiple detail types
export const orderUpdatedRoute = defineRoute({
  filters: {
    sources: ['myapp.orders'],
    detailTypes: ['Order Updated', 'Order Shipped', 'Order Delivered'],
  },
  detailSchema: OrderDetailSchema,
}).handle(async ({ detailType, detail }) => {
  console.log(`Order ${detail.orderId} - ${detailType}`);
});

// Handle scheduled events from EventBridge Rules (cron/rate expressions)
// Type is automatically inferred - detail is Record<string, never> (empty object)
export const scheduledRuleRoute = defineRoute({
  filters: {
    sources: ['aws.events'],
    detailTypes: ['Scheduled Event'],
  },
}).handle(async ({ time, resources }) => {
  console.log(`Scheduled rule triggered at ${time}`);
  console.log(`Rule: ${resources[0]}`);
});

// Schema for cleanup scheduler payload
const CleanupSchedulerSchema = z.object({
  schedulerType: z.literal('daily-cleanup'),
  config: z.object({
    retentionDays: z.number(),
  }),
});

function isCleanupScheduler({ event }: { event: unknown }): boolean {
  if (typeof event !== 'object' || event === null) return false;
  return (event as { schedulerType?: string }).schedulerType === 'daily-cleanup';
}

// Route EventBridge Scheduler events using customFilter
// Since this only has customFilter (no sources, detailTypes, etc.), it's detected as a scheduler route
export const dailyCleanupRoute = defineRoute({
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

function isReportScheduler({ event }: { event: unknown }): boolean {
  if (typeof event !== 'object' || event === null) return false;
  return (event as { schedulerType?: string }).schedulerType === 'weekly-report';
}

// Another scheduler route with different payload structure
export const weeklyReportRoute = defineRoute({
  filters: {
    customFilter: isReportScheduler,
  },
  eventSchema: ReportSchedulerSchema,
}).handle(async (event) => {
  console.log(`Weekly ${event.reportType} report for: ${event.recipients.join(', ')}`);
});
