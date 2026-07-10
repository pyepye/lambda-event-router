import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  DefinitionBody,
  type IChainable,
  IntegrationPattern,
  JsonPath,
  Parallel,
  Pass,
  StateMachine,
  StateMachineType,
  TaskInput,
  type TaskStateBase,
  Timeout,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import type { Construct } from 'constructs';

import {
  CHARGE_PAYMENT_TASK,
  FRAUD_REVIEW_TASK,
  MANUAL_RELEASE_TASK,
  RECONCILE_LEDGER_TASK,
  RELEASE_STOCK_HOLD_TASK,
  RESERVE_STOCK_TASK,
  STATE_MACHINE_NAME,
} from '../src/config.js';

const CALLBACK_TIMEOUT_SECONDS = 60;
const RELEASE_RETRY_ATTEMPTS = 2;

const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const entry = join(srcDir, 'index.ts');

const sharedBundling: NodejsFunctionProps['bundling'] = {
  format: OutputFormat.ESM,
  target: 'node22',
  minify: true,
  sourceMap: true,
  mainFields: ['module', 'main'],
  // The Step Functions client is bundled rather than taken from the runtime, so the callback
  // handlers do not depend on which SDK version the runtime ships.
  externalModules: [],
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

    const workerFn = new NodejsFunction(this, 'WorkerFn', {
      functionName: `${this.stackName}-worker`,
      entry,
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: Duration.seconds(30),
      loggingFormat: LoggingFormat.JSON,
      logGroup: workerLogGroup,
      bundling: sharedBundling,
    });

    // The task token is the authorisation for a callback, so this is unscoped. Narrowing it to the
    // state machine ARN makes a circular dependency, because the state machine already holds a
    // reference to this function.
    workerFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['states:SendTaskSuccess', 'states:SendTaskFailure'],
        resources: ['*'],
      }),
    );

    const orderId = JsonPath.stringAt('$.orderId');

    const invoke = (stateId: string, payload: Record<string, unknown>): LambdaInvoke =>
      new LambdaInvoke(this, stateId, {
        lambdaFunction: workerFn,
        payload: TaskInput.fromObject(payload),
        payloadResponseOnly: true,
      });

    // A callback task takes its result from SendTaskSuccess. The timeout caps a branch whose handler
    // never reaches that call, so a failed execution ends rather than waiting for the state machine
    // timeout.
    const invokeAndWaitForToken = (stateId: string, payload: Record<string, unknown>): LambdaInvoke =>
      new LambdaInvoke(this, stateId, {
        lambdaFunction: workerFn,
        integrationPattern: IntegrationPattern.WAIT_FOR_TASK_TOKEN,
        payload: TaskInput.fromObject({ TaskToken: JsonPath.taskToken, ...payload }),
        taskTimeout: Timeout.duration(Duration.seconds(CALLBACK_TIMEOUT_SECONDS)),
      });

    // Each branch catches its own failure. Without that a single failing branch fails the Parallel
    // state and cancels the others, and the execution output would show one error instead of nine
    // results.
    const branch = (stateId: string, step: string, task: TaskStateBase): IChainable =>
      task.addCatch(
        new Pass(this, `${stateId}Failed`, {
          parameters: { step, error: JsonPath.objectAt('$.caught') },
        }),
        { errors: ['States.ALL'], resultPath: '$.caught' },
      );

    const fulfilOrder = new Parallel(this, 'FulfilOrder');

    fulfilOrder.branch(
      branch(
        'ReserveStock',
        'reserveStock',
        invoke('ReserveStock', { task: RESERVE_STOCK_TASK, orderId, sku: 'SKU-8891', quantity: 2 }),
      ),
      branch(
        'ChargePayment',
        'chargePayment',
        invoke('ChargePayment', { task: CHARGE_PAYMENT_TASK, orderId, amountPence: 4250, currency: 'GBP' }),
      ),
      branch(
        'AwaitFraudReview',
        'approveFraudReview',
        invokeAndWaitForToken('AwaitFraudReview', { task: FRAUD_REVIEW_TASK, orderId, riskScore: 12 }),
      ),
      branch(
        'AwaitManualRelease',
        'failUnknownCallback',
        invokeAndWaitForToken('AwaitManualRelease', {
          task: MANUAL_RELEASE_TASK,
          orderId,
          holdReason: 'address-mismatch',
        }),
      ),
      branch(
        'AwaitStockReservation',
        'awaitStockReservation',
        invokeAndWaitForToken('AwaitStockReservation', {
          task: RESERVE_STOCK_TASK,
          orderId,
          sku: 'SKU-8891',
          quantity: 2,
        }),
      ),
      branch(
        'ReleaseStockHold',
        'releaseStockHold',
        invoke('ReleaseStockHold', {
          task: RELEASE_STOCK_HOLD_TASK,
          orderId,
          reservationId: JsonPath.format('RES-{}', orderId),
        }).addRetry({
          errors: ['States.ALL'],
          maxAttempts: RELEASE_RETRY_ATTEMPTS,
          interval: Duration.seconds(1),
          backoffRate: 1,
        }),
      ),
      branch(
        'ReconcileLedger',
        'reconcileLedger',
        invoke('ReconcileLedger', { task: RECONCILE_LEDGER_TASK, orderId, period: '2026-09' }),
      ),
      branch(
        'ChargeUnpricedOrder',
        'chargeUnpricedOrder',
        invoke('ChargeUnpricedOrder', {
          task: CHARGE_PAYMENT_TASK,
          orderId,
          amountPence: 'four thousand two hundred and fifty',
          currency: 'GBP',
        }),
      ),
      branch(
        'AwaitUnscoredReview',
        'awaitUnscoredReview',
        invokeAndWaitForToken('AwaitUnscoredReview', { task: FRAUD_REVIEW_TASK, orderId }),
      ),
      branch(
        'ForwardScheduledEvent',
        'forwardScheduledEvent',
        invoke('ForwardScheduledEvent', {
          source: 'aws.events',
          'detail-type': 'Scheduled Event',
          detail: { orderId },
        }),
      ),
    );

    const stateMachine = new StateMachine(this, 'OrderFulfilment', {
      stateMachineName: STATE_MACHINE_NAME,
      stateMachineType: StateMachineType.STANDARD,
      definitionBody: DefinitionBody.fromChainable(fulfilOrder),
      timeout: Duration.minutes(5),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new CfnOutput(this, 'StateMachineArn', { value: stateMachine.stateMachineArn });
    new CfnOutput(this, 'WorkerLogGroupName', { value: workerLogGroup.logGroupName });
  }
}
