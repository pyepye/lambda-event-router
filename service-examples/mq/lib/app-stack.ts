import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, CustomResource, Duration, Fn, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { CfnBroker } from 'aws-cdk-lib/aws-amazonmq';
import { Peer, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnEventSourceMapping, type IFunction, LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Provider } from 'aws-cdk-lib/custom-resources';
import type { Construct } from 'constructs';

import {
  BROKER_PASSWORD_LENGTH,
  BROKER_PORTS,
  BROKER_USERNAME,
  ORDER_QUEUES,
  PAYMENT_QUEUES,
  SECRET_NAMES,
} from '../src/utils/brokers.js';

// The smallest instance type each engine still takes. RabbitMQ rejects mq.t3.micro, which ActiveMQ
// accepts and which costs a fraction of the smallest RabbitMQ instance.
const ACTIVEMQ_INSTANCE_TYPE = 'mq.t3.micro';
const RABBITMQ_INSTANCE_TYPE = 'mq.m7g.medium';

const BATCH_SIZE = 10;
const BATCHING_WINDOW_SECONDS = 5;

// One message per batch wherever a failure lands. A message that throws takes its whole batch with it
// and the ones behind it are never tried, so a shared batch only ever reports its first failure.
const FAILURE_BATCH_SIZE = 1;

// Lambda reads a public broker over the internet from addresses it does not publish, so the port it
// polls on cannot be narrowed. Basic auth against the generated secret is what protects it.
const PUBLIC_POLLING_PORT = BROKER_PORTS.openWire;

// What Lambda needs to read an Amazon MQ broker. The poller runs under the worker's execution role.
const POLLER_ACTIONS = [
  'mq:DescribeBroker',
  'ec2:CreateNetworkInterface',
  'ec2:DeleteNetworkInterface',
  'ec2:DescribeNetworkInterfaces',
  'ec2:DescribeSecurityGroups',
  'ec2:DescribeSubnets',
  'ec2:DescribeVpcs',
];

const srcDir = fileURLToPath(new URL('../src', import.meta.url));

const sharedBundling: NodejsFunctionProps['bundling'] = {
  format: OutputFormat.ESM,
  target: 'node22',
  minify: true,
  sourceMap: true,
  mainFields: ['module', 'main'],
  externalModules: ['@aws-sdk/*'],
  esbuildArgs: { '--conditions': 'module' },
  banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
};

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // One public subnet for the ActiveMQ broker, so there is no NAT gateway and nothing in the VPC
    // costs anything. A private broker would need PrivateLink endpoints for Lambda, STS and Secrets
    // Manager instead.
    const vpc = new Vpc(this, 'Vpc', {
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [{ name: 'broker', subnetType: SubnetType.PUBLIC }],
    });

    const publishCidr: string = this.node.tryGetContext('allowedCidr') ?? '0.0.0.0/0';

    const brokerSecurityGroup = new SecurityGroup(this, 'BrokerSecurityGroup', { vpc });
    brokerSecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(PUBLIC_POLLING_PORT),
      'Lambda polling the broker over OpenWire',
    );
    brokerSecurityGroup.addIngressRule(
      Peer.ipv4(publishCidr),
      Port.tcp(BROKER_PORTS.stomp),
      'The publish script sending over STOMP',
    );

    const subnetIds = vpc.selectSubnets({ subnetType: SubnetType.PUBLIC }).subnetIds;

    const orderBrokerSecret = this.brokerSecret('OrderBrokerSecret', SECRET_NAMES.orderBroker);
    const paymentBrokerSecret = this.brokerSecret('PaymentBrokerSecret', SECRET_NAMES.paymentBroker);

    const orderBroker = new CfnBroker(this, 'OrderBroker', {
      brokerName: `${this.stackName}-orders`,
      engineType: 'ACTIVEMQ',
      hostInstanceType: ACTIVEMQ_INSTANCE_TYPE,
      deploymentMode: 'SINGLE_INSTANCE',
      autoMinorVersionUpgrade: true,
      publiclyAccessible: true,
      securityGroups: [brokerSecurityGroup.securityGroupId],
      subnetIds,
      users: [
        {
          username: BROKER_USERNAME,
          password: orderBrokerSecret.secretValueFromJson('password').unsafeUnwrap(),
          consoleAccess: false,
        },
      ],
    });

    // A public RabbitMQ broker takes neither a security group nor a subnet. Amazon MQ puts it behind
    // a network load balancer in its own account, so it never enters this VPC.
    const paymentBroker = new CfnBroker(this, 'PaymentBroker', {
      brokerName: `${this.stackName}-payments`,
      engineType: 'RABBITMQ',
      hostInstanceType: RABBITMQ_INSTANCE_TYPE,
      deploymentMode: 'SINGLE_INSTANCE',
      autoMinorVersionUpgrade: true,
      publiclyAccessible: true,
      users: [
        {
          username: BROKER_USERNAME,
          password: paymentBrokerSecret.secretValueFromJson('password').unsafeUnwrap(),
        },
      ],
    });

    const paymentBrokerEndpoint = Fn.select(0, paymentBroker.attrAmqpEndpoints);

    const orderWorkerLogGroup = this.logGroup('OrderWorkerLogGroup', `${this.stackName}-order-worker`);
    const orderWorkerFn = new NodejsFunction(this, 'OrderWorkerFn', {
      functionName: `${this.stackName}-order-worker`,
      entry: join(srcDir, 'activeMqWorker.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.seconds(30),
      loggingFormat: LoggingFormat.JSON,
      logGroup: orderWorkerLogGroup,
      environment: { ORDER_BROKER_ARN: orderBroker.attrArn },
      bundling: sharedBundling,
    });
    orderWorkerFn.addToRolePolicy(new PolicyStatement({ actions: POLLER_ACTIONS, resources: ['*'] }));
    orderBrokerSecret.grantRead(orderWorkerFn);

    const paymentWorkerLogGroup = this.logGroup('PaymentWorkerLogGroup', `${this.stackName}-payment-worker`);
    const paymentWorkerFn = new NodejsFunction(this, 'PaymentWorkerFn', {
      functionName: `${this.stackName}-payment-worker`,
      entry: join(srcDir, 'rabbitMqWorker.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.seconds(30),
      loggingFormat: LoggingFormat.JSON,
      logGroup: paymentWorkerLogGroup,
      environment: { PAYMENT_BROKER_ARN: paymentBroker.attrArn },
      bundling: sharedBundling,
    });
    paymentWorkerFn.addToRolePolicy(new PolicyStatement({ actions: POLLER_ACTIONS, resources: ['*'] }));
    paymentBrokerSecret.grantRead(paymentWorkerFn);

    // A RabbitMQ mapping needs its queue to exist already, and no CloudFormation resource declares
    // one. ActiveMQ needs nothing here, because it creates a queue the first time a consumer asks
    // for it.
    const declareQueuesName = `${this.stackName}-declare-queues`;
    const declareQueuesFn = new NodejsFunction(this, 'DeclareQueuesFn', {
      functionName: declareQueuesName,
      entry: join(srcDir, 'broker/declareQueues.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.minutes(3),
      loggingFormat: LoggingFormat.JSON,
      logGroup: this.logGroup('DeclareQueuesLogGroup', declareQueuesName),
      environment: { PAYMENT_BROKER_ENDPOINT: paymentBrokerEndpoint },
      bundling: sharedBundling,
    });
    paymentBrokerSecret.grantRead(declareQueuesFn);

    const queuesProvider = new Provider(this, 'QueuesProvider', {
      onEventHandler: declareQueuesFn,
      logGroup: this.logGroup('QueuesProviderLogGroup', `${this.stackName}-queues-provider`),
    });

    const paymentQueues = new CustomResource(this, 'PaymentQueues', {
      serviceToken: queuesProvider.serviceToken,
      properties: { queues: Object.values(PAYMENT_QUEUES).join(',') },
    });
    paymentQueues.node.addDependency(paymentBroker);

    this.mapping('OrderEventsMapping', {
      handler: orderWorkerFn,
      brokerArn: orderBroker.attrArn,
      queue: ORDER_QUEUES.events,
      secretArn: orderBrokerSecret.secretArn,
      batchSize: BATCH_SIZE,
    });

    this.mapping('OrderFailuresMapping', {
      handler: orderWorkerFn,
      brokerArn: orderBroker.attrArn,
      queue: ORDER_QUEUES.invalid,
      secretArn: orderBrokerSecret.secretArn,
      batchSize: FAILURE_BATCH_SIZE,
    });

    for (const [id, queue, batchSize] of [
      ['PaymentEventsMapping', PAYMENT_QUEUES.events, BATCH_SIZE],
      ['PaymentFailuresMapping', PAYMENT_QUEUES.invalid, FAILURE_BATCH_SIZE],
      ['PaymentReviewsMapping', PAYMENT_QUEUES.reviews, FAILURE_BATCH_SIZE],
      ['PaymentReceiptsMapping', PAYMENT_QUEUES.receipts, FAILURE_BATCH_SIZE],
    ] as const) {
      const mapping = this.mapping(id, {
        handler: paymentWorkerFn,
        brokerArn: paymentBroker.attrArn,
        queue,
        secretArn: paymentBrokerSecret.secretArn,
        batchSize,
      });
      mapping.node.addDependency(paymentQueues);
    }

    new CfnOutput(this, 'OrderBrokerStompEndpoint', { value: Fn.select(0, orderBroker.attrStompEndpoints) });
    new CfnOutput(this, 'PaymentBrokerAmqpEndpoint', { value: paymentBrokerEndpoint });
    new CfnOutput(this, 'OrderWorkerLogGroupName', { value: orderWorkerLogGroup.logGroupName });
    new CfnOutput(this, 'PaymentWorkerLogGroupName', { value: paymentWorkerLogGroup.logGroupName });
  }

  // Amazon MQ takes the broker password inline and Lambda reads the same pair from Secrets Manager, so
  // the secret is generated first and the broker is given its value.
  private brokerSecret(id: string, secretName: string): Secret {
    return new Secret(this, id, {
      secretName,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: BROKER_USERNAME }),
        generateStringKey: 'password',
        passwordLength: BROKER_PASSWORD_LENGTH,
        excludePunctuation: true,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }

  private mapping(id: string, props: MappingProps): CfnEventSourceMapping {
    return new CfnEventSourceMapping(this, id, {
      functionName: props.handler.functionArn,
      eventSourceArn: props.brokerArn,
      queues: [props.queue],
      batchSize: props.batchSize,
      maximumBatchingWindowInSeconds: BATCHING_WINDOW_SECONDS,
      sourceAccessConfigurations: [{ type: 'BASIC_AUTH', uri: props.secretArn }],
    });
  }

  // Owning every log group keeps cdk destroy clean. Left to Lambda they outlive the stack.
  private logGroup(id: string, functionName: string): LogGroup {
    return new LogGroup(this, id, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}

interface MappingProps {
  handler: IFunction;
  brokerArn: string;
  queue: string;
  secretArn: string;
  batchSize: number;
}
