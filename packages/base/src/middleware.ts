export type Middleware<TRequest, TResponse> = (
  request: TRequest,
  next: (request: TRequest) => Promise<TResponse>,
) => Promise<TResponse>;

export async function handleEventWithMiddleware<TRequest, TResponse>(
  middleware: Middleware<TRequest, TResponse>[],
  request: TRequest,
  handler: (request: TRequest) => Promise<TResponse>,
): Promise<TResponse> {
  let index = 0;

  async function next(req: TRequest): Promise<TResponse> {
    const currentMiddleware = middleware[index];
    if (currentMiddleware) {
      index++;
      return currentMiddleware(req, next);
    }
    return handler(req);
  }

  return next(request);
}
