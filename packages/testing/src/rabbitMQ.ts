import type { Context } from 'aws-lambda';
import { createMockContext } from './context.js';

// RabbitMQ has no @types/aws-lambda types, so we define the event shapes locally

interface RabbitMQBasicProperties {
  contentType: string;
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

export type RabbitMQMessageOverrides = Omit<Partial<RabbitMQMessage>, 'basicProperties'> & {
  basicProperties?: Partial<RabbitMQMessage['basicProperties']>;
};

const defaultBody: string = JSON.stringify({ action: 'process', id: '123' });

export function createRabbitMQMessage(overrides: RabbitMQMessageOverrides = {}): RabbitMQMessage {
  const { basicProperties, ...restOverrides } = overrides;

  return {
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
      ...basicProperties,
    },
    data: Buffer.from(defaultBody).toString('base64'),
    redelivered: false,
    ...restOverrides,
  };
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
