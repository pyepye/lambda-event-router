import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  TargetType,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { LambdaTarget } from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

import { MULTI_VALUE_LISTENER_PORT, SINGLE_VALUE_LISTENER_PORT } from '../src/utils/constants.js';

const WORKER_TIMEOUT_SECONDS = 10;
const WORKER_MEMORY_MB = 512;
const VPC_CIDR_MASK = 24;
const VPC_AZ_COUNT = 2;

const srcDir = fileURLToPath(new URL('../src', import.meta.url));

const sharedBundling: NodejsFunctionProps['bundling'] = {
  format: OutputFormat.ESM,
  target: 'node22',
  minify: true,
  sourceMap: true,
  mainFields: ['module', 'main'],
  esbuildArgs: { '--conditions': 'module' },
  banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
};

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const workerLogGroup = new LogGroup(this, 'WorkerLogGroup', {
      logGroupName: `/aws/lambda/${this.stackName}-worker`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // A Lambda target is invoked through the Lambda API rather than over the network, so the worker
    // stays out of the VPC.
    const workerFn = new NodejsFunction(this, 'WorkerFn', {
      functionName: `${this.stackName}-worker`,
      entry: join(srcDir, 'index.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: WORKER_MEMORY_MB,
      timeout: Duration.seconds(WORKER_TIMEOUT_SECONDS),
      loggingFormat: LoggingFormat.JSON,
      logGroup: workerLogGroup,
      bundling: sharedBundling,
    });

    // An ALB needs subnets in two availability zones. Public ones carry no charge and need no NAT
    // gateway, and nothing else in the stack sits inside the VPC.
    const vpc = new Vpc(this, 'DeskVpc', {
      maxAzs: VPC_AZ_COUNT,
      natGateways: 0,
      restrictDefaultSecurityGroup: false,
      subnetConfiguration: [{ name: 'public', subnetType: SubnetType.PUBLIC, cidrMask: VPC_CIDR_MASK }],
    });

    const loadBalancer = new ApplicationLoadBalancer(this, 'ReturnsAlb', {
      loadBalancerName: `${this.stackName}`,
      vpc,
      internetFacing: true,
    });

    // A health check would invoke the worker on a timer, which puts events in the log that the
    // trigger never sent.
    const singleValueTargetGroup = new ApplicationTargetGroup(this, 'SingleValueTargetGroup', {
      targetGroupName: `${this.stackName}-single`,
      targetType: TargetType.LAMBDA,
      targets: [new LambdaTarget(workerFn)],
      healthCheck: { enabled: false },
    });

    const multiValueTargetGroup = new ApplicationTargetGroup(this, 'MultiValueTargetGroup', {
      targetGroupName: `${this.stackName}-multi`,
      targetType: TargetType.LAMBDA,
      targets: [new LambdaTarget(workerFn)],
      healthCheck: { enabled: false },
    });

    // The attribute is the only thing that decides which event form the load balancer sends.
    multiValueTargetGroup.setAttribute('lambda.multi_value_headers.enabled', 'true');

    loadBalancer.addListener('SingleValueListener', {
      port: SINGLE_VALUE_LISTENER_PORT,
      protocol: ApplicationProtocol.HTTP,
      open: true,
      defaultTargetGroups: [singleValueTargetGroup],
    });

    loadBalancer.addListener('MultiValueListener', {
      port: MULTI_VALUE_LISTENER_PORT,
      protocol: ApplicationProtocol.HTTP,
      open: true,
      defaultTargetGroups: [multiValueTargetGroup],
    });

    new CfnOutput(this, 'AlbDnsName', { value: loadBalancer.loadBalancerDnsName });
    new CfnOutput(this, 'SingleValueTargetGroupArn', { value: singleValueTargetGroup.targetGroupArn });
    new CfnOutput(this, 'MultiValueTargetGroupArn', { value: multiValueTargetGroup.targetGroupArn });
    new CfnOutput(this, 'WorkerLogGroupName', { value: workerLogGroup.logGroupName });
  }
}
