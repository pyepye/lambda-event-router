import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import {
  ApiKey,
  LambdaIntegration,
  RequestAuthorizer,
  RestApi,
  TokenAuthorizer,
  UsagePlan,
} from 'aws-cdk-lib/aws-apigateway';
import { HttpApi, HttpMethod, PayloadFormatVersion, WebSocketApi, WebSocketStage } from 'aws-cdk-lib/aws-apigatewayv2';
import {
  HttpIamAuthorizer,
  HttpLambdaAuthorizer,
  HttpLambdaResponseType,
} from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration, WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

const FUNCTION_TIMEOUT_SECONDS = 10;
const FUNCTION_MEMORY_MB = 512;

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

    const workerLogGroup = new LogGroup(this, 'WorkerLogGroup', {
      logGroupName: `/aws/lambda/${this.stackName}-worker`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const authorizerLogGroup = new LogGroup(this, 'AuthorizerLogGroup', {
      logGroupName: `/aws/lambda/${this.stackName}-authorizer`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const workerFn = new NodejsFunction(this, 'WorkerFn', {
      functionName: `${this.stackName}-worker`,
      entry: join(srcDir, 'index.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: FUNCTION_MEMORY_MB,
      timeout: Duration.seconds(FUNCTION_TIMEOUT_SECONDS),
      loggingFormat: LoggingFormat.JSON,
      logGroup: workerLogGroup,
      bundling: sharedBundling,
    });

    const authorizerFn = new NodejsFunction(this, 'AuthorizerFn', {
      functionName: `${this.stackName}-authorizer`,
      entry: join(srcDir, 'authorizer.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: FUNCTION_MEMORY_MB,
      timeout: Duration.seconds(FUNCTION_TIMEOUT_SECONDS),
      loggingFormat: LoggingFormat.JSON,
      logGroup: authorizerLogGroup,
      bundling: sharedBundling,
    });

    // A cached authorizer decision skips the Lambda, so nothing here is cached.
    const noAuthorizerCache = Duration.seconds(0);

    // =========================================================================
    // REST API: payload format 1.0, a TOKEN authorizer, a REQUEST authorizer and an API key
    // =========================================================================

    const restApi = new RestApi(this, 'OrdersApi', {
      restApiName: `${this.stackName}-orders`,
      cloudWatchRole: false,
      // A request whose content type is listed here arrives base64 encoded.
      binaryMediaTypes: ['application/octet-stream'],
    });
    const restIntegration = new LambdaIntegration(workerFn);

    const staffTokenAuthorizer = new TokenAuthorizer(this, 'StaffTokenAuthorizer', {
      handler: authorizerFn,
      resultsCacheTtl: noAuthorizerCache,
    });

    // No identity source, so the authorizer runs even when the header it reads is absent.
    const warehouseRequestAuthorizer = new RequestAuthorizer(this, 'WarehouseRequestAuthorizer', {
      handler: authorizerFn,
      identitySources: [],
      resultsCacheTtl: noAuthorizerCache,
    });

    const orders = restApi.root.addResource('orders');
    orders.addMethod('POST', restIntegration, { authorizer: staffTokenAuthorizer });
    orders.addResource('pending').addMethod('GET', restIntegration);

    const order = orders.addResource('{orderId}');
    order.addMethod('GET', restIntegration, { authorizer: warehouseRequestAuthorizer });
    order.addMethod('PATCH', restIntegration);
    // The authorizer has no route for a REQUEST event on DELETE, so this method never reaches the
    // worker.
    order.addMethod('DELETE', restIntegration, { authorizer: warehouseRequestAuthorizer });
    order.addResource('lines').addResource('{lineId}').addMethod('GET', restIntegration);
    order.addResource('manifest').addMethod('PUT', restIntegration);

    restApi.root
      .addResource('warehouse')
      .addResource('stock')
      .addMethod('GET', restIntegration, { apiKeyRequired: true });

    const stockApiKey = new ApiKey(this, 'StockApiKey', { apiKeyName: `${this.stackName}-stock` });
    new UsagePlan(this, 'StockUsagePlan', {
      apiStages: [{ api: restApi, stage: restApi.deploymentStage }],
    }).addApiKey(stockApiKey);

    // =========================================================================
    // HTTP API: payload format 2.0 on the catch-all, payload format 1.0 on /dispatch
    // =========================================================================

    const payloadV2Integration = new HttpLambdaIntegration('WorkerPayloadV2', workerFn, {
      payloadFormatVersion: PayloadFormatVersion.VERSION_2_0,
    });
    const payloadV1Integration = new HttpLambdaIntegration('WorkerPayloadV1', workerFn, {
      payloadFormatVersion: PayloadFormatVersion.VERSION_1_0,
    });

    const fulfilmentApi = new HttpApi(this, 'FulfilmentApi', {
      apiName: `${this.stackName}-fulfilment`,
      defaultIntegration: payloadV2Integration,
    });

    fulfilmentApi.addRoutes({
      path: '/dispatch',
      methods: [HttpMethod.POST],
      integration: payloadV1Integration,
    });
    fulfilmentApi.addRoutes({
      path: '/dispatch/quote',
      methods: [HttpMethod.GET],
      integration: payloadV1Integration,
    });
    fulfilmentApi.addRoutes({
      path: '/dispatch/{consignmentId}',
      methods: [HttpMethod.GET],
      integration: payloadV1Integration,
    });
    fulfilmentApi.addRoutes({
      path: '/dispatch/{consignmentId}/label',
      methods: [HttpMethod.GET],
      integration: payloadV1Integration,
    });

    // The two modes send the authorizer different event shapes: simple response mode on payload
    // format 2.0, policy mode on 1.0.
    fulfilmentApi.addRoutes({
      path: '/inventory/{sku}',
      methods: [HttpMethod.PUT],
      integration: payloadV2Integration,
      authorizer: new HttpLambdaAuthorizer('StockSimpleAuthorizer', authorizerFn, {
        responseTypes: [HttpLambdaResponseType.SIMPLE],
        resultsCacheTtl: noAuthorizerCache,
      }),
    });
    fulfilmentApi.addRoutes({
      path: '/inventory/{sku}',
      methods: [HttpMethod.PATCH],
      integration: payloadV2Integration,
      authorizer: new HttpLambdaAuthorizer('StockPolicyAuthorizer', authorizerFn, {
        responseTypes: [HttpLambdaResponseType.IAM],
        resultsCacheTtl: noAuthorizerCache,
      }),
    });

    // IAM auth needs no authorizer Lambda: API Gateway checks the caller's SigV4 signature itself.
    fulfilmentApi.addRoutes({
      path: '/inventory/{sku}/audit',
      methods: [HttpMethod.GET],
      integration: payloadV2Integration,
      authorizer: new HttpIamAuthorizer(),
    });

    // =========================================================================
    // WebSocket API
    // =========================================================================

    const alertsApi = new WebSocketApi(this, 'AlertsApi', {
      apiName: `${this.stackName}-alerts`,
      connectRouteOptions: { integration: new WebSocketLambdaIntegration('AlertsConnect', workerFn) },
      disconnectRouteOptions: { integration: new WebSocketLambdaIntegration('AlertsDisconnect', workerFn) },
      defaultRouteOptions: { integration: new WebSocketLambdaIntegration('AlertsDefault', workerFn) },
    });

    alertsApi.addRoute('sendAlert', {
      integration: new WebSocketLambdaIntegration('AlertsSendAlert', workerFn),
    });
    alertsApi.addRoute('adminDrainQueue', {
      integration: new WebSocketLambdaIntegration('AlertsAdminDrainQueue', workerFn),
    });
    // The router has no route for this key, so a frame sent to it fails the invocation.
    alertsApi.addRoute('subscribe', {
      integration: new WebSocketLambdaIntegration('AlertsSubscribe', workerFn),
    });

    const alertsStage = new WebSocketStage(this, 'AlertsStage', {
      webSocketApi: alertsApi,
      stageName: 'prod',
      autoDeploy: true,
    });
    alertsStage.grantManagementApiAccess(workerFn);

    new CfnOutput(this, 'RestApiUrl', { value: restApi.url });
    new CfnOutput(this, 'HttpApiUrl', { value: fulfilmentApi.apiEndpoint });
    new CfnOutput(this, 'WebSocketUrl', { value: alertsStage.url });
    new CfnOutput(this, 'StockApiKeyId', { value: stockApiKey.keyId });
    new CfnOutput(this, 'WorkerLogGroupName', { value: workerLogGroup.logGroupName });
    new CfnOutput(this, 'AuthorizerLogGroupName', { value: authorizerLogGroup.logGroupName });
  }
}
