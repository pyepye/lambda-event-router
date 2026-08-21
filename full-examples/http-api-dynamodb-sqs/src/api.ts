import { createAPIGatewayRouter } from '@lambda-event-router/apigateway';

import { createOrder } from './api-handlers/createOrder.js';
import { getOrder } from './api-handlers/getOrder.js';
import { logApiInvocation } from './middleware/logInvocation.js';

export const apiRouter = createAPIGatewayRouter({
  middleware: [logApiInvocation],
});

apiRouter.route(createOrder).route(getOrder);
