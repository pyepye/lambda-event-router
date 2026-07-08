import type { ConnectContactFlowEvent, ConnectContactFlowResult, Context } from 'aws-lambda';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

// The Connect service model, not the narrower unions aws-lambda carries. A contact can arrive on any
// of these, so a filter has to be able to name them.
export type ConnectChannel = 'CHAT' | 'EMAIL' | 'TASK' | 'VOICE';

export type ConnectInitiationMethod =
  | 'AGENT_REPLY'
  | 'API'
  | 'CALLBACK'
  | 'DISCONNECT'
  | 'EXTERNAL_OUTBOUND'
  | 'FLOW'
  | 'INBOUND'
  | 'MONITOR'
  | 'OUTBOUND'
  | 'QUEUE_TRANSFER'
  | 'TRANSFER'
  | 'WEBRTC_API';

export type ConnectContactData = Omit<
  ConnectContactFlowEvent['Details']['ContactData'],
  'Channel' | 'InitiationMethod'
> & {
  Channel: ConnectChannel;
  InitiationMethod: ConnectInitiationMethod;
};

export type ConnectEvent = Omit<ConnectContactFlowEvent, 'Details'> & {
  Details: Omit<ConnectContactFlowEvent['Details'], 'ContactData'> & {
    ContactData: ConnectContactData;
  };
};

export interface ConnectRequest {
  contactData: ConnectContactData;
  parameters: ConnectEvent['Details']['Parameters'];
  event: ConnectEvent;
  context: Context;
}

export type ConnectResponse = ConnectContactFlowResult;

export type ConnectMiddleware = Middleware<ConnectRequest, ConnectResponse>;

export type ConnectHandler = (request: ConnectRequest) => Promise<ConnectResponse>;

export interface ConnectFilterInput {
  channel: ConnectChannel;
  initiationMethod: ConnectInitiationMethod;
  event: ConnectEvent;
}

export interface ConnectFilters {
  channel?: ConnectChannel | ConnectChannel[];
  initiationMethod?: ConnectInitiationMethod | ConnectInitiationMethod[];
  instanceArn?: FilterStringMatcher;
  custom?: (input: ConnectFilterInput) => boolean | Promise<boolean>;
}

export type ConnectChannelFilters = Omit<ConnectFilters, 'channel'>;

export type ConnectInitiationMethodFilters = Omit<ConnectFilters, 'initiationMethod'>;

export interface ConnectRouteDefinition {
  filters: ConnectFilters;
  middleware?: ConnectMiddleware[];
  handler: ConnectHandler;
}

export interface ConnectChannelRouteDefinition {
  filters: ConnectChannelFilters;
  middleware?: ConnectMiddleware[];
  handler: ConnectHandler;
}

export interface ConnectInitiationMethodRouteDefinition {
  filters: ConnectInitiationMethodFilters;
  middleware?: ConnectMiddleware[];
  handler: ConnectHandler;
}

export interface ConnectRouterOptions {
  middleware?: ConnectMiddleware[];
}
