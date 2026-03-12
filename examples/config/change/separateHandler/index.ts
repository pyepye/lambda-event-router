import { LambdaRouter } from '@lambda-event-router/base';
import { createConfigRouter } from '@lambda-event-router/config';
import type { Handler } from 'aws-lambda';

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
    configRuleNames: [TAG_COMPLIANCE_RULE],
    resourceTypes: ['AWS::IAM::Role'],
    configurationItemStatuses: ['OK', 'ResourceDiscovered'],
  },
  handler: handleIamRoleCompliance,
});

configRouter.route({
  filters: {
    configRuleNames: [ENCRYPTION_RULE],
    resourceTypes: ['AWS::RDS::DBInstance'],
    resourceIds: ['my-production-db'],
  },
  handler: handleRdsEncryptionCheck,
});

configRouter.route({
  filters: {
    configurationItemStatuses: ['ResourceDeleted'],
  },
  handler: handleResourceDeleted,
});

// OversizedConfigurationItemChangeNotification - config item too large, needs API call
configRouter.route({
  filters: {
    configRuleNames: [TAG_COMPLIANCE_RULE],
    resourceTypes: ['AWS::Lambda::Function'],
  },
  handler: handleOversizedLambdaCompliance,
});

const lambdaRouter = new LambdaRouter({
  routers: [configRouter],
});

export const handler: Handler = lambdaRouter.handler();
