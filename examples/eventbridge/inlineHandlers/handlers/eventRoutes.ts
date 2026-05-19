import { z } from 'zod';

import { defineRoute } from '@lambda-event-router/eventbridge';

// Handle EC2 instance state changes from AWS
// Type is automatically inferred from sources + detailTypes
export const ec2StateChangeRoute = defineRoute({
  filters: {
    source: 'aws.ec2',
    detailType: 'EC2 Instance State-change Notification',
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
    source: 'myapp.orders',
    detailType: 'Order Created',
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
    source: 'myapp.orders',
    detailType: ['Order Updated', 'Order Shipped', 'Order Delivered'],
  },
  detailSchema: OrderDetailSchema,
}).handle(async ({ detailType, detail }) => {
  console.log(`Order ${detail.orderId} - ${detailType}`);
});

// Handle scheduled events from EventBridge Rules (cron/rate expressions)
// Type is automatically inferred - detail is Record<string, never> (empty object)
export const scheduledRuleRoute = defineRoute({
  filters: {
    source: 'aws.events',
    detailType: 'Scheduled Event',
  },
}).handle(async ({ time, resources }) => {
  console.log(`Scheduled rule triggered at ${time}`);
  console.log(`Rule: ${resources[0]}`);
});

// Handle IAM policy changes via CloudTrail → EventBridge
// Uses custom filter to match specific CloudTrail eventNames within the detail payload
const CloudTrailIamPolicyChangeSchema = z.object({
  eventSource: z.literal('iam.amazonaws.com'),
  eventName: z.string(),
  awsRegion: z.string(),
  requestParameters: z.object({
    policyArn: z.string(),
    policyName: z.string().optional(),
  }),
  userIdentity: z.object({
    type: z.string(),
    arn: z.string(),
  }),
});

const iamPolicyChangeEvents = ['CreatePolicy', 'DeletePolicy', 'AttachRolePolicy', 'DetachRolePolicy'];

export const iamPolicyChangeRoute = defineRoute({
  filters: {
    source: 'aws.iam',
    detailType: 'AWS API Call via CloudTrail',
    custom: ({ detail }) => {
      const cloudTrailDetail = detail as Record<string, unknown>;
      return iamPolicyChangeEvents.includes(cloudTrailDetail.eventName as string);
    },
  },
  detailSchema: CloudTrailIamPolicyChangeSchema,
}).handle(async ({ detail, account }) => {
  console.log(`IAM policy change detected in ${account}: ${detail.eventName}`);
  console.log(`Policy: ${detail.requestParameters.policyArn}`);
  console.log(`Performed by: ${detail.userIdentity.arn}`);
});

// --- EventBridge Pipes examples ---
// Pipes sends events to EventBridge which triggers Lambda via standard EventBridge envelope

// Pipes: SQS → Pipes → EventBridge → Lambda (order processing pipeline)
const PipesOrderDetailSchema = z.object({
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

export const pipesOrderReceivedRoute = defineRoute({
  filters: {
    source: 'myapp.pipes.orders',
    detailType: 'OrderReceived',
  },
  detailSchema: PipesOrderDetailSchema,
}).handle(async ({ detail, time }) => {
  console.log(`Pipes order received at ${time}: ${detail.orderId}`);
  console.log(`Customer: ${detail.customerEmail}, Total: ${detail.totalAmount}`);
  console.log(`Items: ${detail.items.length}`);
});

// Handle CodeBuild state changes for CI/CD pipeline monitoring
const CodeBuildDetailSchema = z.object({
  'build-id': z.string(),
  'build-status': z.string(),
  'project-name': z.string(),
  'current-phase': z.string(),
  'current-phase-context': z.string(),
});

export const codeBuildStateChangeRoute = defineRoute({
  filters: {
    source: 'aws.codebuild',
    detailType: 'CodeBuild Build State Change',
  },
  detailSchema: CodeBuildDetailSchema,
}).handle(async ({ detail, account, region }) => {
  console.log(`CodeBuild ${detail['build-status']} in ${account}/${region}`);
  console.log(`Project: ${detail['project-name']}, Build: ${detail['build-id']}`);
  console.log(`Phase: ${detail['current-phase']} - ${detail['current-phase-context']}`);
});
