import { HTTPRouter } from '@lambda-event-router/http';
import { type APIGatewayEvent, type APIGatewayResult, apiGatewayAdapter } from './apiGatewayAdapter.js';

export class APIGatewayRouter extends HTTPRouter<APIGatewayEvent, APIGatewayResult> {
  constructor() {
    super(apiGatewayAdapter);
  }
}

export function createAPIGatewayRouter(): APIGatewayRouter {
  return new APIGatewayRouter();
}
