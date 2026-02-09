import type { Context, LexV2Event, LexV2Result } from 'aws-lambda';

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
  intentNames?: string[];
  invocationSources?: LexInvocationSource[];
  botIds?: string[];
  inputModes?: LexInputMode[];
  customFilter?: (input: LexFilterInput) => boolean;
}

export type LexDialogCodeHookFilters = Omit<LexFilters, 'invocationSources'>;

export type LexFulfillmentCodeHookFilters = Omit<LexFilters, 'invocationSources'>;

export interface LexRouteDefinition {
  filters: LexFilters;
  handler: LexHandler;
}

export interface LexDialogCodeHookRouteDefinition {
  filters: LexDialogCodeHookFilters;
  handler: LexDialogCodeHookHandler;
}

export interface LexFulfillmentCodeHookRouteDefinition {
  filters: LexFulfillmentCodeHookFilters;
  handler: LexFulfillmentCodeHookHandler;
}
