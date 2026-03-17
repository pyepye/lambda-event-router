import type { ALBEvent, Context } from 'aws-lambda';
import { createMockContext } from './context.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export interface ALBHandlerEvent {
  event: ALBEvent;
  context: Context;
}

export type ALBEventOverrides = Omit<Partial<ALBEvent>, 'requestContext' | 'body'> & {
  requestContext?: Partial<ALBEvent['requestContext']> & {
    elb?: Partial<ALBEvent['requestContext']['elb']>;
  };
  body?: string | Record<string, unknown> | null;
};

export function createALBEvent(overrides: ALBEventOverrides = {}): ALBEvent {
  const { requestContext: requestContextOverrides, body: bodyOverride, ...restOverrides } = overrides;
  const { elb: elbOverrides, ...restRequestContextOverrides } = requestContextOverrides ?? {};

  const isObjectBody = bodyOverride !== null && typeof bodyOverride === 'object';
  const resolvedBody = isObjectBody ? JSON.stringify(bodyOverride) : (bodyOverride ?? null);

  return {
    httpMethod: 'GET',
    path: '/',
    headers: {},
    multiValueHeaders: undefined,
    queryStringParameters: undefined,
    body: resolvedBody,
    isBase64Encoded: false,
    requestContext: {
      elb: {
        targetGroupArn:
          'arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/my-target-group/50dc6c495c0c9188',
        ...elbOverrides,
      },
      ...restRequestContextOverrides,
    },
    ...restOverrides,
    ...(resolvedBody !== null ? { body: resolvedBody } : {}),
  };
}

export interface CreateALBHandlerEventOptions {
  event?: ALBEventOverrides;
  context?: Partial<Context>;
}

export function createALBHandlerEvent(options: CreateALBHandlerEventOptions = {}): ALBHandlerEvent {
  const event = createALBEvent(options.event);
  const context = createMockContext(options.context);
  return { event, context };
}

export interface ALBFixtures {
  albEvent: (overrides?: ALBEventOverrides) => ALBEvent;
  albHandlerEvent: (options?: CreateALBHandlerEventOptions) => ALBHandlerEvent;
}

export const albFixtures: FixtureMap<ALBFixtures> = {
  albEvent: fixture(createALBEvent),
  albHandlerEvent: fixture(createALBHandlerEvent),
};
