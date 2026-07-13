import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, CustomResource, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { LoggingFormat, Runtime, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { KafkaDlq, ManagedKafkaEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnCluster, CfnConfiguration } from 'aws-cdk-lib/aws-msk';
import { Provider } from 'aws-cdk-lib/custom-resources';
import type { Construct } from 'constructs';

import {
  BROKER_COUNT,
  FAILED_RECORDS_TOPIC,
  ORDERS_TOPIC,
  PAYMENTS_TOPIC,
  PRODUCER_FUNCTION_NAME,
  TOPIC_PARTITIONS,
  WORKER_FUNCTION_NAME,
} from '../src/config.js';

const KAFKA_VERSION = '3.6.0';
const BROKER_INSTANCE_TYPE = 'kafka.t3.small';
const BROKER_STORAGE_GIB = 1;
const PLAINTEXT_PORT = 9092;

const BATCH_SIZE = 10;
const BATCHING_WINDOW_SECONDS = 5;

// A record that always fails would otherwise hold up its partition until the topic drops it. Two
// retries is enough to show one in the log, and the record then goes to the failure topic.
const RETRY_ATTEMPTS = 2;

// One poller per mapping, all in one group, so the three mappings share a single event poller unit.
const POLLERS_PER_MAPPING = 1;

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

    // Isolated subnets and no NAT gateway, so nothing in the VPC costs anything. Provisioned mode
    // pollers reach the function without a route out of the VPC; on-demand ones would need a NAT
    // gateway or PrivateLink endpoints for Lambda and STS.
    const vpc = new Vpc(this, 'Vpc', {
      maxAzs: BROKER_COUNT,
      natGateways: 0,
      subnetConfiguration: [{ name: 'cluster', subnetType: SubnetType.PRIVATE_ISOLATED }],
    });

    const clusterSubnetIds = vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_ISOLATED }).subnetIds;

    // The poller creates its network interface with the cluster's security group, and the producer
    // runs in the same one, so a self-referencing rule covers both.
    const clusterSecurityGroup = new SecurityGroup(this, 'ClusterSecurityGroup', { vpc });
    clusterSecurityGroup.addIngressRule(clusterSecurityGroup, Port.tcp(PLAINTEXT_PORT), 'Kafka clients in this VPC');

    // MSK creates a topic on first use only when its configuration says so, and an auto-created topic
    // takes its partition count from num.partitions.
    const clusterConfiguration = new CfnConfiguration(this, 'ClusterConfiguration', {
      name: `${this.stackName}-cluster`,
      serverProperties: [
        'auto.create.topics.enable=true',
        `num.partitions=${TOPIC_PARTITIONS}`,
        `default.replication.factor=${BROKER_COUNT}`,
        'min.insync.replicas=1',
      ].join('\n'),
    });

    const cluster = new CfnCluster(this, 'Cluster', {
      clusterName: `${this.stackName}-cluster`,
      kafkaVersion: KAFKA_VERSION,
      numberOfBrokerNodes: BROKER_COUNT,
      brokerNodeGroupInfo: {
        instanceType: BROKER_INSTANCE_TYPE,
        clientSubnets: clusterSubnetIds,
        securityGroups: [clusterSecurityGroup.securityGroupId],
        storageInfo: { ebsStorageInfo: { volumeSize: BROKER_STORAGE_GIB } },
      },
      clientAuthentication: { unauthenticated: { enabled: true } },
      encryptionInfo: { encryptionInTransit: { clientBroker: 'PLAINTEXT', inCluster: false } },
      configurationInfo: {
        arn: clusterConfiguration.attrArn,
        revision: clusterConfiguration.attrLatestRevisionRevision,
      },
    });

    const bootstrapServers = this.bootstrapServers(cluster.attrArn);

    const workerLogGroup = this.logGroup('WorkerLogGroup', WORKER_FUNCTION_NAME);
    const workerFn = new NodejsFunction(this, 'WorkerFn', {
      functionName: WORKER_FUNCTION_NAME,
      entry: join(srcDir, 'index.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.seconds(30),
      loggingFormat: LoggingFormat.JSON,
      logGroup: workerLogGroup,
      environment: {
        CLUSTER_ARN: cluster.attrArn,
        BOOTSTRAP_SERVERS: bootstrapServers,
      },
      bundling: sharedBundling,
    });

    // The poller runs under the worker's role, and writing a failed record to the failure topic is
    // its work rather than the function's.
    workerFn.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'kafka-cluster:Connect',
          'kafka-cluster:DescribeTopic',
          'kafka-cluster:ReadData',
          'kafka-cluster:WriteData',
          'kafka:Produce',
        ],
        resources: [cluster.attrArn, this.formatArn({ service: 'kafka', resource: 'topic', resourceName: '*' })],
      }),
    );

    for (const topic of [ORDERS_TOPIC, PAYMENTS_TOPIC]) {
      workerFn.addEventSource(
        new ManagedKafkaEventSource({
          clusterArn: cluster.attrArn,
          topic,
          startingPosition: StartingPosition.TRIM_HORIZON,
          batchSize: BATCH_SIZE,
          maxBatchingWindow: Duration.seconds(BATCHING_WINDOW_SECONDS),
          reportBatchItemFailures: true,
          retryAttempts: RETRY_ATTEMPTS,
          onFailure: new KafkaDlq(FAILED_RECORDS_TOPIC),
          provisionedPollerConfig: this.pollerConfig(),
        }),
      );
    }

    // No failure destination on this one. Lambda refuses a mapping whose source and destination are
    // the same topic, and a record that fails here has nowhere further to go.
    workerFn.addEventSource(
      new ManagedKafkaEventSource({
        clusterArn: cluster.attrArn,
        topic: FAILED_RECORDS_TOPIC,
        startingPosition: StartingPosition.TRIM_HORIZON,
        batchSize: BATCH_SIZE,
        maxBatchingWindow: Duration.seconds(BATCHING_WINDOW_SECONDS),
        reportBatchItemFailures: true,
        retryAttempts: RETRY_ATTEMPTS,
        provisionedPollerConfig: this.pollerConfig(),
      }),
    );

    const producerFn = new NodejsFunction(this, 'ProducerFn', {
      functionName: PRODUCER_FUNCTION_NAME,
      entry: join(srcDir, 'producer.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.minutes(2),
      loggingFormat: LoggingFormat.JSON,
      logGroup: this.logGroup('ProducerLogGroup', PRODUCER_FUNCTION_NAME),
      vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      securityGroups: [clusterSecurityGroup],
      environment: {
        CLUSTER_ARN: cluster.attrArn,
        BOOTSTRAP_SERVERS: bootstrapServers,
      },
      bundling: sharedBundling,
    });

    new CfnOutput(this, 'ClusterArn', { value: cluster.attrArn });
    new CfnOutput(this, 'BootstrapServers', { value: bootstrapServers });
    new CfnOutput(this, 'ProducerFunctionName', { value: producerFn.functionName });
    new CfnOutput(this, 'WorkerLogGroupName', { value: workerLogGroup.logGroupName });
  }

  private pollerConfig(): { minimumPollers: number; maximumPollers: number; pollerGroupName: string } {
    return {
      minimumPollers: POLLERS_PER_MAPPING,
      maximumPollers: POLLERS_PER_MAPPING,
      pollerGroupName: this.stackName,
    };
  }

  private bootstrapServers(clusterArn: string): string {
    const lookupName = `${this.stackName}-bootstrap-brokers`;
    const lookupFn = new NodejsFunction(this, 'BootstrapBrokersFn', {
      functionName: lookupName,
      entry: join(fileURLToPath(new URL('../src/infra', import.meta.url)), 'bootstrapBrokers.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.minutes(2),
      loggingFormat: LoggingFormat.JSON,
      logGroup: this.logGroup('BootstrapBrokersLogGroup', lookupName),
      // The Kafka client is bundled rather than taken from the runtime. Not every AWS SDK client
      // ships in the Node runtime, and a missing one only shows up on the first invocation.
      bundling: { ...sharedBundling, externalModules: [] },
    });
    lookupFn.addToRolePolicy(new PolicyStatement({ actions: ['kafka:GetBootstrapBrokers'], resources: [clusterArn] }));

    const provider = new Provider(this, 'BootstrapBrokersProvider', {
      onEventHandler: lookupFn,
      logGroup: this.logGroup('BootstrapBrokersProviderLogGroup', `${this.stackName}-bootstrap-brokers-provider`),
    });

    const lookup = new CustomResource(this, 'BootstrapBrokers', {
      serviceToken: provider.serviceToken,
      properties: { clusterArn },
    });

    return lookup.getAttString('bootstrapServers');
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
