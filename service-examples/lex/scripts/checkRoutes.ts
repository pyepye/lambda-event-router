import type { Context, LexV2Event, LexV2Slots } from 'aws-lambda';

import type { Expected, RouterStep } from '../src/conversation/steps.js';
import { DEPLOYED_BOT_ID, routerSteps } from '../src/conversation/steps.js';
import { LOCALE_ID, TRACKING_NUMBER_SLOT } from '../src/utils/constants.js';

// The botId filter is read from the environment when the router module loads, so the value has to be
// in place before the import runs.
process.env.BOT_ID = DEPLOYED_BOT_ID;
const { lexRouter } = await import('../src/lex.js');

const ACCOUNT = '123456789012';
const REGION = 'eu-west-2';

const context = {
  functionName: 'ler-example-lex-worker',
  awsRequestId: 'check-routes',
  invokedFunctionArn: `arn:aws:lambda:${REGION}:${ACCOUNT}:function:ler-example-lex-worker`,
  getRemainingTimeInMillis: () => 10_000,
} as unknown as Context;

// The delivered event, copied field for field. Lex sends the resolved intent twice: once under
// interpretations and once under sessionState, and a filled slot carries both the raw and the
// interpreted value.
function buildEvent(step: RouterStep): LexV2Event {
  const slots: LexV2Slots = step.trackingNumber
    ? {
        [TRACKING_NUMBER_SLOT]: {
          shape: 'Scalar',
          value: {
            originalValue: step.trackingNumber,
            interpretedValue: step.trackingNumber,
            resolvedValues: [step.trackingNumber],
          },
        },
      }
    : { [TRACKING_NUMBER_SLOT]: null };

  const intent = {
    name: step.intentName,
    slots,
    state: 'InProgress' as const,
    confirmationState: 'None' as const,
  };

  return {
    messageVersion: '1.0',
    invocationSource: step.invocationSource,
    inputMode: step.inputMode ?? 'Text',
    responseContentType: 'text/plain; charset=utf-8',
    sessionId: 'check-routes',
    inputTranscript: step.name,
    bot: {
      id: step.botId ?? DEPLOYED_BOT_ID,
      name: 'ParcelSupport',
      aliasId: 'TSTALIASID',
      aliasName: 'TestBotAlias',
      localeId: LOCALE_ID,
      version: 'DRAFT',
    },
    interpretations: [{ intent, nluConfidence: 0.95 }],
    proposedNextState: { dialogAction: { type: 'Delegate' }, intent },
    sessionState: {
      intent,
      originatingRequestId: 'check-routes',
      sessionAttributes: step.sessionAttributes ?? {},
    },
    transcriptions: [
      {
        transcription: step.name,
        transcriptionConfidence: 0.95,
        resolvedContext: { intent: step.intentName },
        resolvedSlots: slots,
      },
    ],
  };
}

function problemsWith(result: unknown, error: unknown, expected: Expected): string[] {
  const problems: string[] = [];

  if (error !== undefined) {
    const message = error instanceof Error ? error.message : String(error);
    if (!expected.errorIncludes) return [`threw ${message}`];
    if (!message.includes(expected.errorIncludes)) problems.push(`threw ${message}`);
    return problems;
  }

  const serialised = JSON.stringify(result) ?? 'undefined';

  if (expected.errorIncludes) return [`returned ${serialised.slice(0, 200)} instead of throwing`];
  for (const fragment of expected.resultIncludes ?? []) {
    if (!serialised.includes(fragment)) problems.push(`returned ${serialised.slice(0, 200)}`);
  }

  return problems;
}

const failures: string[] = [];

function report(label: string, problems: string[]): void {
  if (problems.length === 0) {
    console.log(`ok   ${label}`);
    return;
  }
  failures.push(label);
  console.log(`FAIL ${label}: ${problems.join(', ')}`);
}

for (const step of routerSteps) {
  const event = buildEvent(step);
  try {
    report(step.name, problemsWith(await lexRouter.handleEvent(event, context), undefined, step.expected));
  } catch (error) {
    report(step.name, problemsWith(undefined, error, step.expected));
  }
}

const claims: [string, boolean][] = [
  ['the router takes a Lex turn', lexRouter.canHandleEvent(buildEvent(routerSteps[0] as RouterStep))],
  ['the router turns a plain object away', !lexRouter.canHandleEvent({ detail: {} })],
  ['the router turns an SQS event away', !lexRouter.canHandleEvent({ Records: [] })],
];

for (const [label, held] of claims) {
  report(label, held ? [] : ['did not hold']);
}

console.log(
  failures.length === 0 ? '\nEvery turn landed where it was meant to.' : `\n${failures.length} step(s) failed.`,
);

if (failures.length > 0) process.exitCode = 1;
