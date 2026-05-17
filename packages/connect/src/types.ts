import type { ConnectContactFlowEvent, ConnectContactFlowResult, Context } from 'aws-lambda';

import type { FilterStringMatcher, Middleware } from '@lambda-event-router/base';

export type ConnectChannel = ConnectContactFlowEvent['Details']['ContactData']['Channel'];

export type ConnectInitiationMethod = ConnectContactFlowEvent['Details']['ContactData']['InitiationMethod'];

export interface ConnectRequest {
  contactData: ConnectContactFlowEvent['Details']['ContactData'];
  parameters: ConnectContactFlowEvent['Details']['Parameters'];
  event: ConnectContactFlowEvent;
  context: Context;
}

export type ConnectResponse = ConnectContactFlowResult;

export type ConnectMiddleware = Middleware<ConnectRequest, ConnectResponse>;

export type ConnectHandler = (request: ConnectRequest) => Promise<ConnectResponse>;

export interface ConnectFilterInput {
  channel: ConnectChannel;
  initiationMethod: ConnectInitiationMethod;
  event: ConnectContactFlowEvent;
}

export interface ConnectFilters {
  channel?: ConnectChannel | ConnectChannel[];
  initiationMethod?: ConnectInitiationMethod | ConnectInitiationMethod[];
  instanceArn?: FilterStringMatcher;
  customFilter?: (input: ConnectFilterInput) => boolean | Promise<boolean>;
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
