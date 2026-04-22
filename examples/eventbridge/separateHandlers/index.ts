import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createEventBridgeRouter } from '@lambda-event-router/eventbridge';

import {
  GuardDutyFindingSchema,
  handleEC2StateChange,
  handleGuardDutyHighSeverityFinding,
  handleOrderCreated,
  handleOrderStatusChange,
  handlePipesInventoryChanged,
  handlePipesOrderReceived,
  handleS3Notification,
  handleScheduledRule,
  OrderDetailSchema,
  PipesInventoryDetailSchema,
  PipesOrderDetailSchema,
} from './handlers/eventHandlers.js';

const eventBridgeRouter = createEventBridgeRouter();

// EC2 instance state changes - type automatically inferred from source/detailType
eventBridgeRouter.route({
  filters: {
    source: 'aws.ec2',
    detailType: 'EC2 Instance State-change Notification',
  },
  handler: handleEC2StateChange,
});

// S3 events via EventBridge (when enabled on bucket)
eventBridgeRouter.route({
  filters: {
    source: 'aws.s3',
    detailType: ['Object Created', 'Object Deleted'],
  },
  handler: handleS3Notification,
});

// Scheduled events from EventBridge Rules (cron/rate expressions)
eventBridgeRouter.route({
  filters: {
    source: 'aws.events',
    detailType: 'Scheduled Event',
  },
  handler: handleScheduledRule,
});

// Custom application events with schema validation
eventBridgeRouter.route({
  filters: {
    source: 'myapp.orders',
    detailType: 'Order Created',
  },
  detailSchema: OrderDetailSchema,
  handler: handleOrderCreated,
});

// Order status change events (multiple detail types)
eventBridgeRouter.route({
  filters: {
    source: 'myapp.orders',
    detailType: ['Order Updated', 'Order Shipped', 'Order Delivered', 'Order Cancelled'],
  },
  detailSchema: OrderDetailSchema,
  handler: handleOrderStatusChange,
});

// High-severity GuardDuty findings using customFilter to filter by severity
eventBridgeRouter.route({
  filters: {
    source: 'aws.guardduty',
    detailType: 'GuardDuty Finding',
    customFilter: ({ detail }) => {
      const highSeverityThreshold = 7;
      const finding = detail as Record<string, unknown>;
      return (finding.severity as number) >= highSeverityThreshold;
    },
  },
  detailSchema: GuardDutyFindingSchema,
  handler: handleGuardDutyHighSeverityFinding,
});

// Pipes: SQS → Pipes → EventBridge → Lambda (order processing pipeline)
eventBridgeRouter.route({
  filters: {
    source: 'myapp.pipes.orders',
    detailType: 'OrderReceived',
  },
  detailSchema: PipesOrderDetailSchema,
  handler: handlePipesOrderReceived,
});

// Pipes: DynamoDB → Pipes → EventBridge → Lambda (change data capture)
eventBridgeRouter.route({
  filters: {
    source: 'myapp.pipes.inventory',
    detailType: 'InventoryChanged',
  },
  detailSchema: PipesInventoryDetailSchema,
  handler: handlePipesInventoryChanged,
});

const lambdaRouter = new LambdaRouter({
  routers: [eventBridgeRouter],
});

export const handler: Handler = lambdaRouter.handler();
