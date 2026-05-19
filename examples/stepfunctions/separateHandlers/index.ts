import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createStepFunctionsRouter } from '@lambda-event-router/stepfunctions';

import {
  handleEnrichData,
  handleHumanApproval,
  handleProcessOrder,
  HumanApprovalSchema,
  ProcessOrderSchema,
} from './handlers/taskHandlers.js';

const stepFunctionsRouter = createStepFunctionsRouter();

// =============================================================================
// Regular Task Routes (RequestResponse / Event invocations)
// =============================================================================
// Step Functions invokes Lambda with free-form JSON payloads.
// Use custom filter to match your payload structure.
//
// Example Step Functions state definition:
//   {
//     "Type": "Task",
//     "Resource": "arn:aws:lambda:region:account:function:myFunction",
//     "Parameters": {
//       "taskType": "processOrder",
//       "orderId.$": "$.orderId",
//       "customerId.$": "$.customerId",
//       "items.$": "$.items"
//     }
//   }

// Filter functions for task payloads
function isProcessOrder({ event }: { event: unknown }): boolean {
  if (typeof event !== 'object' || event === null) return false;
  return (event as { taskType?: string }).taskType === 'processOrder';
}

function isEnrichData({ event }: { event: unknown }): boolean {
  if (typeof event !== 'object' || event === null) return false;
  return (event as { taskType?: string }).taskType === 'enrichData';
}

// .route() with schema - validates and parses the payload
stepFunctionsRouter.route({
  filters: {
    custom: isProcessOrder,
  },
  eventSchema: ProcessOrderSchema,
  handler: handleProcessOrder,
});

// .route() without schema - works with raw payload
stepFunctionsRouter.route({
  filters: {
    custom: isEnrichData,
  },
  handler: handleEnrichData,
});

// =============================================================================
// Callback Task Routes (waitForTaskToken pattern)
// =============================================================================
// When using .waitForTaskToken integration, Step Functions includes a TaskToken
// in the payload. The taskToken filter matches events containing a TaskToken
// field and provides { taskToken, input } to the handler.
//
// Example Step Functions state definition:
//   {
//     "Type": "Task",
//     "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
//     "Parameters": {
//       "FunctionName": "arn:aws:lambda:region:account:function:myFunction",
//       "Payload": {
//         "taskType": "humanApproval",
//         "TaskToken.$": "$$.Task.Token",
//         "requestId.$": "$.requestId",
//         "requester.$": "$.requester",
//         "description.$": "$.description",
//         "amount.$": "$.amount"
//       }
//     }
//   }

// Filter function for callback payload
function isHumanApproval({ event }: { event: unknown }): boolean {
  if (typeof event !== 'object' || event === null) return false;
  return (event as { taskType?: string }).taskType === 'humanApproval';
}

// taskToken filter - matches events with TaskToken and provides { taskToken, input }
stepFunctionsRouter.route({
  filters: {
    custom: isHumanApproval,
    taskToken: true,
  },
  eventSchema: HumanApprovalSchema,
  handler: handleHumanApproval,
});

// =============================================================================
// Lambda Router
// =============================================================================

const lambdaRouter = new LambdaRouter({
  routers: [stepFunctionsRouter],
});

export const handler: Handler = lambdaRouter.handler();
