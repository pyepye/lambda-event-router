import type { EventTypeRouter } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEvent,
  APIGatewayRequestAuthorizerEventV2,
  APIGatewayTokenAuthorizerEvent,
  Context,
} from 'aws-lambda';
import { isAuthorizerResponse } from './lambdaAuthorizerResponse.js';
import type {
  AuthorizerType,
  LambdaAuthorizerEvent,
  LambdaAuthorizerFilterInput,
  LambdaAuthorizerFilters,
  LambdaAuthorizerHandler,
  LambdaAuthorizerRequest,
  LambdaAuthorizerRequestRequest,
  LambdaAuthorizerResult,
  LambdaAuthorizerRouteDefinition,
  LambdaAuthorizerTokenRequest,
} from './lambdaAuthorizerTypes.js';

interface InternalRoute {
  filters: LambdaAuthorizerFilters;
  handler: LambdaAuthorizerHandler;
}

type InferRequest<TType extends AuthorizerType | undefined> = TType extends 'TOKEN'
  ? LambdaAuthorizerTokenRequest
  : TType extends 'REQUEST'
    ? LambdaAuthorizerRequestRequest
    : LambdaAuthorizerRequest;

interface RouteInput<TType extends AuthorizerType | undefined = AuthorizerType | undefined> {
  filters: { type?: TType; method?: string };
}

interface RouteBuilder<TRequest> {
  handle(handler: (request: TRequest) => Promise<LambdaAuthorizerResult | boolean>): LambdaAuthorizerRouteDefinition;
}

export function defineLambdaAuthorizerRoute<TType extends AuthorizerType | undefined = undefined>(
  config: RouteInput<TType>,
): RouteBuilder<InferRequest<TType>> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler) {
      return { ...config, handler } as LambdaAuthorizerRouteDefinition;
    },
  };
}

// TODO: This needs to be able to support multiple resources as the policy can be cached by API Gateway and used for
// multiple routes. We can allow returning an array of resources or a wildcard, but we should be careful to document
// the implications (e.g. security risks of wildcard, potential performance implications of many resources).
export function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
}

interface TokenInput {
  handler: (request: LambdaAuthorizerTokenRequest) => Promise<LambdaAuthorizerResult | boolean>;
}

interface RequestInput {
  method?: string;
  handler: (request: LambdaAuthorizerRequestRequest) => Promise<LambdaAuthorizerResult | boolean>;
}

function isTokenEvent(event: LambdaAuthorizerEvent): event is APIGatewayTokenAuthorizerEvent {
  return event.type === 'TOKEN' && 'authorizationToken' in event;
}

function isRequestV1Event(event: LambdaAuthorizerEvent): event is APIGatewayRequestAuthorizerEvent {
  return event.type === 'REQUEST' && 'methodArn' in event;
}

function isRequestV2Event(event: LambdaAuthorizerEvent): event is APIGatewayRequestAuthorizerEventV2 {
  return event.type === 'REQUEST' && 'routeArn' in event;
}

// TODO: This is basically a copy again of ALB and API Gateway REST API (v1)
function lowercaseHeaders(
  headers: Record<string, string | undefined> | null | undefined,
): Record<string, string | undefined> {
  if (!headers) return {};

  const lowered: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    lowered[key.toLowerCase()] = value;
  }
  return lowered;
}

export class LambdaAuthorizerRouter implements EventTypeRouter<LambdaAuthorizerEvent, LambdaAuthorizerResult> {
  private routes: InternalRoute[] = [];

  canHandleEvent(event: unknown): event is LambdaAuthorizerEvent {
    if (!isObject(event)) return false;

    const eventType = event.type;
    if (eventType !== 'TOKEN' && eventType !== 'REQUEST') return false;

    if (eventType === 'TOKEN') {
      return typeof event.authorizationToken === 'string' && typeof event.methodArn === 'string';
    }

    // REQUEST type — V1 has methodArn + httpMethod, V2 has routeArn
    if (typeof event.methodArn === 'string' && typeof event.httpMethod === 'string') {
      return true;
    }

    if (typeof event.routeArn === 'string') {
      return true;
    }

    return false;
  }

  route(definition: LambdaAuthorizerRouteDefinition): this {
    this.routes.push({
      filters: definition.filters,
      handler: definition.handler,
    });
    return this;
  }

  token({ handler }: TokenInput): this {
    this.routes.push({
      filters: { type: 'TOKEN' },
      handler: handler as LambdaAuthorizerHandler,
    });
    return this;
  }

  request({ method, handler }: RequestInput): this {
    this.routes.push({
      filters: { type: 'REQUEST', method },
      handler: handler as LambdaAuthorizerHandler,
    });
    return this;
  }

  async handleEvent(event: LambdaAuthorizerEvent, context: Context): Promise<LambdaAuthorizerResult> {
    const filterInput = this.extractFilterInput(event);

    const route = this.matchRoute(filterInput);
    if (!route) {
      throw new Error(
        `No route matched for Lambda Authorizer event (type: ${filterInput.type}, method: ${filterInput.method ?? 'N/A'})`,
      );
    }

    const request = this.buildRequest(event, context, filterInput);

    try {
      const result = await route.handler(request);

      if (isRequestV2Event(event) && typeof result === 'boolean') {
        return { isAuthorized: result };
      }

      if (typeof result === 'boolean') {
        throw new Error(
          'Boolean responses are only supported for HTTP API (v2) request authorizers using simple response mode',
        );
      }

      return result;
    } catch (error) {
      if (isAuthorizerResponse(error)) {
        return error;
      }
      throw error;
    }
  }

  private extractFilterInput(event: LambdaAuthorizerEvent): LambdaAuthorizerFilterInput {
    const type: AuthorizerType = event.type;

    if (type === 'TOKEN') {
      return { type };
    }

    if (isRequestV1Event(event)) {
      return { type, method: event.httpMethod };
    }

    if (isRequestV2Event(event)) {
      return { type, method: event.requestContext.http.method };
    }

    throw new Error(`Unrecognised REQUEST authorizer event`);
  }

  private buildRequest(
    event: LambdaAuthorizerEvent,
    context: Context,
    filterInput: LambdaAuthorizerFilterInput,
  ): LambdaAuthorizerRequest {
    if (isTokenEvent(event)) {
      return {
        type: filterInput.type,
        resourceArn: event.methodArn,
        authorizationToken: event.authorizationToken,
        event,
        context,
      };
    }

    if (isRequestV1Event(event)) {
      return {
        type: filterInput.type,
        resourceArn: event.methodArn,
        method: event.httpMethod,
        path: event.path,
        headers: lowercaseHeaders(event.headers),
        query: event.queryStringParameters ?? {},
        event,
        context,
      };
    }

    if (isRequestV2Event(event)) {
      return {
        type: filterInput.type,
        resourceArn: event.routeArn,
        method: event.requestContext.http.method,
        path: event.rawPath,
        headers: event.headers ?? {},
        query: event.queryStringParameters ?? {},
        event,
        context,
      };
    }

    throw new Error('Unrecognized Lambda Authorizer event format');
  }

  private matchRoute(filterInput: LambdaAuthorizerFilterInput): InternalRoute | undefined {
    return this.routes.find((route) => {
      const { filters } = route;

      if (filters.type && filters.type !== filterInput.type) {
        return false;
      }

      if (filters.method && filters.method !== filterInput.method) {
        return false;
      }

      return true;
    });
  }
}

export function createLambdaAuthorizerRouter(): LambdaAuthorizerRouter {
  return new LambdaAuthorizerRouter();
}
