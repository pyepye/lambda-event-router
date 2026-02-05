import type { CloudWatchLogsRequest } from '@lambda-event-router/cloud-watch';

// Handle data messages from specific Lambda log groups
export async function handleLambdaLogs({
  logGroup,
  logStream,
  logEvents,
  owner,
  context,
}: CloudWatchLogsRequest): Promise<void> {
  console.log(`Processing ${logEvents.length} log events from ${logGroup}`);
  console.log(`Stream: ${logStream}, Owner: ${owner}`);
  console.log(`Function: ${context.functionName}`);

  for (const logEvent of logEvents) {
    console.log(`[${logEvent.timestamp}] ${logEvent.message}`);
  }
}

// Handle logs matching subscription filter alerts
export async function handleAlertLogs({
  logGroup,
  logStream,
  logEvents,
  subscriptionFilters,
}: CloudWatchLogsRequest): Promise<void> {
  console.log(`Alert triggered for ${logGroup} via filters: ${subscriptionFilters.join(', ')}`);
  console.log(`Stream: ${logStream}, Events: ${logEvents.length}`);
}

// Handle ECS/Fargate service logs
export async function handleEcsLogs({ logGroup, logEvents }: CloudWatchLogsRequest): Promise<void> {
  console.log(`ECS logs from ${logGroup}: ${logEvents.length} events`);
}

// Handle API Gateway access/execution logs
export async function handleApiGatewayLogs({ logGroup, logStream, logEvents }: CloudWatchLogsRequest): Promise<void> {
  console.log(`API Gateway logs from ${logGroup}`);
  console.log(`Stream: ${logStream}, Events: ${logEvents.length}`);
}

// Handle control messages (e.g. subscription delivery status)
export async function handleControlMessage({ logGroup, messageType }: CloudWatchLogsRequest): Promise<void> {
  console.log(`Control message received for ${logGroup}: ${messageType}`);
}

// Handle high-volume log groups with custom filtering
export async function handleHighVolumeLogs({ logGroup, logEvents }: CloudWatchLogsRequest): Promise<void> {
  console.log(`High volume alert: ${logEvents.length} events from ${logGroup}`);
}
