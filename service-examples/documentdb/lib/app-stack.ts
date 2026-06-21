import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ArnFormat, CfnOutput, CustomResource, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { ClusterParameterGroup, DatabaseCluster } from 'aws-cdk-lib/aws-docdb';
import { InstanceClass, InstanceSize, InstanceType, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnEventSourceMapping, LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Provider } from 'aws-cdk-lib/custom-resources';
import type { Construct } from 'constructs';

import { CHANGE_STREAM_SOURCES, CLUSTER_SECRET_NAME } from '../src/utils/cluster.js';

const DOCUMENTDB_PORT = 27017;
const WORKER_BATCH_SIZE = 100;

// Long enough for one seed run to reach a worker as a single batch.
const WORKER_BATCHING_WINDOW_SECONDS = 5;

// The shortest retention the cluster allows, which keeps the change stream log small.
const CHANGE_STREAM_LOG_RETENTION_SECONDS = 3600;

// Lambda supports DocumentDB 4.0 and 5.0 only, and the parameter group family has to match.
const ENGINE_VERSION = '5.0.0';
const PARAMETER_GROUP_FAMILY = 'docdb5.0';

// The change stream poller runs under the worker's role and reaches the cluster through the VPC.
const POLLER_ACTIONS = [
  'rds:DescribeDBClusters',
  'rds:DescribeDBClusterParameters',
  'rds:DescribeDBSubnetGroups',
  'ec2:CreateNetworkInterface',
  'ec2:DescribeNetworkInterfaces',
  'ec2:DescribeVpcs',
  'ec2:DeleteNetworkInterface',
  'ec2:DescribeSubnets',
  'ec2:DescribeSecurityGroups',
  'kms:Decrypt',
];

// The mongodb driver requires these lazily and ships without them, so esbuild has to leave them out.
const MONGODB_OPTIONAL_MODULES = [
  '@mongodb-js/zstd',
  'gcp-metadata',
  'kerberos',
  'mongodb-client-encryption',
  'snappy',
  'socks',
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

// The CA bundle is loaded as text so the certificate travels inside the bundle.
const clusterBundling: NodejsFunctionProps['bundling'] = {
  ...sharedBundling,
  externalModules: ['@aws-sdk/*', ...MONGODB_OPTIONAL_MODULES],
  loader: { '.pem': 'text' },
};

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, 'Vpc', { maxAzs: 2, natGateways: 1 });

    const clusterSecurityGroup = new SecurityGroup(this, 'ClusterSecurityGroup', { vpc });
    clusterSecurityGroup.addIngressRule(
      clusterSecurityGroup,
      Port.tcp(DOCUMENTDB_PORT),
      'Cluster clients and the change stream poller',
    );

    const clusterParameters = new ClusterParameterGroup(this, 'ClusterParameters', {
      family: PARAMETER_GROUP_FAMILY,
      parameters: { change_stream_log_retention_duration: String(CHANGE_STREAM_LOG_RETENTION_SECONDS) },
    });

    const cluster = new DatabaseCluster(this, 'ShopCluster', {
      dbClusterName: `${this.stackName}-shop`,
      engineVersion: ENGINE_VERSION,
      masterUser: { username: 'shopadmin', secretName: CLUSTER_SECRET_NAME },
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM),
      instances: 1,
      vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      securityGroup: clusterSecurityGroup,
      parameterGroup: clusterParameters,
      backup: { retention: Duration.days(1) },
      deletionProtection: false,
      removalPolicy: RemovalPolicy.DESTROY,
      instanceRemovalPolicy: RemovalPolicy.DESTROY,
    });

    const clusterSecret = cluster.secret;
    if (!clusterSecret) {
      throw new Error('The cluster generated no secret, so the change stream poller has no credentials.');
    }

    const clusterArn = this.formatArn({
      service: 'rds',
      resource: 'cluster',
      resourceName: cluster.clusterIdentifier,
      arnFormat: ArnFormat.COLON_RESOURCE_NAME,
    });

    const workerLogGroup = this.logGroup('WorkerLogGroup', `${this.stackName}-worker`);

    const workerFn = new NodejsFunction(this, 'WorkerFn', {
      functionName: `${this.stackName}-worker`,
      entry: join(srcDir, 'index.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.seconds(30),
      loggingFormat: LoggingFormat.JSON,
      logGroup: workerLogGroup,
      environment: { CLUSTER_ARN: clusterArn },
      bundling: sharedBundling,
    });

    workerFn.addToRolePolicy(new PolicyStatement({ actions: POLLER_ACTIONS, resources: ['*'] }));
    clusterSecret.grantRead(workerFn);

    const clusterFunctionProps: NodejsFunctionProps = {
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.minutes(2),
      loggingFormat: LoggingFormat.JSON,
      vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [clusterSecurityGroup],
      environment: {
        CLUSTER_SECRET_ARN: clusterSecret.secretArn,
        CLUSTER_HOST: cluster.clusterEndpoint.hostname,
        CLUSTER_PORT: String(cluster.clusterEndpoint.port),
      },
      bundling: clusterBundling,
    };

    const enableChangeStreamsName = `${this.stackName}-enable-change-streams`;
    const enableChangeStreamsFn = new NodejsFunction(this, 'EnableChangeStreamsFn', {
      ...clusterFunctionProps,
      functionName: enableChangeStreamsName,
      logGroup: this.logGroup('EnableChangeStreamsLogGroup', enableChangeStreamsName),
      entry: join(srcDir, 'cluster/enableChangeStreams.ts'),
    });
    clusterSecret.grantRead(enableChangeStreamsFn);

    const changeStreamsProvider = new Provider(this, 'ChangeStreamsProvider', {
      onEventHandler: enableChangeStreamsFn,
      logGroup: this.logGroup('ChangeStreamsProviderLogGroup', `${this.stackName}-change-streams-provider`),
    });

    const changeStreams = new CustomResource(this, 'ChangeStreams', {
      serviceToken: changeStreamsProvider.serviceToken,
      properties: {
        scopes: CHANGE_STREAM_SOURCES.map((source) => `${source.database}.${source.collection ?? ''}`).join(','),
      },
    });

    // A cluster reports complete before its instance does, and a cluster with no running instance
    // accepts no connections.
    changeStreams.node.addDependency(cluster);

    const seedName = `${this.stackName}-seed`;
    const seedFn = new NodejsFunction(this, 'SeedCollectionsFn', {
      ...clusterFunctionProps,
      functionName: seedName,
      logGroup: this.logGroup('SeedCollectionsLogGroup', seedName),
      entry: join(srcDir, 'cluster/seedCollections.ts'),
    });
    clusterSecret.grantRead(seedFn);

    // A mapping created before change streams are on has nothing to read.
    for (const source of CHANGE_STREAM_SOURCES) {
      const mapping = new CfnEventSourceMapping(this, source.id, {
        functionName: workerFn.functionArn,
        eventSourceArn: clusterArn,
        batchSize: WORKER_BATCH_SIZE,
        maximumBatchingWindowInSeconds: WORKER_BATCHING_WINDOW_SECONDS,
        startingPosition: 'LATEST',
        sourceAccessConfigurations: [{ type: 'BASIC_AUTH', uri: clusterSecret.secretArn }],
        documentDbEventSourceConfig: {
          databaseName: source.database,
          collectionName: source.collection,
          fullDocument: source.fullDocument,
        },
      });
      mapping.node.addDependency(changeStreams);
    }

    new CfnOutput(this, 'SeedFunctionName', { value: seedFn.functionName });
    new CfnOutput(this, 'WorkerLogGroupName', { value: workerLogGroup.logGroupName });
    new CfnOutput(this, 'ClusterArn', { value: clusterArn });
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
