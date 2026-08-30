import { logger } from '@lambda-event-router/base';
import type { CloudWatchLogsMiddleware } from '@lambda-event-router/cloudwatch';
import type { EventBridgeMiddleware } from '@lambda-event-router/eventbridge';
import type { SecretsManagerMiddleware } from '@lambda-event-router/secretsmanager';

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
