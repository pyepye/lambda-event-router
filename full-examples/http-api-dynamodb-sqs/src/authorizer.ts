import { createLambdaAuthorizerRouter } from '@lambda-event-router/apigateway';

import { authoriseCustomer } from './authorizer-handlers/authoriseCustomer.js';
import { logAuthorizerInvocation } from './middleware/logInvocation.js';

export const authorizerRouter = createLambdaAuthorizerRouter({
  middleware: [logAuthorizerInvocation],
});

authorizerRouter.route(authoriseCustomer);
