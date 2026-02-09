import type { ConnectContactFlowEvent, ConnectContactFlowResult } from 'aws-lambda';

export type ConnectChannel = ConnectContactFlowEvent['Details']['ContactData']['Channel'];

export type ConnectInitiationMethod = ConnectContactFlowEvent['Details']['ContactData']['InitiationMethod'];

export interface ConnectRequest {
  contactData: ConnectContactFlowEvent['Details']['ContactData'];
  parameters: ConnectContactFlowEvent['Details']['Parameters'];
}

export type ConnectResponse = ConnectContactFlowResult;

export type ConnectHandler = (request: ConnectRequest) => Promise<ConnectResponse>;

export interface ConnectFilterInput {
  channel: ConnectChannel;
  initiationMethod: ConnectInitiationMethod;
  event: ConnectContactFlowEvent;
}

export interface ConnectFilters {
  channels?: ConnectChannel[];
  initiationMethods?: ConnectInitiationMethod[];
  instanceArns?: string[];
  customFilter?: (input: ConnectFilterInput) => boolean;
}

export type ConnectChannelFilters = Omit<ConnectFilters, 'channels'>;

export type ConnectInitiationMethodFilters = Omit<ConnectFilters, 'initiationMethods'>;

export interface ConnectRouteDefinition {
  filters: ConnectFilters;
  handler: ConnectHandler;
}

export interface ConnectChannelRouteDefinition {
  filters: ConnectChannelFilters;
  handler: ConnectHandler;
}

export interface ConnectInitiationMethodRouteDefinition {
  filters: ConnectInitiationMethodFilters;
  handler: ConnectHandler;
}
