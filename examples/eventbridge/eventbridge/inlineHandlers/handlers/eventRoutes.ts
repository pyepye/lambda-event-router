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

// Handle IAM policy changes via CloudTrail → EventBridge
// Uses customFilter to match specific CloudTrail eventNames within the detail payload
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
    sources: ['aws.iam'],
    detailTypes: ['AWS API Call via CloudTrail'],
    customFilter: ({ detail }) => {
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
