import type { ConnectContactFlowEvent, Context } from 'aws-lambda';
import { createMockContext } from './context.js';

export interface ConnectEventOverrides {
  Name?: ConnectContactFlowEvent['Name'];
  Details?: {
    ContactData?: Partial<ConnectContactFlowEvent['Details']['ContactData']>;
    Parameters?: ConnectContactFlowEvent['Details']['Parameters'];
  };
}

export interface ConnectHandlerEvent {
  event: ConnectContactFlowEvent;
  context: Context;
}

export interface CreateConnectHandlerEventOptions {
  event?: ConnectEventOverrides;
  context?: Partial<Context>;
}

export function createConnectEvent(overrides: ConnectEventOverrides = {}): ConnectContactFlowEvent {
  const contactDataOverrides = overrides.Details?.ContactData;
  const contactId = crypto.randomUUID();

  return {
    Name: overrides.Name ?? 'ContactFlowEvent',
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
        ...contactDataOverrides,
      },
      Parameters: overrides.Details?.Parameters ?? { action: 'getCustomerInfo' },
    },
  };
}

export function createConnectHandlerEvent(options: CreateConnectHandlerEventOptions = {}): ConnectHandlerEvent {
  const event = createConnectEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}
