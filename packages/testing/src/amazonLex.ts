import type { Context, LexV2Event } from 'aws-lambda';
import { createMockContext } from './context.js';

export interface AmazonLexEventOverrides {
  messageVersion?: string;
  invocationSource?: LexV2Event['invocationSource'];
  inputMode?: LexV2Event['inputMode'];
  inputTranscript?: string;
  sessionId?: string;
  responseContentType?: string;
  bot?: Partial<LexV2Event['bot']>;
  sessionState?: {
    intent?: Partial<LexV2Event['sessionState']['intent']>;
    sessionAttributes?: LexV2Event['sessionState']['sessionAttributes'];
    dialogAction?: LexV2Event['sessionState']['dialogAction'];
    activeContexts?: LexV2Event['sessionState']['activeContexts'];
    originatingRequestId?: string;
  };
  requestAttributes?: LexV2Event['requestAttributes'];
  interpretations?: LexV2Event['interpretations'];
  transcriptions?: LexV2Event['transcriptions'];
}

export interface AmazonLexHandlerEvent {
  event: LexV2Event;
  context: Context;
}

export interface CreateAmazonLexHandlerEventOptions {
  event?: AmazonLexEventOverrides;
  context?: Partial<Context>;
}

export function createAmazonLexEvent(overrides: AmazonLexEventOverrides = {}): LexV2Event {
  const intentName = overrides.sessionState?.intent?.name ?? 'OrderPizza';
  const intentSlots = overrides.sessionState?.intent?.slots ?? {};
  const intentState = overrides.sessionState?.intent?.state ?? 'InProgress';
  const confirmationState = overrides.sessionState?.intent?.confirmationState ?? 'None';
  const originatingRequestId = overrides.sessionState?.originatingRequestId ?? crypto.randomUUID();

  const intent = {
    name: intentName,
    slots: intentSlots,
    state: intentState,
    confirmationState,
    ...overrides.sessionState?.intent,
  };

  return {
    messageVersion: overrides.messageVersion ?? '1.0',
    invocationSource: overrides.invocationSource ?? 'DialogCodeHook',
    inputMode: overrides.inputMode ?? 'Text',
    responseContentType: overrides.responseContentType ?? 'text/plain; charset=utf-8',
    sessionId: overrides.sessionId ?? crypto.randomUUID(),
    inputTranscript: overrides.inputTranscript ?? 'I want to order a pizza',
    bot: {
      id: 'TESTBOTID',
      name: 'PizzaBot',
      aliasId: 'TSTALIASID',
      aliasName: 'TestAlias',
      localeId: 'en_US',
      version: 'DRAFT',
      ...overrides.bot,
    },
    interpretations: overrides.interpretations ?? [
      {
        intent,
        nluConfidence: 0.95,
      },
    ],
    proposedNextState: {
      dialogAction: { type: 'ElicitSlot', slotToElicit: 'PizzaSize' },
      intent,
    },
    sessionState: {
      intent,
      originatingRequestId,
      sessionAttributes: overrides.sessionState?.sessionAttributes,
      dialogAction: overrides.sessionState?.dialogAction,
      activeContexts: overrides.sessionState?.activeContexts,
    },
    transcriptions: overrides.transcriptions ?? [
      {
        transcription: overrides.inputTranscript ?? 'I want to order a pizza',
        transcriptionConfidence: 0.95,
        resolvedContext: { intent: intentName },
        resolvedSlots: intentSlots,
      },
    ],
    requestAttributes: overrides.requestAttributes,
  };
}

export function createAmazonLexHandlerEvent(options: CreateAmazonLexHandlerEventOptions = {}): AmazonLexHandlerEvent {
  const event = createAmazonLexEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}
