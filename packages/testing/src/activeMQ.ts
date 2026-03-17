import type { Context } from 'aws-lambda';
import { createMockContext } from './context.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

// ActiveMQ has no @types/aws-lambda types, so we define the event shapes locally

type ActiveMQMessageType = 'jms/text-message' | 'jms/bytes-message';

interface ActiveMQDestination {
  physicalName: string;
}

export interface ActiveMQMessage {
  messageID: string;
  messageType: ActiveMQMessageType;
  timestamp: number;
  deliveryMode: number;
  correlationID: string;
  replyTo: string | null;
  destination: ActiveMQDestination;
  redelivered: boolean;
  type: string;
  expiration: number;
  priority: number;
  data: string;
  brokerInTime: number;
  brokerOutTime: number;
  properties: Record<string, unknown>;
}

export interface ActiveMQEvent {
  eventSource: 'aws:mq';
  eventSourceArn: string;
  messages: ActiveMQMessage[];
}

export interface ActiveMQHandlerEvent {
  event: ActiveMQEvent;
  context: Context;
}

export type ActiveMQMessageOverrides = Omit<Partial<ActiveMQMessage>, 'destination'> & {
  destination?: Partial<ActiveMQMessage['destination']>;
};

const defaultBody: string = JSON.stringify({ action: 'process', id: '123' });

export function createActiveMQMessage(overrides: ActiveMQMessageOverrides = {}): ActiveMQMessage {
  const { destination, ...restOverrides } = overrides;
  const now = Date.now();

  return {
    messageID: crypto.randomUUID(),
    messageType: 'jms/text-message',
    timestamp: now,
    deliveryMode: 1,
    correlationID: crypto.randomUUID(),
    replyTo: null,
    destination: {
      physicalName: 'test-queue',
      ...destination,
    },
    redelivered: false,
    type: '',
    expiration: 0,
    priority: 4,
    data: Buffer.from(defaultBody).toString('base64'),
    brokerInTime: now,
    brokerOutTime: now + 1,
    properties: {},
    ...restOverrides,
  };
}

export function createActiveMQEvent(messages: ActiveMQMessage[] = [createActiveMQMessage()]): ActiveMQEvent {
  return {
    eventSource: 'aws:mq',
    eventSourceArn: 'arn:aws:mq:us-east-1:123456789012:broker:TestBroker:b-1234-5678',
    messages,
  };
}

export interface CreateActiveMQHandlerEventOptions {
  messages?: ActiveMQMessage[];
  context?: Partial<Context>;
}

export function createActiveMQHandlerEvent(options: CreateActiveMQHandlerEventOptions = {}): ActiveMQHandlerEvent {
  const event = createActiveMQEvent(options.messages);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface ActiveMQFixtures {
  activeMQMessage: (overrides?: ActiveMQMessageOverrides) => ActiveMQMessage;
  activeMQEvent: (messages?: ActiveMQMessage[]) => ActiveMQEvent;
  activeMQHandlerEvent: (options?: CreateActiveMQHandlerEventOptions) => ActiveMQHandlerEvent;
}

export const activeMQFixtures: FixtureMap<ActiveMQFixtures> = {
  activeMQMessage: fixture(createActiveMQMessage),
  activeMQEvent: fixture(createActiveMQEvent),
  activeMQHandlerEvent: fixture(createActiveMQHandlerEvent),
};
