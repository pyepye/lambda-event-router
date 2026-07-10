import { logger } from '@lambda-event-router/base';
import type { StepFunctionsTaskTokenMiddleware } from '@lambda-event-router/stepfunctions';

import type { TFraudReview } from '../utils/schemas.js';

// Route middleware for a task token route, where the validated payload sits on `input` and `event`
// still holds the raw payload including the TaskToken.
export const withApprovalContext: StepFunctionsTaskTokenMiddleware<unknown, TFraudReview> = async (request, next) => {
  logger.info({
    message: 'Fraud review context resolved',
    orderId: request.input.orderId,
    riskScore: request.input.riskScore,
    tokenLength: request.taskToken.length,
  });
  return next(request);
};
