import { isObject } from './data.js';

function holdsKafkaRecords(records: Record<string, unknown>): boolean {
  const partitions = Object.values(records);
  if (partitions.length === 0) return false;

  return partitions.every(
    (partitionRecords) =>
      Array.isArray(partitionRecords) &&
      partitionRecords.length > 0 &&
      partitionRecords.every(
        (record) =>
          isObject(record) &&
          typeof record.topic === 'string' &&
          typeof record.partition === 'number' &&
          typeof record.offset === 'number',
      ),
  );
}

// Check if event is from a known AWS source that has its own router
export function isKnownEventSource(event: Record<string, unknown>): boolean {
  // Records-based events (SQS, SNS, S3, DynamoDB, Kinesis, CodeCommit, SES)
  if (Array.isArray(event.Records) && event.Records.length > 0) {
    const firstRecord = event.Records[0];
    if (isObject(firstRecord)) {
      const eventSource = firstRecord.eventSource;
      if (typeof eventSource === 'string') {
        const knownSources = ['aws:sqs', 'aws:s3', 'aws:dynamodb', 'aws:kinesis', 'aws:codecommit', 'aws:ses'];
        if (knownSources.includes(eventSource)) {
          return true;
        }
      }
      // SNS uses PascalCase
      if (firstRecord.EventSource === 'aws:sns') {
        return true;
      }
    }
  }

  // S3 sending a bucket's notification configuration a one-off ping
  if (event.Event === 's3:TestEvent') {
    return true;
  }

  // Top-level eventSource field (DocumentDB, ActiveMQ, RabbitMQ)
  if (typeof event.eventSource === 'string') {
    const topLevelSources = ['aws:docdb', 'aws:mq', 'aws:rmq', 'aws:kafka', 'SelfManagedKafka'];
    if (topLevelSources.includes(event.eventSource)) {
      return true;
    }
  }

  // Kafka re-delivering a batch reported through batchItemFailures, which names no source
  if (event.eventSource === undefined && isObject(event.records) && holdsKafkaRecords(event.records)) {
    return true;
  }

  // EventBridge envelope events (source + detail-type + detail)
  if (typeof event.source === 'string' && typeof event['detail-type'] === 'string' && isObject(event.detail)) {
    return true;
  }

  // ALB
  if (isObject(event.requestContext) && isObject(event.requestContext.elb)) {
    return true;
  }

  // API Gateway V1 (has httpMethod + requestContext, but no rawPath)
  if (typeof event.httpMethod === 'string' && isObject(event.requestContext) && typeof event.rawPath !== 'string') {
    return true;
  }

  // API Gateway V2
  if (typeof event.rawPath === 'string' && isObject(event.requestContext)) {
    return true;
  }

  // API Gateway WebSocket
  if (isObject(event.requestContext)) {
    const { connectionId, eventType, routeKey } = event.requestContext;
    if (typeof connectionId === 'string' && typeof eventType === 'string' && typeof routeKey === 'string') {
      return true;
    }
  }

  // Lambda authorizer
  if (event.type === 'TOKEN' || event.type === 'REQUEST') {
    if (typeof event.methodArn === 'string' || typeof event.routeArn === 'string') {
      return true;
    }
  }

  // VPC Lattice V1 (uses snake_case raw_path + method)
  if (typeof event.raw_path === 'string' && typeof event.method === 'string') {
    return true;
  }

  // VPC Lattice V2 / AppSync Authorizer (share requestContext)
  if (isObject(event.requestContext)) {
    if (typeof event.requestContext.serviceArn === 'string') {
      return true;
    }
    // AppSync Authorizer (has requestContext.apiId + authorizationToken)
    if (typeof event.requestContext.apiId === 'string' && typeof event.authorizationToken === 'string') {
      return true;
    }
  }

  // Cognito
  if (typeof event.triggerSource === 'string' && typeof event.userPoolId === 'string') {
    return true;
  }

  // Firehose
  if (typeof event.deliveryStreamArn === 'string' && Array.isArray(event.records)) {
    return true;
  }

  // S3 Batch
  if (
    typeof event.invocationSchemaVersion === 'string' &&
    typeof event.invocationId === 'string' &&
    isObject(event.job) &&
    Array.isArray(event.tasks)
  ) {
    return true;
  }

  // AppSync (resolver or channel handler)
  if (isObject(event.info)) {
    if (typeof event.info.parentTypeName === 'string' || isObject(event.info.channel)) {
      return true;
    }
  }

  // CloudWatch Logs
  if (isObject(event.awslogs)) {
    return true;
  }

  // CodePipeline
  if (isObject(event['CodePipeline.job'])) {
    return true;
  }

  // Config
  if (typeof event.invokingEvent === 'string' && typeof event.configRuleName === 'string') {
    return true;
  }

  // Connect
  if (event.Name === 'ContactFlowEvent') {
    return true;
  }

  // Lex
  if (isObject(event.sessionState) && isObject(event.bot)) {
    return true;
  }

  // Secrets Manager
  if (typeof event.SecretId === 'string' && typeof event.Step === 'string') {
    return true;
  }

  return false;
}
