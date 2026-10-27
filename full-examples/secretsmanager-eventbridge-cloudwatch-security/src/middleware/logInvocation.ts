import { logger } from '@latcher/base';
import type { CloudWatchLogsMiddleware } from '@latcher/cloudwatch';
import type { EventBridgeMiddleware } from '@latcher/eventbridge';
import type { SecretsManagerMiddleware } from '@latcher/secretsmanager';

export const logEventBridgeInvocation: EventBridgeMiddleware = async (request, next) => {
  logger.info({ message: 'Handling EventBridge event', source: request.source, detailType: request.detailType });
  await next(request);
};

export const logLogsInvocation: CloudWatchLogsMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling log delivery',
    logGroup: request.logGroup,
    subscriptionFilters: request.subscriptionFilters,
    eventCount: request.logEvents.length,
  });
  await next(request);
};

export const logRotationStep: SecretsManagerMiddleware = async (request, next) => {
  logger.info({
    message: 'Handling rotation step',
    step: request.step,
    secretId: request.secretId,
    clientRequestToken: request.clientRequestToken,
  });
  await next(request);
};
