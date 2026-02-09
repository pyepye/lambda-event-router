import { EventRouter } from '@lambda-event-router/base';
import { createCloudWatchLogsRouter } from '@lambda-event-router/cloudwatch';
import type { CloudWatchLogsDecodedData, Handler } from 'aws-lambda';

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
    logGroups: ['/aws/lambda/my-api-handler'],
    messageTypes: ['DATA_MESSAGE'],
  },
  handler: handleLambdaLogs,
});

// Log group prefix match — all Lambda function logs
cloudWatchLogsRouter.route({
  filters: {
    logGroupPrefixes: ['/aws/lambda/'],
    messageTypes: ['DATA_MESSAGE'],
  },
  handler: handleLambdaLogs,
});

// Log group suffix match — API Gateway logs
cloudWatchLogsRouter.route({
  filters: {
    logGroupSuffixes: ['/access-logs', '/execution-logs'],
  },
  handler: handleApiGatewayLogs,
});

// Log group substring match — ECS/Fargate logs
cloudWatchLogsRouter.route({
  filters: {
    logGroupIncludes: ['ecs', 'fargate'],
  },
  handler: handleEcsLogs,
});

// =============================================================================
// Subscription Filter
// =============================================================================

// Match by subscription filter name
cloudWatchLogsRouter.route({
  filters: {
    subscriptionFilters: ['error-alerts', 'critical-alerts'],
  },
  handler: handleAlertLogs,
});

// =============================================================================
// Convenience Methods
// =============================================================================

// .dataMessage() is equivalent to .route() with messageTypes: ['DATA_MESSAGE']
cloudWatchLogsRouter.dataMessage({
  filters: {
    logGroupPrefixes: ['/aws/lambda/prod-'],
  },
  handler: handleLambdaLogs,
});

// .controlMessage() is equivalent to .route() with messageTypes: ['CONTROL_MESSAGE']
cloudWatchLogsRouter.controlMessage({
  filters: {
    logGroupPrefixes: ['/aws/lambda/'],
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
    customFilter: isHighVolumeLogGroup,
  },
  handler: handleHighVolumeLogs,
});

// =============================================================================
// Event Router
// =============================================================================

const eventRouter = new EventRouter({
  routers: [cloudWatchLogsRouter],
});

export const handler: Handler = eventRouter.handler();
