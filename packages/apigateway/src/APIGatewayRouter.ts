import { HTTPRouter } from '@lambda-event-router/http';

export class APIGatewayRouter extends HTTPRouter {}

export function createAPIGatewayRouter(): APIGatewayRouter {
  return new APIGatewayRouter();
}

export { defineRoute } from '@lambda-event-router/http';
