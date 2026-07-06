import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ArnFormat, CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { CfnBot } from 'aws-cdk-lib/aws-lex';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

import {
  BOOK_REDELIVERY_INTENT,
  CANCEL_DELIVERY_INTENT,
  FALLBACK_INTENT,
  LOCALE_ID,
  SPEAK_TO_AGENT_INTENT,
  TRACK_PARCEL_INTENT,
  TRACKING_NUMBER_SLOT,
} from '../src/utils/constants.js';

const TEST_ALIAS_ID = 'TSTALIASID';
const NLU_CONFIDENCE_THRESHOLD = 0.4;
const SESSION_TTL_SECONDS = 300;

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

function plainText(value: string): CfnBot.ResponseSpecificationProperty {
  return { messageGroupsList: [{ message: { plainTextMessage: { value } } }] };
}

function utterances(values: string[]): CfnBot.SampleUtteranceProperty[] {
  return values.map((utterance) => ({ utterance }));
}

// A required slot with a prompt of its own. The dialog code hook answers with its own message, so the
// prompt only shows when Lex elicits the slot without asking the worker.
const trackingNumberSlot: CfnBot.SlotProperty = {
  name: TRACKING_NUMBER_SLOT,
  slotTypeName: 'AMAZON.AlphaNumeric',
  valueElicitationSetting: {
    slotConstraint: 'Required',
    promptSpecification: {
      maxRetries: 2,
      messageGroupsList: [{ message: { plainTextMessage: { value: 'What is the tracking number?' } } }],
    },
  },
};

const intents: CfnBot.IntentProperty[] = [
  {
    name: TRACK_PARCEL_INTENT,
    sampleUtterances: utterances(['track my parcel', 'where is my parcel', 'track a parcel']),
    slots: [trackingNumberSlot],
    slotPriorities: [{ priority: 1, slotName: TRACKING_NUMBER_SLOT }],
    dialogCodeHook: { enabled: true },
    fulfillmentCodeHook: { enabled: true },
  },
  {
    name: CANCEL_DELIVERY_INTENT,
    sampleUtterances: utterances(['cancel my delivery', 'cancel a delivery', 'stop my delivery']),
    slots: [trackingNumberSlot],
    slotPriorities: [{ priority: 1, slotName: TRACKING_NUMBER_SLOT }],
    dialogCodeHook: { enabled: true },
    fulfillmentCodeHook: { enabled: true },
  },
  {
    name: BOOK_REDELIVERY_INTENT,
    sampleUtterances: utterances(['book a redelivery', 'rearrange my delivery', 'redeliver my parcel']),
    fulfillmentCodeHook: { enabled: true },
  },
  {
    name: SPEAK_TO_AGENT_INTENT,
    sampleUtterances: utterances(['speak to an agent', 'talk to a human', 'put me through to someone']),
    fulfillmentCodeHook: {
      enabled: true,
      postFulfillmentStatusSpecification: {
        failureResponse: plainText('Sorry, I could not put you through to an agent.'),
      },
    },
  },
  {
    name: FALLBACK_INTENT,
    parentIntentSignature: 'AMAZON.FallbackIntent',
    fulfillmentCodeHook: {
      enabled: true,
      postFulfillmentStatusSpecification: {
        failureResponse: plainText('Sorry, I did not understand that.'),
      },
    },
  },
];

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const workerFunctionName = `${this.stackName}-worker`;
    const workerFunctionArn = this.formatArn({
      service: 'lambda',
      resource: 'function',
      resourceName: workerFunctionName,
      arnFormat: ArnFormat.COLON_RESOURCE_NAME,
    });

    const botRole = new Role(this, 'BotRole', {
      assumedBy: new ServicePrincipal('lexv2.amazonaws.com'),
    });
    botRole.addToPolicy(
      new PolicyStatement({ actions: ['polly:SynthesizeSpeech', 'comprehend:DetectSentiment'], resources: ['*'] }),
    );

    // The code hook holds the worker ARN as a literal string. Reading it off the function construct
    // would make the bot depend on the function, which already depends on the bot for BOT_ID.
    const bot = new CfnBot(this, 'ParcelSupportBot', {
      name: `${this.stackName}-parcel-support`,
      roleArn: botRole.roleArn,
      dataPrivacy: { ChildDirected: false },
      idleSessionTtlInSeconds: SESSION_TTL_SECONDS,
      autoBuildBotLocales: true,
      botLocales: [
        {
          localeId: LOCALE_ID,
          nluConfidenceThreshold: NLU_CONFIDENCE_THRESHOLD,
          intents,
        },
      ],
      testBotAliasSettings: {
        sentimentAnalysisSettings: { DetectSentiment: false },
        botAliasLocaleSettings: [
          {
            localeId: LOCALE_ID,
            botAliasLocaleSetting: {
              enabled: true,
              codeHookSpecification: {
                lambdaCodeHook: { lambdaArn: workerFunctionArn, codeHookInterfaceVersion: '1.0' },
              },
            },
          },
        ],
      },
    });

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
        BOT_ID: bot.attrId,
      },
      bundling: sharedBundling,
    });

    const testAliasArn = this.formatArn({
      service: 'lex',
      resource: 'bot-alias',
      resourceName: `${bot.attrId}/${TEST_ALIAS_ID}`,
      arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
    });

    workerFn.addPermission('LexInvoke', {
      principal: new ServicePrincipal('lexv2.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: testAliasArn,
    });

    new CfnOutput(this, 'BotId', { value: bot.attrId });
    new CfnOutput(this, 'BotAliasId', { value: TEST_ALIAS_ID });
    new CfnOutput(this, 'LocaleId', { value: LOCALE_ID });
    new CfnOutput(this, 'WorkerLogGroupName', { value: workerLogGroup.logGroupName });
  }
}
