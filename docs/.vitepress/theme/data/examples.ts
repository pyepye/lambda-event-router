export type ExampleEntry = {
  name: string;
  icons: string[];
  summary: string;
  matchers: string[];
  path: string;
};

const repository = 'https://github.com/pyepye/latcher/tree/main';

export function exampleLink(entry: ExampleEntry): string {
  return `${repository}/${entry.path}`;
}

export const serviceExamples: ExampleEntry[] = [
  {
    name: 'ALB',
    icons: ['elb'],
    summary: 'A returns desk behind an Application Load Balancer',
    matchers: ['ALBMatcher'],
    path: 'service-examples/alb',
  },
  {
    name: 'API Gateway',
    icons: ['api-gateway'],
    summary: 'A warehouse service across a REST API, an HTTP API and a WebSocket API',
    matchers: ['APIGatewayMatcher', 'LambdaAuthorizerMatcher', 'WebSocketMatcher'],
    path: 'service-examples/apigateway',
  },
  {
    name: 'AppSync',
    icons: ['appsync'],
    summary: 'A support desk with a GraphQL API, an Event API and one authorizer',
    matchers: ['AppSyncMatcher', 'AppSyncAuthorizerMatcher', 'AppSyncEventsMatcher', 'AppSyncEventsAuthorizerMatcher'],
    path: 'service-examples/appsync',
  },
  {
    name: 'CloudWatch Logs',
    icons: ['cloudwatch'],
    summary: 'Log triage across five subscribed log groups',
    matchers: ['CloudWatchLogsMatcher'],
    path: 'service-examples/cloudwatch',
  },
  {
    name: 'CodePipeline',
    icons: ['codepipeline'],
    summary: 'A release pipeline where two Lambdas share one matcher',
    matchers: ['CodePipelineMatcher'],
    path: 'service-examples/codepipeline',
  },
  {
    name: 'Cognito',
    icons: ['cognito'],
    summary: 'An applicant portal with two user pools on one worker',
    matchers: ['CognitoMatcher'],
    path: 'service-examples/cognito',
  },
  {
    name: 'Connect',
    icons: ['connect'],
    summary: 'A parcel support desk driven by a contact flow',
    matchers: ['ConnectMatcher'],
    path: 'service-examples/connect',
  },
  {
    name: 'DocumentDB',
    icons: ['documentdb'],
    summary: 'An online shop consuming seven change streams',
    matchers: ['DocumentDBMatcher'],
    path: 'service-examples/documentdb',
  },
  {
    name: 'DynamoDB',
    icons: ['dynamodb'],
    summary: 'An order service consuming two table streams',
    matchers: ['DynamoDBMatcher'],
    path: 'service-examples/dynamodb',
  },
  {
    name: 'EventBridge',
    icons: ['eventbridge'],
    summary: 'An order bus carrying four event sources on one rule',
    matchers: ['EventBridgeMatcher'],
    path: 'service-examples/eventbridge',
  },
  {
    name: 'Firehose',
    icons: ['firehose'],
    summary: 'Record transforms for a clickstream and an audit trail',
    matchers: ['FirehoseMatcher'],
    path: 'service-examples/firehose',
  },
  {
    name: 'Kafka',
    icons: ['msk'],
    summary: 'An order pipeline over three MSK topics',
    matchers: ['KafkaMatcher'],
    path: 'service-examples/kafka',
  },
  {
    name: 'Kinesis',
    icons: ['kinesis'],
    summary: 'An order and telemetry pipeline over two data streams',
    matchers: ['KinesisMatcher'],
    path: 'service-examples/kinesis',
  },
  {
    name: 'Lex',
    icons: ['lex'],
    summary: 'A parcel support bot with one code hook for every intent',
    matchers: ['LexMatcher'],
    path: 'service-examples/lex',
  },
  {
    name: 'MQ',
    icons: ['mq'],
    summary: 'An order and payment pipeline over two brokers',
    matchers: ['ActiveMQMatcher', 'RabbitMQMatcher'],
    path: 'service-examples/mq',
  },
  {
    name: 'S3',
    icons: ['s3'],
    summary: 'A document vault over two buckets and a Batch job',
    matchers: ['S3Matcher', 'S3BatchMatcher'],
    path: 'service-examples/s3',
  },
  {
    name: 'Secrets Manager',
    icons: ['secrets-manager'],
    summary: 'Credential rotation for five secrets',
    matchers: ['SecretsManagerMatcher'],
    path: 'service-examples/secretsmanager',
  },
  {
    name: 'SNS',
    icons: ['sns'],
    summary: 'Order fulfilment across three topics',
    matchers: ['SNSMatcher'],
    path: 'service-examples/sns',
  },
  {
    name: 'SQS',
    icons: ['sqs'],
    summary: 'A notifications dispatcher over a standard and a FIFO queue',
    matchers: ['SQSMatcher'],
    path: 'service-examples/sqs',
  },
  {
    name: 'Step Functions',
    icons: ['step-functions'],
    summary: 'An order workflow with ten parallel branches',
    matchers: ['StepFunctionsMatcher'],
    path: 'service-examples/stepfunctions',
  },
  {
    name: 'VPC Lattice',
    icons: ['vpc-lattice'],
    summary: 'An inventory service reached over a service network',
    matchers: ['VPCLatticeMatcher'],
    path: 'service-examples/vpclattice',
  },
];

export const fullExamples: ExampleEntry[] = [
  {
    name: 'HTTP API, DynamoDB and SQS',
    icons: ['api-gateway', 'dynamodb', 'sqs'],
    summary: 'An order fan-out chain across five handlers on two Lambdas',
    matchers: ['APIGatewayMatcher', 'LambdaAuthorizerMatcher', 'DynamoDBMatcher', 'SQSMatcher'],
    path: 'full-examples/http-api-dynamodb-sqs',
  },
  {
    name: 'Cognito, EventBridge and S3',
    icons: ['cognito', 'eventbridge', 's3'],
    summary: 'User avatars kept in step with a user pool, deployed with AWS SAM',
    matchers: ['CognitoMatcher', 'EventBridgeMatcher', 'S3Matcher'],
    path: 'full-examples/cognito-eventbridge-s3-avatars',
  },
  {
    name: 'Secrets Manager, EventBridge and CloudWatch',
    icons: ['secrets-manager', 'eventbridge', 'cloudwatch'],
    summary: 'Three security signals feeding one alarm, deployed with Terraform',
    matchers: ['SecretsManagerMatcher', 'EventBridgeMatcher', 'CloudWatchLogsMatcher'],
    path: 'full-examples/secretsmanager-eventbridge-cloudwatch-security',
  },
];
