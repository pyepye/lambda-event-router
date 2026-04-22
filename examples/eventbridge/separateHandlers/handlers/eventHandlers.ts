import type { S3ObjectCreatedNotificationEventDetail } from 'aws-lambda';

import { z } from 'zod';

import type { EC2StateChangeDetail, EventBridgeRequest, ScheduledEventDetail } from '@lambda-event-router/eventbridge';

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

type OrderDetail = z.infer<typeof OrderDetailSchema>;

export async function handleOrderCreated({
  source,
  detail,
  resources,
}: EventBridgeRequest<OrderDetail>): Promise<void> {
  console.log(`Order created event from ${source}`);
  console.log(`Order: ${detail.orderId} for customer ${detail.customerId}`);
  console.log(`Amount: ${detail.amount} ${detail.currency}`);
  console.log(`Resources: ${resources.join(', ')}`);
}

export async function handleOrderStatusChange({ detailType, detail }: EventBridgeRequest<OrderDetail>): Promise<void> {
  console.log(`Order ${detail.orderId} - ${detailType}`);
  console.log(`Customer: ${detail.customerId}, Amount: ${detail.amount} ${detail.currency}`);
}

export const GuardDutyFindingSchema = z.object({
  schemaVersion: z.string(),
  id: z.string(),
  type: z.string(),
  severity: z.number(),
  title: z.string(),
  description: z.string(),
  resource: z.object({
    resourceType: z.string(),
  }),
});

type GuardDutyFinding = z.infer<typeof GuardDutyFindingSchema>;

export async function handleGuardDutyHighSeverityFinding({
  detail,
  account,
  region,
}: EventBridgeRequest<GuardDutyFinding>): Promise<void> {
  console.log(`High severity GuardDuty finding in ${account}/${region}`);
  console.log(`Type: ${detail.type}`);
  console.log(`Severity: ${detail.severity}`);
  console.log(`Title: ${detail.title}`);
  console.log(`Resource type: ${detail.resource.resourceType}`);
}

// --- EventBridge Pipes examples ---

export const PipesOrderDetailSchema = z.object({
  orderId: z.string(),
  customerEmail: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number(),
      price: z.number(),
    }),
  ),
  totalAmount: z.number(),
});

type PipesOrderDetail = z.infer<typeof PipesOrderDetailSchema>;

export async function handlePipesOrderReceived({ detail, time }: EventBridgeRequest<PipesOrderDetail>): Promise<void> {
  console.log(`Pipes order received at ${time}: ${detail.orderId}`);
  console.log(`Customer: ${detail.customerEmail}, Total: ${detail.totalAmount}`);
  console.log(`Items: ${detail.items.length}`);
}

export const PipesInventoryDetailSchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  previousQuantity: z.number(),
  newQuantity: z.number(),
  changeReason: z.string(),
});

type PipesInventoryDetail = z.infer<typeof PipesInventoryDetailSchema>;

export async function handlePipesInventoryChanged({
  detail,
  account,
  region,
}: EventBridgeRequest<PipesInventoryDetail>): Promise<void> {
  const quantityDelta = detail.newQuantity - detail.previousQuantity;
  const direction = quantityDelta >= 0 ? 'increased' : 'decreased';
  console.log(`Inventory ${direction} in ${account}/${region}: ${detail.productId} at ${detail.warehouseId}`);
  console.log(`${detail.previousQuantity} → ${detail.newQuantity} (${detail.changeReason})`);
}
