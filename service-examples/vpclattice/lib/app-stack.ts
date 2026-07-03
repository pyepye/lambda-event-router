import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnPermission, LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  CfnAuthPolicy,
  CfnListener,
  CfnService,
  CfnServiceNetwork,
  CfnServiceNetworkServiceAssociation,
  CfnServiceNetworkVpcAssociation,
  CfnTargetGroup,
} from 'aws-cdk-lib/aws-vpclattice';
import type { Construct } from 'constructs';

import { V1_LISTENER_PORT, V2_LISTENER_PORT } from '../src/utils/constants.js';

const INVENTORY_TIMEOUT_SECONDS = 10;
const ORDERING_TIMEOUT_SECONDS = 120;
const FUNCTION_MEMORY_MB = 512;
const VPC_CIDR_MASK = 24;

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

    const inventoryLogGroup = new LogGroup(this, 'InventoryLogGroup', {
      logGroupName: `/aws/lambda/${this.stackName}-inventory`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const orderingLogGroup = new LogGroup(this, 'OrderingLogGroup', {
      logGroupName: `/aws/lambda/${this.stackName}-ordering`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // A Lambda target is invoked through the Lambda API rather than over the network, so the
    // inventory function stays out of the VPC.
    const inventoryFn = new NodejsFunction(this, 'InventoryFn', {
      functionName: `${this.stackName}-inventory`,
      entry: join(srcDir, 'index.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: FUNCTION_MEMORY_MB,
      timeout: Duration.seconds(INVENTORY_TIMEOUT_SECONDS),
      loggingFormat: LoggingFormat.JSON,
      logGroup: inventoryLogGroup,
      bundling: sharedBundling,
    });

    const latticeInvoke = new CfnPermission(this, 'LatticeInvokePermission', {
      action: 'lambda:InvokeFunction',
      functionName: inventoryFn.functionArn,
      principal: 'vpc-lattice.amazonaws.com',
    });

    // =========================================================================
    // The service network, and the VPC the caller sits in
    // =========================================================================

    const vpc = new Vpc(this, 'ServiceVpc', {
      maxAzs: 1,
      natGateways: 0,
      restrictDefaultSecurityGroup: false,
      subnetConfiguration: [{ name: 'isolated', subnetType: SubnetType.PRIVATE_ISOLATED, cidrMask: VPC_CIDR_MASK }],
    });

    const serviceNetwork = new CfnServiceNetwork(this, 'ServiceNetwork', {
      name: `${this.stackName}-network`,
      authType: 'NONE',
    });

    new CfnServiceNetworkVpcAssociation(this, 'VpcAssociation', {
      serviceNetworkIdentifier: serviceNetwork.attrId,
      vpcIdentifier: vpc.vpcId,
    });

    // =========================================================================
    // The inventory service, with a listener per payload version
    // =========================================================================

    const service = new CfnService(this, 'InventoryService', {
      name: `${this.stackName}-inventory`,
      authType: 'AWS_IAM',
    });

    // A signed caller arrives with `identity.principal` set on the 2.0 payload and an unsigned one
    // does not, so both reach the worker and the router sees the difference.
    new CfnAuthPolicy(this, 'InventoryAuthPolicy', {
      resourceIdentifier: service.attrArn,
      policy: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: 'vpc-lattice-svcs:Invoke',
            Resource: '*',
          },
        ],
      },
    });

    new CfnServiceNetworkServiceAssociation(this, 'ServiceAssociation', {
      serviceNetworkIdentifier: serviceNetwork.attrId,
      serviceIdentifier: service.attrId,
    });

    const v1TargetGroup = new CfnTargetGroup(this, 'InventoryV1TargetGroup', {
      name: `${this.stackName}-v1`,
      type: 'LAMBDA',
      config: { lambdaEventStructureVersion: 'V1' },
      targets: [{ id: inventoryFn.functionArn }],
    });
    v1TargetGroup.node.addDependency(latticeInvoke);

    const v2TargetGroup = new CfnTargetGroup(this, 'InventoryV2TargetGroup', {
      name: `${this.stackName}-v2`,
      type: 'LAMBDA',
      config: { lambdaEventStructureVersion: 'V2' },
      targets: [{ id: inventoryFn.functionArn }],
    });
    v2TargetGroup.node.addDependency(latticeInvoke);

    new CfnListener(this, 'V1Listener', {
      serviceIdentifier: service.attrId,
      name: `${this.stackName}-v1`,
      protocol: 'HTTP',
      port: V1_LISTENER_PORT,
      defaultAction: { forward: { targetGroups: [{ targetGroupIdentifier: v1TargetGroup.attrId }] } },
    });

    new CfnListener(this, 'V2Listener', {
      serviceIdentifier: service.attrId,
      name: `${this.stackName}-v2`,
      protocol: 'HTTP',
      port: V2_LISTENER_PORT,
      defaultAction: { forward: { targetGroups: [{ targetGroupIdentifier: v2TargetGroup.attrId }] } },
    });

    // =========================================================================
    // The caller, inside the associated VPC
    // =========================================================================

    const orderingFn = new NodejsFunction(this, 'OrderingFn', {
      functionName: `${this.stackName}-ordering`,
      entry: join(srcDir, 'orderingService.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: FUNCTION_MEMORY_MB,
      timeout: Duration.seconds(ORDERING_TIMEOUT_SECONDS),
      loggingFormat: LoggingFormat.JSON,
      logGroup: orderingLogGroup,
      vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      environment: { LATTICE_DOMAIN: service.attrDnsEntryDomainName },
      bundling: sharedBundling,
    });

    orderingFn.addToRolePolicy(
      new PolicyStatement({ effect: Effect.ALLOW, actions: ['vpc-lattice-svcs:Invoke'], resources: ['*'] }),
    );

    new CfnOutput(this, 'LatticeDomain', { value: service.attrDnsEntryDomainName });
    new CfnOutput(this, 'OrderingFunctionName', { value: orderingFn.functionName });
    new CfnOutput(this, 'InventoryLogGroupName', { value: inventoryLogGroup.logGroupName });
    new CfnOutput(this, 'OrderingLogGroupName', { value: orderingLogGroup.logGroupName });
  }
}
