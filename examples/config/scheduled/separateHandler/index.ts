import { LambdaRouter } from '@lambda-event-router/base';
import { createConfigScheduledRouter } from '@lambda-event-router/config';
import type { Handler } from 'aws-lambda';

import { handleCrossAccountCompliance, handlePeriodicTagAudit } from './handlers.js';

const configScheduledRouter = createConfigScheduledRouter();

const TAG_AUDIT_RULE = 'periodic-tag-audit';
const CROSS_ACCOUNT_RULE = 'cross-account-access-check';

configScheduledRouter.route({
  filters: {
    configRuleName: TAG_AUDIT_RULE,
  },
  handler: handlePeriodicTagAudit,
});

configScheduledRouter.route({
  filters: {
    configRuleName: CROSS_ACCOUNT_RULE,
    accountId: ['123456789012', '987654321098'],
  },
  handler: handleCrossAccountCompliance,
});

const lambdaRouter = new LambdaRouter({
  routers: [configScheduledRouter],
});

export const handler: Handler = lambdaRouter.handler();
