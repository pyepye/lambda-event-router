import { EventRouter } from '@lambda-event-router/base';
import { createEventBridgeRouter } from '@lambda-event-router/eventbridge';
import type { Handler } from 'aws-lambda';

import {
  GuardDutyFindingSchema,
  handleEC2StateChange,
  handleGuardDutyHighSeverityFinding,
  handleOrderCreated,
  handleOrderStatusChange,
  handleS3Notification,
  handleScheduledRule,
  OrderDetailSchema,
} from './handlers/eventHandlers.js';

const eventBridgeRouter = createEventBridgeRouter();

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

// High-severity GuardDuty findings using customFilter to filter by severity
eventBridgeRouter.route({
  filters: {
    sources: ['aws.guardduty'],
    detailTypes: ['GuardDuty Finding'],
    customFilter: ({ detail }) => {
      const highSeverityThreshold = 7;
      const finding = detail as Record<string, unknown>;
      return (finding.severity as number) >= highSeverityThreshold;
    },
  },
  detailSchema: GuardDutyFindingSchema,
  handler: handleGuardDutyHighSeverityFinding,
});

const eventRouter = new EventRouter({
  routers: [eventBridgeRouter],
});

export const handler: Handler = eventRouter.handler();
