import { createAPIGatewayMatcher } from '@latcher/apigateway';

import { createOrder } from './api-handlers/createOrder.js';
import { getOrder } from './api-handlers/getOrder.js';
import { logApiInvocation } from './middleware/logInvocation.js';

export const apiMatcher = createAPIGatewayMatcher({
  middleware: [logApiInvocation],
});

apiMatcher.route(createOrder).route(getOrder);
