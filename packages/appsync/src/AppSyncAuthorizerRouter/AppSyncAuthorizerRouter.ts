import type { EventTypeRouter } from '@lambda-event-router/base';
import { isObject } from '@lambda-event-router/base';
import type { AppSyncAuthorizerEvent, AppSyncAuthorizerResult, Context } from 'aws-lambda';
import { isAppSyncAuthorizerResponse } from './response.js';
import type {
  AppSyncAuthorizerRequest,
  AppSyncAuthorizerRouteBuilder,
  AppSyncAuthorizerRouteDefinition,
} from './types.js';

type AuthorizerResult = AppSyncAuthorizerResult<Record<string, unknown>>;

export function defineAuthorizerRoute(): AppSyncAuthorizerRouteBuilder {
  return {
    handle(
      handler: (request: AppSyncAuthorizerRequest) => Promise<AuthorizerResult>,
    ): AppSyncAuthorizerRouteDefinition {
      return { handler };
    },
  };
}

export class AppSyncAuthorizerRouter implements EventTypeRouter<AppSyncAuthorizerEvent, AuthorizerResult> {
  private routeDefinition: AppSyncAuthorizerRouteDefinition | undefined;

  canHandleEvent(event: unknown): event is AppSyncAuthorizerEvent {
    if (!isObject(event)) return false;
    if (typeof event.authorizationToken !== 'string') return false;
    if (!isObject(event.requestContext)) return false;

    const { apiId, accountId, queryString, operationName } = event.requestContext;
    if (typeof apiId !== 'string') return false;
    if (typeof accountId !== 'string') return false;
    if (typeof queryString !== 'string') return false;
    if (typeof operationName !== 'string') return false;

    return true;
  }

  route(definition: AppSyncAuthorizerRouteDefinition): this {
    this.routeDefinition = definition;
    return this;
  }

  async handleEvent(event: AppSyncAuthorizerEvent, context: Context): Promise<AuthorizerResult> {
    if (!this.routeDefinition) {
      throw new Error('No authorizer route registered');
    }

    const request: AppSyncAuthorizerRequest = {
      authorizationToken: event.authorizationToken,
      requestHeaders: event.requestHeaders,
      apiId: event.requestContext.apiId,
      accountId: event.requestContext.accountId,
      requestId: event.requestContext.requestId,
      queryString: event.requestContext.queryString,
      operationName: event.requestContext.operationName,
      variables: event.requestContext.variables,
      event,
      context,
    };

    try {
      return await this.routeDefinition.handler(request);
    } catch (error) {
      if (isAppSyncAuthorizerResponse(error)) {
        return error;
      }
      throw error;
    }
  }
}

export function createAppSyncAuthorizerRouter(): AppSyncAuthorizerRouter {
  return new AppSyncAuthorizerRouter();
}
