import type { ConnectContactFlowEvent, Context } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

// Connect delivers channels and initiation methods aws-lambda's unions do not carry, so the fixture
// widens both to the service model. They match the unions @lambda-event-router/connect exports, which
// cannot be imported here because that package dev-depends on this one.
type FixtureChannel = 'CHAT' | 'EMAIL' | 'TASK' | 'VOICE';

type FixtureInitiationMethod =
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

export type ConnectEventShape = Omit<ConnectContactFlowEvent, 'Details'> & {
  Details: Omit<ConnectContactFlowEvent['Details'], 'ContactData'> & {
    ContactData: Omit<ConnectContactFlowEvent['Details']['ContactData'], 'Channel' | 'InitiationMethod'> & {
      Channel: FixtureChannel;
      InitiationMethod: FixtureInitiationMethod;
    };
  };
};

export type ConnectEventOverrides = DeepPartial<ConnectEventShape>;

export interface ConnectHandlerEvent {
  event: ConnectEventShape;
  context: Context;
}

export interface CreateConnectHandlerEventOptions {
  event?: ConnectEventOverrides;
  context?: Partial<Context>;
}

export function createConnectEvent(overrides: ConnectEventOverrides = {}): ConnectEventShape {
  const contactId = crypto.randomUUID();

  const defaults: ConnectEventShape = {
    Name: 'ContactFlowEvent',
    Details: {
      ContactData: {
        Attributes: {},
        Channel: 'VOICE',
        ContactId: contactId,
        CustomerEndpoint: { Address: '+11234567890', Type: 'TELEPHONE_NUMBER' },
        InitialContactId: contactId,
        InitiationMethod: 'INBOUND',
        InstanceARN: 'arn:aws:connect:us-east-1:123456789012:instance/abc-def-123',
        PreviousContactId: contactId,
        Queue: {
          ARN: 'arn:aws:connect:us-east-1:123456789012:instance/abc-def-123/queue/queue-id',
          Name: 'BasicQueue',
        },
        SystemEndpoint: { Address: '+10987654321', Type: 'TELEPHONE_NUMBER' },
        MediaStreams: {
          Customer: {
            Audio: null,
          },
        },
      },
      Parameters: { action: 'getCustomerInfo' },
    },
  };

  return deepMerge(defaults, overrides);
}

export function createConnectHandlerEvent(options: CreateConnectHandlerEventOptions = {}): ConnectHandlerEvent {
  const event = createConnectEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface ConnectFixtures {
  connectEvent: (overrides?: ConnectEventOverrides) => ConnectEventShape;
  connectHandlerEvent: (options?: CreateConnectHandlerEventOptions) => ConnectHandlerEvent;
}

export const connectFixtures: FixtureMap<ConnectFixtures> = {
  connectEvent: fixture(createConnectEvent),
  connectHandlerEvent: fixture(createConnectHandlerEvent),
};
