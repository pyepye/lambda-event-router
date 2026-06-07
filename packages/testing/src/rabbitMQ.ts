import type { Context } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

// RabbitMQ has no @types/aws-lambda types, so we define the event shapes locally

interface RabbitMQBasicProperties {
  contentType?: string;
  contentEncoding: string | null;
  headers: Record<string, unknown>;
  deliveryMode: number;
  priority: number;
  correlationId: string | null;
  replyTo: string | null;
  expiration: string;
  messageId: string | null;
  timestamp: string;
  type: string | null;
  userId: string;
  appId: string | null;
  clusterId: string | null;
  bodySize: number;
}

export interface RabbitMQMessage {
  basicProperties: RabbitMQBasicProperties;
  data: string;
  redelivered: boolean;
}

export interface RabbitMQEvent {
  eventSource: 'aws:rmq';
  eventSourceArn: string;
  rmqMessagesByQueue: Record<string, RabbitMQMessage[]>;
}

export interface RabbitMQHandlerEvent {
  event: RabbitMQEvent;
  context: Context;
}

export type RabbitMQMessageOverrides = Omit<DeepPartial<RabbitMQMessage>, 'data'> & {
  data?: string | Record<string, unknown>;
};

const defaultBody: string = JSON.stringify({ action: 'process', id: '123' });

export function createRabbitMQMessage(overrides: RabbitMQMessageOverrides = {}): RabbitMQMessage {
  const { data: dataOverride, ...restOverrides } = overrides;

  const dataString = typeof dataOverride === 'object' ? JSON.stringify(dataOverride) : dataOverride;
  const encodedData =
    dataString !== undefined ? Buffer.from(dataString).toString('base64') : Buffer.from(defaultBody).toString('base64');

  const defaults: RabbitMQMessage = {
    basicProperties: {
      contentType: 'application/json',
      contentEncoding: null,
      headers: {},
      deliveryMode: 1,
      priority: 0,
      correlationId: null,
      replyTo: null,
      expiration: '',
      messageId: null,
      timestamp: String(Date.now()),
      type: null,
      userId: 'guest',
      appId: null,
      clusterId: null,
      bodySize: defaultBody.length,
    },
    data: encodedData,
    redelivered: false,
  };

  return deepMerge(defaults, restOverrides);
}

export function createRabbitMQEvent(
  messagesByQueue: Record<string, RabbitMQMessage[]> = { 'test-queue::/test-vhost': [createRabbitMQMessage()] },
): RabbitMQEvent {
  return {
    eventSource: 'aws:rmq',
    eventSourceArn: 'arn:aws:mq:us-east-1:123456789012:broker:TestBroker:b-1234-5678',
    rmqMessagesByQueue: messagesByQueue,
  };
}

export interface CreateRabbitMQHandlerEventOptions {
  messagesByQueue?: Record<string, RabbitMQMessage[]>;
  context?: Partial<Context>;
}

export function createRabbitMQHandlerEvent(options: CreateRabbitMQHandlerEventOptions = {}): RabbitMQHandlerEvent {
  const event = createRabbitMQEvent(options.messagesByQueue);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface RabbitMQFixtures {
  rabbitMQMessage: (overrides?: RabbitMQMessageOverrides) => RabbitMQMessage;
  rabbitMQEvent: (messagesByQueue?: Record<string, RabbitMQMessage[]>) => RabbitMQEvent;
  rabbitMQHandlerEvent: (options?: CreateRabbitMQHandlerEventOptions) => RabbitMQHandlerEvent;
}

export const rabbitMQFixtures: FixtureMap<RabbitMQFixtures> = {
  rabbitMQMessage: fixture(createRabbitMQMessage),
  rabbitMQEvent: fixture(createRabbitMQEvent),
  rabbitMQHandlerEvent: fixture(createRabbitMQHandlerEvent),
};
