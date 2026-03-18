import type { Context, LexV2Event } from 'aws-lambda';
import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export type LexEventOverrides = DeepPartial<LexV2Event>;

export interface LexHandlerEvent {
  event: LexV2Event;
  context: Context;
}

export interface CreateLexHandlerEventOptions {
  event?: LexEventOverrides;
  context?: Partial<Context>;
}

export function createLexEvent(overrides: LexEventOverrides = {}): LexV2Event {
  const defaultIntent: LexV2Event['sessionState']['intent'] = {
    name: 'OrderPizza',
    slots: {},
    state: 'InProgress',
    confirmationState: 'None',
  };

  const defaults: LexV2Event = {
    messageVersion: '1.0',
    invocationSource: 'DialogCodeHook',
    inputMode: 'Text',
    responseContentType: 'text/plain; charset=utf-8',
    sessionId: crypto.randomUUID(),
    inputTranscript: 'I want to order a pizza',
    bot: {
      id: 'TESTBOTID',
      name: 'PizzaBot',
      aliasId: 'TSTALIASID',
      aliasName: 'TestAlias',
      localeId: 'en_US',
      version: 'DRAFT',
    },
    interpretations: [
      {
        intent: defaultIntent,
        nluConfidence: 0.95,
      },
    ],
    proposedNextState: {
      dialogAction: { type: 'ElicitSlot', slotToElicit: 'PizzaSize' },
      intent: defaultIntent,
    },
    sessionState: {
      intent: defaultIntent,
      originatingRequestId: crypto.randomUUID(),
    },
    transcriptions: [
      {
        transcription: 'I want to order a pizza',
        transcriptionConfidence: 0.95,
        resolvedContext: { intent: 'OrderPizza' },
        resolvedSlots: {},
      },
    ],
  };

  return deepMerge(defaults, overrides);
}

export function createLexHandlerEvent(options: CreateLexHandlerEventOptions = {}): LexHandlerEvent {
  const event = createLexEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface LexFixtures {
  lexEvent: (overrides?: LexEventOverrides) => LexV2Event;
  lexHandlerEvent: (options?: CreateLexHandlerEventOptions) => LexHandlerEvent;
}

export const lexFixtures: FixtureMap<LexFixtures> = {
  lexEvent: fixture(createLexEvent),
  lexHandlerEvent: fixture(createLexHandlerEvent),
};
