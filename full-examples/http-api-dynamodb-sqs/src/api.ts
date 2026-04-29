import { createAPIGatewayRouter } from '@lambda-event-router/apigateway';

import { createOrderRoute } from './api-handlers/createOrder.js';
import { getOrderRoute } from './api-handlers/getOrder.js';
import { apiTracingMiddleware } from './utils/traceId/apiTracingMiddleware.js';

export const apiRouter = createAPIGatewayRouter({
  middleware: [apiTracingMiddleware],
});

apiRouter.route(createOrderRoute).route(getOrderRoute);
