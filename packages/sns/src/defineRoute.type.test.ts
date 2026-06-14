import { createMockSchema } from '@lambda-event-router/testing';

import { createSNSRouter, defineRoute, SNSRouter } from './SNSRouter.js';
import type { SNSMessageAttributes, SNSRequest } from './types.js';

const TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:orders';

interface Order {
  orderId: string;
  total: number;
}

interface OrderAttributes extends SNSMessageAttributes {
  eventType: string;
}

type OrderRequest = SNSRequest<Order, OrderAttributes & SNSMessageAttributes>;
type OrderNext = (request: OrderRequest) => Promise<void>;
type UntypedNext = (request: SNSRequest) => Promise<void>;

async function withOrderContext(request: OrderRequest, next: OrderNext): Promise<void> {
  expectTypeOf(request.body).toEqualTypeOf<Order>();
  await next(request);
}

async function logDelivery(request: SNSRequest, next: UntypedNext): Promise<void> {
  expectTypeOf(request.body).toEqualTypeOf<unknown>();
  await next(request);
}

suite('defineRoute type inference', () => {
  test('types the handler request from the body and attribute schemas', () => {
    const builder = defineRoute({
      filters: { topicArn: TOPIC_ARN },
      bodySchema: createMockSchema<Order>(),
      messageAttributesSchema: createMockSchema<OrderAttributes>(),
    });

    type Handler = Parameters<typeof builder.handle>[0];
    type Request = Parameters<Handler>[0];

    expectTypeOf<Request['body']>().toEqualTypeOf<Order>();
    expectTypeOf<Request['messageAttributes']['eventType']>().toEqualTypeOf<string>();
  });

  test('accepts a route middleware typed to the body and attribute schemas', () => {
    const definition = defineRoute({
      filters: { topicArn: TOPIC_ARN },
      bodySchema: createMockSchema<Order>(),
      messageAttributesSchema: createMockSchema<OrderAttributes>(),
      middleware: [withOrderContext],
    }).handle(async () => {});

    expect(definition.middleware).toEqual([withOrderContext]);
  });

  test('accepts an untyped route middleware on a route with no schemas', () => {
    const definition = defineRoute({
      filters: { topicArn: TOPIC_ARN },
      middleware: [logDelivery],
    }).handle(async () => {});

    expect(definition.middleware).toEqual([logDelivery]);
  });
});

suite('SNSFilters', () => {
  test('rejects a numeric messageAttributes matcher', () => {
    // SNS delivers every attribute to Lambda as String or Binary, so there is no number to match.
    const definition = defineRoute({
      // @ts-expect-error - a messageAttributes filter takes a string matcher, not a number
      filters: { topicArn: TOPIC_ARN, messageAttributes: { schemaVersion: 2 } },
    }).handle(async () => {});

    expect(definition.filters.messageAttributes).toEqual({ schemaVersion: 2 });
  });
});

suite('SNSRouterOptions', () => {
  test('has no batchItemFailures option', () => {
    // SNS has no partial batch response, so there is nothing for the option to report.
    // @ts-expect-error - batchItemFailures is not an SNS router option
    const router = createSNSRouter({ batchItemFailures: true });

    expect(router).toBeInstanceOf(SNSRouter);
  });
});
