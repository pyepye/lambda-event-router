import type { CloudWatchLogsDecodedData, Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createCloudWatchLogsRouter } from '@lambda-event-router/cloudwatch';

import {
  handleAlertLogs,
  handleApiGatewayLogs,
  handleControlMessage,
  handleEcsLogs,
  handleHighVolumeLogs,
  handleLambdaLogs,
} from './handlers/logHandlers.js';

const cloudWatchLogsRouter = createCloudWatchLogsRouter();

// =============================================================================
// Log Group Filters
// =============================================================================

// Exact log group name match
cloudWatchLogsRouter.route({
  filters: {
    logGroup: '/aws/lambda/my-api-handler',
    messageType: 'DATA_MESSAGE',
  },
  handler: handleLambdaLogs,
});

// Log group prefix match - all Lambda function logs
cloudWatchLogsRouter.route({
  filters: {
    logGroup: '/aws/lambda/*',
    messageType: 'DATA_MESSAGE',
  },
  handler: handleLambdaLogs,
});

// Log group suffix match - API Gateway logs
cloudWatchLogsRouter.route({
  filters: {
    logGroup: ['*/access-logs', '*/execution-logs'],
  },
  handler: handleApiGatewayLogs,
});

// Log group substring match - ECS/Fargate logs
cloudWatchLogsRouter.route({
  filters: {
    logGroup: ['*ecs*', '*fargate*'],
  },
  handler: handleEcsLogs,
});

// =============================================================================
// Subscription Filter
// =============================================================================

// Match by subscription filter name
cloudWatchLogsRouter.route({
  filters: {
    subscriptionFilter: ['error-alerts', 'critical-alerts'],
  },
  handler: handleAlertLogs,
});

// =============================================================================
// Convenience Methods
// =============================================================================

// .dataMessage() is equivalent to .route() with messageTypes: ['DATA_MESSAGE']
cloudWatchLogsRouter.dataMessage({
  filters: {
    logGroup: '/aws/lambda/prod-*',
  },
  handler: handleLambdaLogs,
});

// .controlMessage() is equivalent to .route() with messageTypes: ['CONTROL_MESSAGE']
cloudWatchLogsRouter.controlMessage({
  filters: {
    logGroup: '/aws/lambda/*',
  },
  handler: handleControlMessage,
});

// =============================================================================
// Custom Filter
// =============================================================================

function isHighVolumeLogGroup({ logGroup, logEvents }: CloudWatchLogsDecodedData): boolean {
  const isMonitoredGroup = logGroup.startsWith('/aws/lambda/prod-');
  const isHighVolume = logEvents.length > 100;
  return isMonitoredGroup && isHighVolume;
}

cloudWatchLogsRouter.route({
  filters: {
    custom: isHighVolumeLogGroup,
  },
  handler: handleHighVolumeLogs,
});

// =============================================================================
// Lambda Router
// =============================================================================

const lambdaRouter = new LambdaRouter({
  routers: [cloudWatchLogsRouter],
});

export const handler: Handler = lambdaRouter.handler();
