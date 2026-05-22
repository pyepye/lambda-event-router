import type { ALBEvent, Context } from 'aws-lambda';

import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export interface ALBHandlerEvent {
  event: ALBEvent;
  context: Context;
}

export type ALBEventOverrides = Omit<DeepPartial<ALBEvent>, 'body'> & {
  body?: string | Record<string, unknown> | null;
};

export function createALBEvent(overrides: ALBEventOverrides = {}): ALBEvent {
  const { body: bodyOverride, ...restOverrides } = overrides;
  const hasBodyOverride = Object.hasOwn(overrides, 'body');

  let resolvedBody: string | null = null;
  if (hasBodyOverride) {
    if (bodyOverride !== null && bodyOverride !== undefined && typeof bodyOverride === 'object') {
      resolvedBody = JSON.stringify(bodyOverride);
    } else if (typeof bodyOverride === 'string') {
      resolvedBody = bodyOverride;
    }
  }

  const defaults: ALBEvent = {
    httpMethod: 'GET',
    path: '/',
    headers: {},
    multiValueHeaders: undefined,
    queryStringParameters: undefined,
    multiValueQueryStringParameters: undefined,
    body: resolvedBody,
    isBase64Encoded: false,
    requestContext: {
      elb: {
        targetGroupArn:
          'arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/my-target-group/50dc6c495c0c9188',
      },
    },
  };

  return deepMerge(defaults, restOverrides);
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
