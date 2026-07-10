import { SendTaskSuccessCommand } from '@aws-sdk/client-sfn';
import { isObject, logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/stepfunctions';

import { FRAUD_REVIEW_TASK, sfnClient } from '../config.js';
import { withApprovalContext } from '../middleware/withApprovalContext.js';
import { FraudReviewSchema } from '../utils/schemas.js';

const AUTOMATIC_APPROVAL_LIMIT = 50;

// Clears an order for dispatch and hands the result back through the task token. The waiting state
// takes its result from SendTaskSuccess, so the value this handler returns to Lambda is discarded.
export const approveFraudReview = defineRoute({
  filters: {
    taskToken: true,
    custom: ({ event }) => isObject(event) && event.task === FRAUD_REVIEW_TASK,
  },
  eventSchema: FraudReviewSchema,
  middleware: [withApprovalContext],
}).handle(async (request) => {
  const decision = request.input.riskScore <= AUTOMATIC_APPROVAL_LIMIT ? 'approved' : 'referred';

  logger.info({
    message: 'Fraud review decided',
    orderId: request.input.orderId,
    decision,
    taskTokenInInput: 'TaskToken' in request.input,
    taskTokenInEvent: isObject(request.event) && 'TaskToken' in request.event,
  });

  await sfnClient.send(
    new SendTaskSuccessCommand({
      taskToken: request.taskToken,
      output: JSON.stringify({
        step: 'approveFraudReview',
        orderId: request.input.orderId,
        riskScore: request.input.riskScore,
        decision,
      }),
    }),
  );
});
