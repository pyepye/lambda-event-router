import { createMockSchema } from '@latcher/testing';

import { createSNSMatcher, defineRoute, SNSMatcher } from './SNSMatcher.js';
import type { SNSMessageAttributes, SNSMiddleware, SNSRequest } from './types.js';

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

interface DryRunAttributes {
  dryRun: boolean;
}

suite('coerced message attributes', () => {
  test('types an inferred handler with the attribute schema output', () => {
    const builder = defineRoute({
      filters: { topicArn: TOPIC_ARN },
      messageAttributesSchema: createMockSchema<DryRunAttributes>(),
    });

    type Handler = Parameters<typeof builder.handle>[0];
    type Request = Parameters<Handler>[0];

    expectTypeOf<Request['messageAttributes']>().toEqualTypeOf<DryRunAttributes>();
  });

  test('keeps the converted attributes when a route has no attribute schema', () => {
    const builder = defineRoute({ filters: { topicArn: TOPIC_ARN } });

    type Handler = Parameters<typeof builder.handle>[0];
    type Request = Parameters<Handler>[0];

    expectTypeOf<Request['messageAttributes']>().toEqualTypeOf<SNSMessageAttributes>();
  });

  test('types an inferred route() handler with the converted attributes when it has no attribute schema', () => {
    const matcher = createSNSMatcher().route({
      filters: { topicArn: TOPIC_ARN },
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async ({ messageAttributes }): Promise<void> => {
        expectTypeOf(messageAttributes).toEqualTypeOf<SNSMessageAttributes>();
      },
    });

    expect(matcher).toBeDefined();
  });

  test('accepts an annotated handler for a coerced attribute schema', () => {
    async function processNotification({ messageAttributes }: SNSRequest<unknown, DryRunAttributes>): Promise<void> {
      expectTypeOf(messageAttributes.dryRun).toEqualTypeOf<boolean>();
    }

    const matcher = createSNSMatcher().route({
      filters: { topicArn: TOPIC_ARN },
      messageAttributesSchema: createMockSchema<DryRunAttributes>(),
      handler: processNotification,
    });

    expect(matcher).toBeInstanceOf(SNSMatcher);
  });

  test('accepts a route middleware typed to a coerced attribute schema', () => {
    type DryRunRequest = SNSRequest<unknown, DryRunAttributes>;

    async function skipDryRun(request: DryRunRequest, next: (request: unknown) => Promise<void>): Promise<void> {
      if (!request.messageAttributes.dryRun) await next(request);
    }

    const definition = defineRoute({
      filters: { topicArn: TOPIC_ARN },
      messageAttributesSchema: createMockSchema<DryRunAttributes>(),
      middleware: [skipDryRun],
    }).handle(async () => {});

    expectTypeOf(skipDryRun).toMatchTypeOf<SNSMiddleware<unknown, DryRunAttributes>>();
    expect(definition.middleware).toEqual([skipDryRun]);
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

suite('SNSMatcherOptions', () => {
  test('has no batchItemFailures option', () => {
    // SNS has no partial batch response, so there is nothing for the option to report.
    // @ts-expect-error - batchItemFailures is not an SNS matcher option
    const matcher = createSNSMatcher({ batchItemFailures: true });

    expect(matcher).toBeInstanceOf(SNSMatcher);
  });
});
