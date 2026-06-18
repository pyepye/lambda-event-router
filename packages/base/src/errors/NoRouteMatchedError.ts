const NO_ROUTE_MATCHED = 'NoRouteMatchedError';

export class NoRouteMatchedError extends Error {
  override readonly name = NO_ROUTE_MATCHED;

  static isNoRouteMatchedError(error: unknown): error is NoRouteMatchedError {
    return error instanceof Error && error.name === NO_ROUTE_MATCHED;
  }
}
