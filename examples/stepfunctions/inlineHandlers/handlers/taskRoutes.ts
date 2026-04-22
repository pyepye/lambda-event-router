import { z } from 'zod';

import { defineRoute } from '@lambda-event-router/stepfunctions';

// =============================================================================
// Regular Task Routes (RequestResponse / Event invocations)
// =============================================================================

const ProcessOrderSchema = z.object({
  taskType: z.literal('processOrder'),
  orderId: z.string(),
  customerId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number(),
      price: z.number(),
    }),
  ),
});

function isProcessOrder({ event }: { event: unknown }): boolean {
  if (typeof event !== 'object' || event === null) return false;
  return (event as { taskType?: string }).taskType === 'processOrder';
}

// Route with schema - validates and parses the payload
export const processOrderRoute = defineRoute({
  filters: {
    customFilter: isProcessOrder,
  },
  eventSchema: ProcessOrderSchema,
}).handle(async ({ orderId, customerId, items }) => {
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  console.log(`Processing order ${orderId} for customer ${customerId}`);
  console.log(`Total: ${totalAmount} across ${items.length} items`);

  return { orderId, totalAmount, status: 'processed' };
});

function isEnrichData({ event }: { event: unknown }): boolean {
  if (typeof event !== 'object' || event === null) return false;
  return (event as { taskType?: string }).taskType === 'enrichData';
}

// Route without schema - works with raw payload
export const enrichDataRoute = defineRoute({
  filters: {
    customFilter: isEnrichData,
  },
}).handle(async (event) => {
  console.log('Enriching data:', event);
});

// =============================================================================
// Callback Task Routes (waitForTaskToken pattern)
// =============================================================================

const HumanApprovalSchema = z.object({
  taskType: z.literal('humanApproval'),
  requestId: z.string(),
  requester: z.string(),
  description: z.string(),
  amount: z.number(),
});

function isHumanApproval({ event }: { event: unknown }): boolean {
  if (typeof event !== 'object' || event === null) return false;
  return (event as { taskType?: string }).taskType === 'humanApproval';
}

// taskToken filter - matches events with a TaskToken field
// Handler receives { taskToken, input } with parsed input
// Step Functions pauses execution until SendTaskSuccess/SendTaskFailure is called
export const humanApprovalRoute = defineRoute({
  filters: {
    customFilter: isHumanApproval,
    taskToken: true,
  },
  eventSchema: HumanApprovalSchema,
}).handle(async ({ taskToken, input }) => {
  console.log(`Approval request ${input.requestId} from ${input.requester}`);
  console.log(`Description: ${input.description}, Amount: ${input.amount}`);
  console.log(`Task token for callback: ${taskToken}`);

  // Store the task token somewhere (e.g. DynamoDB) for later callback
  // When approved/rejected, call sfn.sendTaskSuccess({ taskToken, output }) or sfn.sendTaskFailure()
});
