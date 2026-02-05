import type { ConnectContactFlowEvent, ConnectContactFlowResult } from 'aws-lambda';

export type AmazonConnectChannel = ConnectContactFlowEvent['Details']['ContactData']['Channel'];

export type AmazonConnectInitiationMethod = ConnectContactFlowEvent['Details']['ContactData']['InitiationMethod'];

export interface AmazonConnectRequest {
  contactData: ConnectContactFlowEvent['Details']['ContactData'];
  parameters: ConnectContactFlowEvent['Details']['Parameters'];
}

export type AmazonConnectResponse = ConnectContactFlowResult;

export type AmazonConnectHandler = (request: AmazonConnectRequest) => Promise<AmazonConnectResponse>;

export interface AmazonConnectFilterInput {
  channel: AmazonConnectChannel;
  initiationMethod: AmazonConnectInitiationMethod;
  event: ConnectContactFlowEvent;
}

export interface AmazonConnectFilters {
  channels?: AmazonConnectChannel[];
  initiationMethods?: AmazonConnectInitiationMethod[];
  instanceArns?: string[];
  customFilter?: (input: AmazonConnectFilterInput) => boolean;
}

export type AmazonConnectChannelFilters = Omit<AmazonConnectFilters, 'channels'>;

export type AmazonConnectInitiationMethodFilters = Omit<AmazonConnectFilters, 'initiationMethods'>;

export interface AmazonConnectRouteDefinition {
  filters: AmazonConnectFilters;
  handler: AmazonConnectHandler;
}

export interface AmazonConnectChannelRouteDefinition {
  filters: AmazonConnectChannelFilters;
  handler: AmazonConnectHandler;
}

export interface AmazonConnectInitiationMethodRouteDefinition {
  filters: AmazonConnectInitiationMethodFilters;
  handler: AmazonConnectHandler;
}
