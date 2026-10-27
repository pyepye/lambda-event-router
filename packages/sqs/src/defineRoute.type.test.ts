import { createMockSchema } from '@latcher/testing';

import { createSQSMatcher, defineRoute } from './SQSMatcher.js';
import type { SQSMessageAttributes, SQSMiddleware, SQSRequest } from './types.js';

const QUEUE_ARN = 'arn:aws:sqs:us-east-1:123456789012:orders';

interface DryRunAttributes {
  dryRun: boolean;
}

suite('coerced message attributes', () => {
  test('types an inferred handler with the attribute schema output', () => {
    const builder = defineRoute({
      filters: { eventSourceArn: QUEUE_ARN },
      messageAttributesSchema: createMockSchema<DryRunAttributes>(),
    });

    type Handler = Parameters<typeof builder.handle>[0];
    type Request = Parameters<Handler>[0];

    expectTypeOf<Request['messageAttributes']>().toEqualTypeOf<DryRunAttributes>();
  });

  test('keeps the converted attributes when a route has no attribute schema', () => {
    const builder = defineRoute({ filters: { eventSourceArn: QUEUE_ARN } });

    type Handler = Parameters<typeof builder.handle>[0];
    type Request = Parameters<Handler>[0];

    expectTypeOf<Request['messageAttributes']>().toEqualTypeOf<SQSMessageAttributes>();
  });

  test('types an inferred route() handler with the converted attributes when it has no attribute schema', () => {
    const matcher = createSQSMatcher().route({
      filters: { eventSourceArn: QUEUE_ARN },
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async ({ messageAttributes }): Promise<void> => {
        expectTypeOf(messageAttributes).toEqualTypeOf<SQSMessageAttributes>();
      },
    });

    expect(matcher).toBeDefined();
  });

  test('accepts an annotated handler for a coerced attribute schema', () => {
    async function processOrder({ messageAttributes }: SQSRequest<unknown, DryRunAttributes>): Promise<void> {
      expectTypeOf(messageAttributes.dryRun).toEqualTypeOf<boolean>();
    }

    const matcher = createSQSMatcher().route({
      filters: { eventSourceArn: QUEUE_ARN },
      messageAttributesSchema: createMockSchema<DryRunAttributes>(),
      handler: processOrder,
    });

    expect(matcher).toBeDefined();
  });

  test('accepts a route middleware typed to a coerced attribute schema', () => {
    type DryRunRequest = SQSRequest<unknown, DryRunAttributes>;

    async function skipDryRun(request: DryRunRequest, next: (request: unknown) => Promise<void>): Promise<void> {
      if (!request.messageAttributes.dryRun) await next(request);
    }

    const definition = defineRoute({
      filters: { eventSourceArn: QUEUE_ARN },
      messageAttributesSchema: createMockSchema<DryRunAttributes>(),
      middleware: [skipDryRun],
    }).handle(async () => {});

    expectTypeOf(skipDryRun).toMatchTypeOf<SQSMiddleware<unknown, DryRunAttributes>>();
    expect(definition.middleware).toEqual([skipDryRun]);
  });
});
