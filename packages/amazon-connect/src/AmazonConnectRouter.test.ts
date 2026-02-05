import { createAmazonConnectEvent, test } from '@lambda-event-router/testing';
import { AmazonConnectRouter, createAmazonConnectRouter, defineRoute } from './AmazonConnectRouter.js';

suite('createAmazonConnectRouter', () => {
  test('returns an AmazonConnectRouter instance', () => {
    const router = createAmazonConnectRouter();

    expect(router).toBeInstanceOf(AmazonConnectRouter);
  });
});

suite('canHandleEvent', () => {
  const router = createAmazonConnectRouter();

  test('returns true for a valid ConnectContactFlowEvent', ({ amazonConnectEvent }) => {
    const event = amazonConnectEvent();

    const result = router.canHandleEvent(event);

    expect(result).toBe(true);
  });

  test('returns false when Name is not ContactFlowEvent', ({ amazonConnectEvent }) => {
    const event = amazonConnectEvent();
    // @ts-expect-error - testing invalid event
    event.Name = 'SomeOtherEvent';

    const result = router.canHandleEvent(event);

    expect(result).toBe(false);
  });

  test('returns false for non-object events', () => {
    expect(router.canHandleEvent(null)).toBe(false);
    expect(router.canHandleEvent('string')).toBe(false);
  });

  test('returns false when Details is missing', () => {
    const event = { Name: 'ContactFlowEvent' };

    const result = router.canHandleEvent(event);

    expect(result).toBe(false);
  });

  test('returns false when Details.ContactData is missing', () => {
    const event = { Name: 'ContactFlowEvent', Details: { Parameters: {} } };

    const result = router.canHandleEvent(event);

    expect(result).toBe(false);
  });
});

suite('defineRoute', () => {
  test('creates a route definition with filters and handler', () => {
    const handler = vi.fn();

    const definition = defineRoute({ filters: { channels: ['VOICE'] } }).handle(handler);

    expect(definition).toEqual({
      filters: { channels: ['VOICE'] },
      handler,
    });
  });

  test('preserves filter configuration', () => {
    const handler = vi.fn();
    const customFilter = vi.fn();

    const definition = defineRoute({
      filters: {
        channels: ['CHAT'],
        initiationMethods: ['INBOUND'],
        instanceArns: ['arn:aws:connect:us-east-1:123456789012:instance/abc'],
        customFilter,
      },
    }).handle(handler);

    expect(definition.filters).toEqual({
      channels: ['CHAT'],
      initiationMethods: ['INBOUND'],
      instanceArns: ['arn:aws:connect:us-east-1:123456789012:instance/abc'],
      customFilter,
    });
  });
});

suite('route', () => {
  test('returns this for chaining', () => {
    const router = createAmazonConnectRouter();
    const handler = vi.fn();

    const result = router.route({ filters: { channels: ['VOICE'] }, handler });

    expect(result).toBe(router);
  });
});

suite('matchRoute', () => {
  test('matches when channel is in the channels filter', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const handler = vi.fn();
    router.route({ filters: { channels: ['VOICE'] }, handler });
    const event = amazonConnectEvent({ Details: { ContactData: { Channel: 'VOICE' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when channel is not in the channels filter', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    router.route({ filters: { channels: ['CHAT'] }, handler: vi.fn() });
    const event = amazonConnectEvent({ Details: { ContactData: { Channel: 'VOICE' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when initiation method is in the initiationMethods filter', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const handler = vi.fn();
    router.route({ filters: { initiationMethods: ['INBOUND'] }, handler });
    const event = amazonConnectEvent({ Details: { ContactData: { InitiationMethod: 'INBOUND' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when initiation method is not in the initiationMethods filter', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    router.route({ filters: { initiationMethods: ['OUTBOUND'] }, handler: vi.fn() });
    const event = amazonConnectEvent({ Details: { ContactData: { InitiationMethod: 'INBOUND' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when instance ARN is in the instanceArns filter', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const instanceArn = 'arn:aws:connect:us-east-1:123456789012:instance/abc-def-123';
    const handler = vi.fn();
    router.route({ filters: { instanceArns: [instanceArn] }, handler });
    const event = amazonConnectEvent({ Details: { ContactData: { InstanceARN: instanceArn } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when instance ARN is not in the instanceArns filter', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    router.route({
      filters: { instanceArns: ['arn:aws:connect:us-east-1:123456789012:instance/other'] },
      handler: vi.fn(),
    });
    const event = amazonConnectEvent({
      Details: { ContactData: { InstanceARN: 'arn:aws:connect:us-east-1:123456789012:instance/abc-def-123' } },
    });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when a single filter has multiple allowed values', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const handler = vi.fn();
    router.route({ filters: { channels: ['VOICE', 'CHAT'] }, handler });
    const event = amazonConnectEvent({ Details: { ContactData: { Channel: 'CHAT' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('matches when all combined filters match', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const instanceArn = 'arn:aws:connect:us-east-1:123456789012:instance/abc-def-123';
    const handler = vi.fn();
    router.route({
      filters: { channels: ['VOICE'], initiationMethods: ['INBOUND'], instanceArns: [instanceArn] },
      handler,
    });
    const event = amazonConnectEvent({
      Details: { ContactData: { Channel: 'VOICE', InitiationMethod: 'INBOUND', InstanceARN: instanceArn } },
    });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when combined filters partially match', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    router.route({
      filters: { channels: ['VOICE'], initiationMethods: ['OUTBOUND'] },
      handler: vi.fn(),
    });
    const event = amazonConnectEvent({
      Details: { ContactData: { Channel: 'VOICE', InitiationMethod: 'INBOUND' } },
    });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('matches when custom filter returns true', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const handler = vi.fn();
    router.route({ filters: { customFilter: () => true }, handler });
    const event = amazonConnectEvent();

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('does not match when custom filter returns false', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    router.route({ filters: { customFilter: () => false }, handler: vi.fn() });
    const event = amazonConnectEvent();

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeUndefined();
  });

  test('custom filter receives correct input', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const customFilter = vi.fn().mockReturnValue(true);
    router.route({ filters: { customFilter }, handler: vi.fn() });
    const event = amazonConnectEvent({
      Details: { ContactData: { Channel: 'CHAT', InitiationMethod: 'TRANSFER' } },
    });

    // @ts-expect-error - testing private method
    router.matchRoute(event);

    expect(customFilter).toHaveBeenCalledWith({
      channel: 'CHAT',
      initiationMethod: 'TRANSFER',
      event,
    });
  });

  test('matches any event when filters are empty (catch-all)', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const handler = vi.fn();
    router.route({ filters: {}, handler });
    const event = amazonConnectEvent();

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('first match wins when multiple routes match', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    router.route({ filters: { channels: ['VOICE'] }, handler: firstHandler });
    router.route({ filters: { channels: ['VOICE'] }, handler: secondHandler });
    const event = amazonConnectEvent({ Details: { ContactData: { Channel: 'VOICE' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result?.handler).toBe(firstHandler);
  });
});

suite('channel convenience methods', () => {
  test('returns this for chaining', () => {
    const router = createAmazonConnectRouter();
    const handler = vi.fn();

    const result = router.voice({ filters: {}, handler });

    expect(result).toBe(router);
  });

  test('voice sets the VOICE channel filter', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const handler = vi.fn();
    router.voice({ filters: {}, handler });
    const event = amazonConnectEvent({ Details: { ContactData: { Channel: 'VOICE' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('chat sets the CHAT channel filter', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const handler = vi.fn();
    router.chat({ filters: {}, handler });
    const event = amazonConnectEvent({ Details: { ContactData: { Channel: 'CHAT' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('email sets the EMAIL channel filter', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const handler = vi.fn();
    router.email({ filters: {}, handler });
    const event = amazonConnectEvent({ Details: { ContactData: { Channel: 'EMAIL' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });
});

suite('initiation method convenience methods', () => {
  test('inbound sets the INBOUND initiation method filter', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const handler = vi.fn();
    router.inbound({ filters: {}, handler });
    const event = amazonConnectEvent({ Details: { ContactData: { InitiationMethod: 'INBOUND' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('outbound sets the OUTBOUND initiation method filter', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const handler = vi.fn();
    router.outbound({ filters: {}, handler });
    const event = amazonConnectEvent({ Details: { ContactData: { InitiationMethod: 'OUTBOUND' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('transfer sets the TRANSFER initiation method filter', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const handler = vi.fn();
    router.transfer({ filters: {}, handler });
    const event = amazonConnectEvent({ Details: { ContactData: { InitiationMethod: 'TRANSFER' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('callback sets the CALLBACK initiation method filter', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const handler = vi.fn();
    router.callback({ filters: {}, handler });
    const event = amazonConnectEvent({ Details: { ContactData: { InitiationMethod: 'CALLBACK' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });

  test('api sets the API initiation method filter', ({ amazonConnectEvent }) => {
    const router = createAmazonConnectRouter();
    const handler = vi.fn();
    router.api({ filters: {}, handler });
    const event = amazonConnectEvent({ Details: { ContactData: { InitiationMethod: 'API' } } });

    // @ts-expect-error - testing private method
    const result = router.matchRoute(event);

    expect(result).toBeDefined();
    expect(result?.handler).toBe(handler);
  });
});

suite('handleEvent', () => {
  test('matched route handler receives correct AmazonConnectRequest', async ({ amazonConnectHandlerEvent }) => {
    const router = createAmazonConnectRouter();
    const handler = vi.fn().mockResolvedValue({ status: 'ok' });
    router.route({ filters: {}, handler });
    const { event, context } = amazonConnectHandlerEvent();

    await router.handleEvent(event, context);

    expect(handler).toHaveBeenCalledWith({
      contactData: event.Details.ContactData,
      parameters: event.Details.Parameters,
    });
  });

  test('returns the handler result', async ({ amazonConnectHandlerEvent }) => {
    const router = createAmazonConnectRouter();
    const expectedResult = { status: 'success' };
    router.route({ filters: {}, handler: vi.fn().mockResolvedValue(expectedResult) });
    const { event, context } = amazonConnectHandlerEvent();

    const result = await router.handleEvent(event, context);

    expect(result).toEqual(expectedResult);
  });

  test('throws when no route matches', async ({ amazonConnectHandlerEvent }) => {
    const router = createAmazonConnectRouter();
    router.route({ filters: { channels: ['CHAT'] }, handler: vi.fn() });
    const { event, context } = amazonConnectHandlerEvent({
      event: { Details: { ContactData: { Channel: 'VOICE', InitiationMethod: 'INBOUND' } } },
    });

    await expect(router.handleEvent(event, context)).rejects.toThrow(
      'No route matched for Amazon Connect event (channel: VOICE, initiationMethod: INBOUND)',
    );
  });

  test('handler error propagates', async ({ amazonConnectHandlerEvent }) => {
    const router = createAmazonConnectRouter();
    const handlerError = new Error('handler failed');
    router.route({ filters: {}, handler: vi.fn().mockRejectedValue(handlerError) });
    const { event, context } = amazonConnectHandlerEvent();

    await expect(router.handleEvent(event, context)).rejects.toThrow('handler failed');
  });
});

suite('full integration', () => {
  test('dispatches to the correct handler based on channel and initiation method', async ({ context }) => {
    const router = createAmazonConnectRouter();
    const voiceInboundHandler = vi.fn().mockResolvedValue({ result: 'voice-inbound' });
    const chatInboundHandler = vi.fn().mockResolvedValue({ result: 'chat-inbound' });
    const voiceOutboundHandler = vi.fn().mockResolvedValue({ result: 'voice-outbound' });

    router.voice({
      filters: { initiationMethods: ['INBOUND'] },
      handler: voiceInboundHandler,
    });
    router.chat({
      filters: { initiationMethods: ['INBOUND'] },
      handler: chatInboundHandler,
    });
    router.voice({
      filters: { initiationMethods: ['OUTBOUND'] },
      handler: voiceOutboundHandler,
    });

    const chatEvent = createAmazonConnectEvent({
      Details: { ContactData: { Channel: 'CHAT', InitiationMethod: 'INBOUND' } },
    });
    const mockContext = context();

    const result = await router.handleEvent(chatEvent, mockContext);

    expect(result).toEqual({ result: 'chat-inbound' });
    expect(voiceInboundHandler).not.toHaveBeenCalled();
    expect(chatInboundHandler).toHaveBeenCalledOnce();
    expect(voiceOutboundHandler).not.toHaveBeenCalled();
  });
});
