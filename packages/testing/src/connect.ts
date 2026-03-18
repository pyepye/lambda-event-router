import type { ConnectContactFlowEvent, Context } from 'aws-lambda';
import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export type ConnectEventOverrides = DeepPartial<ConnectContactFlowEvent>;

export interface ConnectHandlerEvent {
  event: ConnectContactFlowEvent;
  context: Context;
}

export interface CreateConnectHandlerEventOptions {
  event?: ConnectEventOverrides;
  context?: Partial<Context>;
}

export function createConnectEvent(overrides: ConnectEventOverrides = {}): ConnectContactFlowEvent {
  const contactId = crypto.randomUUID();

  const defaults: ConnectContactFlowEvent = {
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
  connectEvent: (overrides?: ConnectEventOverrides) => ConnectContactFlowEvent;
  connectHandlerEvent: (options?: CreateConnectHandlerEventOptions) => ConnectHandlerEvent;
}

export const connectFixtures: FixtureMap<ConnectFixtures> = {
  connectEvent: fixture(createConnectEvent),
  connectHandlerEvent: fixture(createConnectHandlerEvent),
};
