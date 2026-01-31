import { EventRouter } from '@lambda-event-router/base';
import { createEventBridgeRouter } from '@lambda-event-router/eventbridge';
import type { Handler } from 'aws-lambda';

import {
  CleanupSchedulerSchema,
  handleDailyCleanup,
  handleDataSync,
  handleEC2StateChange,
  handleOrderCreated,
  handleOrderStatusChange,
  handleS3Notification,
  handleScheduledRule,
  handleWeeklyReport,
  OrderDetailSchema,
  ReportSchedulerSchema,
  SyncSchedulerSchema,
} from './handlers/eventHandlers.js';

const eventBridgeRouter = createEventBridgeRouter();

// =============================================================================
// Standard EventBridge Events (with source, detail-type envelope)
// =============================================================================

// EC2 instance state changes - type automatically inferred from source/detailType
eventBridgeRouter.route({
  filters: {
    sources: ['aws.ec2'],
    detailTypes: ['EC2 Instance State-change Notification'],
  },
  handler: handleEC2StateChange,
});

// S3 events via EventBridge (when enabled on bucket)
eventBridgeRouter.route({
  filters: {
    sources: ['aws.s3'],
    detailTypes: ['Object Created', 'Object Deleted'],
  },
  handler: handleS3Notification,
});

// Scheduled events from EventBridge Rules (cron/rate expressions)
eventBridgeRouter.route({
  filters: {
    sources: ['aws.events'],
    detailTypes: ['Scheduled Event'],
  },
  handler: handleScheduledRule,
});

// Custom application events with schema validation
eventBridgeRouter.route({
  filters: {
    sources: ['myapp.orders'],
    detailTypes: ['Order Created'],
  },
  detailSchema: OrderDetailSchema,
  handler: handleOrderCreated,
});

// Order status change events (multiple detail types)
eventBridgeRouter.route({
  filters: {
    sources: ['myapp.orders'],
    detailTypes: ['Order Updated', 'Order Shipped', 'Order Delivered', 'Order Cancelled'],
  },
  detailSchema: OrderDetailSchema,
  handler: handleOrderStatusChange,
});

// =============================================================================
// EventBridge Scheduler Events (custom payloads without envelope)
// =============================================================================
// EventBridge Scheduler invokes Lambda directly with whatever payload you configure.
// Use customFilter to match your payload structure.
//
// Example CDK setup:
//   new targets.LambdaInvoke(fn, {
//     input: ScheduleTargetInput.fromObject({
//       schedulerType: 'daily-cleanup',
//       config: { retentionDays: 30 }
//     })
//   });

// Filter functions for scheduler payloads
function isCleanupScheduler({ event }: { event: unknown }): boolean {
  if (typeof event !== 'object' || event === null) return false;
  return (event as { schedulerType?: string }).schedulerType === 'daily-cleanup';
}

function isReportScheduler({ event }: { event: unknown }): boolean {
  if (typeof event !== 'object' || event === null) return false;
  return (event as { schedulerType?: string }).schedulerType === 'weekly-report';
}

function isSyncScheduler({ event }: { event: unknown }): boolean {
  if (typeof event !== 'object' || event === null) return false;
  return (event as { schedulerType?: string }).schedulerType === 'data-sync';
}

// Daily cleanup scheduler
eventBridgeRouter.route({
  filters: {
    customFilter: isCleanupScheduler,
  },
  eventSchema: CleanupSchedulerSchema,
  handler: handleDailyCleanup,
});

// Weekly report scheduler
eventBridgeRouter.route({
  filters: {
    customFilter: isReportScheduler,
  },
  eventSchema: ReportSchedulerSchema,
  handler: handleWeeklyReport,
});

// Data sync scheduler
eventBridgeRouter.route({
  filters: {
    customFilter: isSyncScheduler,
  },
  eventSchema: SyncSchedulerSchema,
  handler: handleDataSync,
});

// =============================================================================
// Event Router
// =============================================================================

const eventRouter = new EventRouter({
  routers: [eventBridgeRouter],
});

export const handler: Handler = eventRouter.handler();
