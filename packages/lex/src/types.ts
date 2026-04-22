import type { Context, LexV2Event, LexV2Result } from 'aws-lambda';

import type { Middleware } from '@lambda-event-router/base';

export type LexInvocationSource = LexV2Event['invocationSource'];

export type LexInputMode = LexV2Event['inputMode'];

interface LexRequestBase {
  intentName: string;
  slots: LexV2Event['sessionState']['intent']['slots'];
  sessionAttributes: Record<string, string>;
  inputTranscript: string;
  bot: LexV2Event['bot'];
  event: LexV2Event;
  context: Context;
}

export interface LexDialogCodeHookRequest extends LexRequestBase {
  invocationSource: 'DialogCodeHook';
}

export interface LexFulfillmentCodeHookRequest extends LexRequestBase {
  invocationSource: 'FulfillmentCodeHook';
}

export type LexRequest = LexDialogCodeHookRequest | LexFulfillmentCodeHookRequest;

export type LexResponse = LexV2Result;

export type LexHandler = (request: LexRequest) => Promise<LexResponse>;

export type LexDialogCodeHookHandler = (request: LexDialogCodeHookRequest) => Promise<LexResponse>;

export type LexFulfillmentCodeHookHandler = (request: LexFulfillmentCodeHookRequest) => Promise<LexResponse>;

export interface LexFilterInput {
  intentName: string;
  invocationSource: LexInvocationSource;
  inputMode: LexInputMode;
  botId: string;
  event: LexV2Event;
}

export interface LexFilters {
  intentName?: string | string[];
  invocationSource?: LexInvocationSource | LexInvocationSource[];
  botId?: string | string[];
  inputMode?: LexInputMode | LexInputMode[];
  customFilter?: (input: LexFilterInput) => boolean | Promise<boolean>;
}

export type LexDialogCodeHookFilters = Omit<LexFilters, 'invocationSources'>;

export type LexFulfillmentCodeHookFilters = Omit<LexFilters, 'invocationSources'>;

export type LexMiddleware = Middleware<LexRequest, LexResponse>;

export interface LexRouteDefinition {
  filters: LexFilters;
  middleware?: LexMiddleware[];
  handler: LexHandler;
}

export interface LexDialogCodeHookRouteDefinition {
  filters: LexDialogCodeHookFilters;
  middleware?: LexMiddleware[];
  handler: LexDialogCodeHookHandler;
}

export interface LexFulfillmentCodeHookRouteDefinition {
  filters: LexFulfillmentCodeHookFilters;
  middleware?: LexMiddleware[];
  handler: LexFulfillmentCodeHookHandler;
}

export interface LexRouterOptions {
  middleware?: LexMiddleware[];
}
