import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, Fn, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { CfnContactFlow, CfnInstance, CfnIntegrationAssociation } from 'aws-cdk-lib/aws-connect';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

import { contactFlowContent, taskFlowContent } from './contactFlow.js';

const CONTACT_FLOW_ARN_ID_INDEX = 3;

const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const entry = join(srcDir, 'index.ts');

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

    // The alias becomes a hostname under my.connect.aws, so it has to be unique across all of AWS.
    const instanceAlias = `${this.stackName}-${this.account}`;

    const instance = new CfnInstance(this, 'ContactCentre', {
      identityManagementType: 'CONNECT_MANAGED',
      instanceAlias,
      attributes: { inboundCalls: false, outboundCalls: false },
    });

    const workerFunctionName = `${this.stackName}-worker`;

    const workerLogGroup = new LogGroup(this, 'WorkerLogGroup', {
      logGroupName: `/aws/lambda/${workerFunctionName}`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const workerFn = new NodejsFunction(this, 'WorkerFn', {
      functionName: workerFunctionName,
      entry,
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.seconds(30),
      loggingFormat: LoggingFormat.JSON,
      logGroup: workerLogGroup,
      environment: {
        CONNECT_INSTANCE_ARN: instance.attrArn,
      },
      bundling: sharedBundling,
    });

    workerFn.addPermission('ConnectInvoke', {
      principal: new ServicePrincipal('connect.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: instance.attrArn,
    });

    // Connect rejects a flow naming a function the instance is not associated with, so the flow
    // waits for this.
    const workerAssociation = new CfnIntegrationAssociation(this, 'WorkerAssociation', {
      instanceId: instance.attrArn,
      integrationType: 'LAMBDA_FUNCTION',
      integrationArn: workerFn.functionArn,
    });

    const supportFlow = new CfnContactFlow(this, 'SupportFlow', {
      instanceArn: instance.attrArn,
      name: `${this.stackName}-support`,
      type: 'CONTACT_FLOW',
      state: 'ACTIVE',
      content: contactFlowContent(workerFn.functionArn),
    });
    supportFlow.addDependency(workerAssociation);

    const taskFlow = new CfnContactFlow(this, 'TaskFlow', {
      instanceArn: instance.attrArn,
      name: `${this.stackName}-task`,
      type: 'CONTACT_FLOW',
      state: 'ACTIVE',
      content: taskFlowContent(workerFn.functionArn),
    });
    taskFlow.addDependency(workerAssociation);

    new CfnOutput(this, 'InstanceId', { value: instance.attrId });
    new CfnOutput(this, 'InstanceArn', { value: instance.attrArn });
    new CfnOutput(this, 'ContactFlowId', {
      value: Fn.select(CONTACT_FLOW_ARN_ID_INDEX, Fn.split('/', supportFlow.attrContactFlowArn)),
    });
    new CfnOutput(this, 'TaskFlowId', {
      value: Fn.select(CONTACT_FLOW_ARN_ID_INDEX, Fn.split('/', taskFlow.attrContactFlowArn)),
    });
    new CfnOutput(this, 'WorkerLogGroupName', { value: workerLogGroup.logGroupName });
  }
}
