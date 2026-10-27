import { createLambdaAuthorizerMatcher } from '@latcher/apigateway';

import { authoriseCustomer } from './authorizer-handlers/authoriseCustomer.js';
import { logAuthorizerInvocation } from './middleware/logInvocation.js';

export const authorizerMatcher = createLambdaAuthorizerMatcher({
  middleware: [logAuthorizerInvocation],
});

authorizerMatcher.route(authoriseCustomer);
