import { createAppSyncAuthorizerRouter, defineAuthorizerRoute } from '@lambda-event-router/appsync';

import { authoriseAdminOperation, isAgentToken } from './handlers/authoriseAdminOperation.js';
import { authoriseSupportToken } from './handlers/authoriseSupportToken.js';
import { logAuthorizationAttempt } from './middleware/logAuthorizationAttempt.js';
import { rejectExpiredToken } from './middleware/rejectExpiredToken.js';
import { ADMIN_OPERATION } from './utils/constants.js';

export const authorizerRouter = createAppSyncAuthorizerRouter({ middleware: [logAuthorizationAttempt] });

// Order matters: the admin route is asked first, and anything it turns down is held to the ordinary
// grant by the route below it, which takes everything else.
authorizerRouter
  .route(
    defineAuthorizerRoute({ filters: { operationName: ADMIN_OPERATION, custom: isAgentToken } }).handle(
      authoriseAdminOperation,
    ),
  )
  .route(defineAuthorizerRoute({ middleware: [rejectExpiredToken] }).handle(authoriseSupportToken));
