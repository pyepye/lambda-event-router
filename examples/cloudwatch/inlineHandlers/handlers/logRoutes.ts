import { defineRoute } from '@lambda-event-router/cloudwatch';
import type { CloudWatchLogsDecodedData } from 'aws-lambda';

// Handle logs from specific Lambda functions using logGroups + logGroupPrefixes
export const lambdaErrorLogsRoute = defineRoute({
  filters: {
    logGroups: ['/aws/lambda/my-api-handler'],
    messageTypes: ['DATA_MESSAGE'],
  },
}).handle(async ({ logGroup, logStream, logEvents, owner }) => {
  console.log(`Processing ${logEvents.length} log events from ${logGroup}`);
  console.log(`Stream: ${logStream}, Owner: ${owner}`);

  for (const logEvent of logEvents) {
    console.log(`[${logEvent.timestamp}] ${logEvent.message}`);
  }
});

// Handle logs from any Lambda function using prefix matching
export const allLambdaLogsRoute = defineRoute({
  filters: {
    logGroupPrefixes: ['/aws/lambda/'],
    messageTypes: ['DATA_MESSAGE'],
  },
}).handle(async ({ logGroup, logEvents }) => {
  console.log(`Lambda logs from ${logGroup}: ${logEvents.length} events`);
});

// Handle logs matching a subscription filter name
export const alertSubscriptionRoute = defineRoute({
  filters: {
    subscriptionFilters: ['error-alerts', 'critical-alerts'],
  },
}).handle(async ({ logGroup, logStream, logEvents, subscriptionFilters }) => {
  console.log(`Alert triggered for ${logGroup} via filters: ${subscriptionFilters.join(', ')}`);
  console.log(`Stream: ${logStream}, Events: ${logEvents.length}`);
});

// Handle logs from ECS services using substring matching
export const ecsServiceLogsRoute = defineRoute({
  filters: {
    logGroupIncludes: ['ecs', 'fargate'],
    messageTypes: ['DATA_MESSAGE'],
  },
}).handle(async ({ logGroup, logEvents }) => {
  console.log(`ECS logs from ${logGroup}: ${logEvents.length} events`);
});

// Handle logs from API Gateway using suffix matching
export const apiGatewayLogsRoute = defineRoute({
  filters: {
    logGroupSuffixes: ['/access-logs', '/execution-logs'],
  },
}).handle(async ({ logGroup, logStream, logEvents }) => {
  console.log(`API Gateway logs from ${logGroup}`);
  console.log(`Stream: ${logStream}, Events: ${logEvents.length}`);
});

// Custom filter for complex matching logic
function isHighVolumeLogGroup({ logGroup, logEvents }: CloudWatchLogsDecodedData): boolean {
  const isMonitoredGroup = logGroup.startsWith('/aws/lambda/prod-');
  const isHighVolume = logEvents.length > 100;
  return isMonitoredGroup && isHighVolume;
}

export const highVolumeRoute = defineRoute({
  filters: {
    customFilter: isHighVolumeLogGroup,
  },
}).handle(async ({ logGroup, logEvents }) => {
  console.log(`High volume alert: ${logEvents.length} events from ${logGroup}`);
});
