import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createConfigRouter } from '@lambda-event-router/config';

import {
  handleIamRoleCompliance,
  handleOversizedLambdaCompliance,
  handleRdsEncryptionCheck,
  handleResourceDeleted,
} from './handlers.js';

const configRouter = createConfigRouter();

const TAG_COMPLIANCE_RULE = 'required-tags-check';
const ENCRYPTION_RULE = 'rds-encryption-check';

configRouter.route({
  filters: {
    configRuleName: TAG_COMPLIANCE_RULE,
    resourceType: 'AWS::IAM::Role',
    configurationItemStatus: ['OK', 'ResourceDiscovered'],
  },
  handler: handleIamRoleCompliance,
});

configRouter.route({
  filters: {
    configRuleName: ENCRYPTION_RULE,
    resourceType: 'AWS::RDS::DBInstance',
    resourceId: 'my-production-db',
  },
  handler: handleRdsEncryptionCheck,
});

configRouter.route({
  filters: {
    configurationItemStatus: 'ResourceDeleted',
  },
  handler: handleResourceDeleted,
});

// OversizedConfigurationItemChangeNotification - config item too large, needs API call
configRouter.route({
  filters: {
    configRuleName: TAG_COMPLIANCE_RULE,
    resourceType: 'AWS::Lambda::Function',
  },
  handler: handleOversizedLambdaCompliance,
});

const lambdaRouter = new LambdaRouter({
  routers: [configRouter],
});

export const handler: Handler = lambdaRouter.handler();
