import { isAuthorizerResponse, type LambdaAuthorizerMiddleware } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

// Route middleware on the TOKEN route: reads the policy the handler produced on the way back out.
// A handler that throws its policy skips this, since the router catches the throw above it.
export const withAuditTrail: LambdaAuthorizerMiddleware = async (request, next) => {
  const result = await next(request);

  logger.info({
    message: 'Token decision recorded',
    effect: isAuthorizerResponse(result) ? result.policyDocument.Statement[0]?.Effect : undefined,
  });

  return result;
};
