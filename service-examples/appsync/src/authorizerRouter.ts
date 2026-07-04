import { createAppSyncAuthorizerRouter, defineAuthorizerRoute } from '@lambda-event-router/appsync';

import { authoriseSupportToken } from './handlers/authoriseSupportToken.js';
import { logAuthorizationAttempt } from './middleware/logAuthorizationAttempt.js';
import { rejectExpiredToken } from './middleware/rejectExpiredToken.js';

export const authorizerRouter = createAppSyncAuthorizerRouter({ middleware: [logAuthorizationAttempt] });

// The router holds one route, so there are no filters. Everything the API sends reaches this handler.
authorizerRouter.route(defineAuthorizerRoute({ middleware: [rejectExpiredToken] }).handle(authoriseSupportToken));
