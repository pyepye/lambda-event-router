import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/connect';

import { atStep } from '../utils/atStep.js';
import { FAILED_STEP_PARAMETER, FLOW_ERROR_STEP } from '../utils/constants.js';

// The Error branch of a failed Invoke AWS Lambda function block comes back here, naming the block
// that failed.
export const recordFlowError = defineRoute({
  filters: { custom: atStep(FLOW_ERROR_STEP) },
}).handle(async ({ contactData, parameters }) => {
  const failedStep = parameters[FAILED_STEP_PARAMETER] ?? 'unknown';

  logger.info({ message: 'Flow error recorded', contactId: contactData.ContactId, failedStep });

  return { failedStep };
});
