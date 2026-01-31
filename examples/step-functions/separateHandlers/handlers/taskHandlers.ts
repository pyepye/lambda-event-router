import type { StepFunctionsRequest, StepFunctionsTaskTokenRequest } from '@lambda-event-router/step-functions';
import { z } from 'zod';

// =============================================================================
// Schemas
// =============================================================================

export const ProcessOrderSchema = z.object({
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

export const HumanApprovalSchema = z.object({
  taskType: z.literal('humanApproval'),
  requestId: z.string(),
  requester: z.string(),
  description: z.string(),
  amount: z.number(),
});

// =============================================================================
// Types
// =============================================================================

type ProcessOrderInput = z.infer<typeof ProcessOrderSchema>;
type HumanApprovalInput = z.infer<typeof HumanApprovalSchema>;

// =============================================================================
// Regular Task Handlers (RequestResponse / Event invocations)
// =============================================================================

// Handler with typed schema input
export async function handleProcessOrder(
  event: StepFunctionsRequest<ProcessOrderInput>,
): Promise<{ orderId: string; totalAmount: number; status: string }> {
  const totalAmount = event.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  console.log(`Processing order ${event.orderId} for customer ${event.customerId}`);
  console.log(`Total: ${totalAmount} across ${event.items.length} items`);

  return { orderId: event.orderId, totalAmount, status: 'processed' };
}

// Handler without schema - works with raw payload
export async function handleEnrichData(event: StepFunctionsRequest<unknown>): Promise<void> {
  console.log('Enriching data:', event);
}

// =============================================================================
// Callback Task Handlers (waitForTaskToken pattern)
// =============================================================================

// taskToken handler - receives { taskToken, input } with parsed input
export async function handleHumanApproval(request: StepFunctionsTaskTokenRequest<HumanApprovalInput>): Promise<void> {
  const { taskToken, input } = request;
  console.log(`Approval request ${input.requestId} from ${input.requester}`);
  console.log(`Description: ${input.description}, Amount: ${input.amount}`);
  console.log(`Task token for callback: ${taskToken}`);

  // Store the task token somewhere (e.g. DynamoDB) for later callback
  // When approved/rejected, call sfn.sendTaskSuccess({ taskToken, output }) or sfn.sendTaskFailure()
}
