import type { Context, LexV2Event, LexV2Result } from 'aws-lambda';

export type AmazonLexInvocationSource = LexV2Event['invocationSource'];

export type AmazonLexInputMode = LexV2Event['inputMode'];

interface AmazonLexRequestBase {
  intentName: string;
  slots: LexV2Event['sessionState']['intent']['slots'];
  sessionAttributes: Record<string, string>;
  inputTranscript: string;
  bot: LexV2Event['bot'];
  event: LexV2Event;
  context: Context;
}

export interface AmazonLexDialogCodeHookRequest extends AmazonLexRequestBase {
  invocationSource: 'DialogCodeHook';
}

export interface AmazonLexFulfillmentCodeHookRequest extends AmazonLexRequestBase {
  invocationSource: 'FulfillmentCodeHook';
}

export type AmazonLexRequest = AmazonLexDialogCodeHookRequest | AmazonLexFulfillmentCodeHookRequest;

export type AmazonLexResponse = LexV2Result;

export type AmazonLexHandler = (request: AmazonLexRequest) => Promise<AmazonLexResponse>;

export type AmazonLexDialogCodeHookHandler = (request: AmazonLexDialogCodeHookRequest) => Promise<AmazonLexResponse>;

export type AmazonLexFulfillmentCodeHookHandler = (
  request: AmazonLexFulfillmentCodeHookRequest,
) => Promise<AmazonLexResponse>;

export interface AmazonLexFilterInput {
  intentName: string;
  invocationSource: AmazonLexInvocationSource;
  inputMode: AmazonLexInputMode;
  botId: string;
  event: LexV2Event;
}

export interface AmazonLexFilters {
  intentNames?: string[];
  invocationSources?: AmazonLexInvocationSource[];
  botIds?: string[];
  inputModes?: AmazonLexInputMode[];
  customFilter?: (input: AmazonLexFilterInput) => boolean;
}

export type AmazonLexDialogCodeHookFilters = Omit<AmazonLexFilters, 'invocationSources'>;

export type AmazonLexFulfillmentCodeHookFilters = Omit<AmazonLexFilters, 'invocationSources'>;

export interface AmazonLexRouteDefinition {
  filters: AmazonLexFilters;
  handler: AmazonLexHandler;
}

export interface AmazonLexDialogCodeHookRouteDefinition {
  filters: AmazonLexDialogCodeHookFilters;
  handler: AmazonLexDialogCodeHookHandler;
}

export interface AmazonLexFulfillmentCodeHookRouteDefinition {
  filters: AmazonLexFulfillmentCodeHookFilters;
  handler: AmazonLexFulfillmentCodeHookHandler;
}
