const NO_ROUTE_MATCHED = 'NoRouteMatchedError';

/**
 * Thrown by a router that claimed an event and then found none of its own routes matched it.
 * LambdaRouter treats this as "not mine after all" and tries the next router, so routers whose
 * canHandleEvent cannot recognise their own events, such as EventRouter and StepFunctionsRouter,
 * can be registered together.
 */
export class NoRouteMatchedError extends Error {
  override readonly name = NO_ROUTE_MATCHED;

  // Identified by name rather than instanceof, so a second copy of this package in node_modules
  // does not stop LambdaRouter recognising an error thrown against the first.
  static isNoRouteMatchedError(error: unknown): error is NoRouteMatchedError {
    return error instanceof Error && error.name === NO_ROUTE_MATCHED;
  }
}
