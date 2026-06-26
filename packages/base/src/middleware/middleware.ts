export type Middleware<TRequest, TResponse> = (
  request: TRequest,
  next: (request: unknown) => Promise<TResponse>,
) => Promise<TResponse>;

export async function handleEventWithMiddleware<TRequest, TResponse>(
  middleware: Middleware<TRequest, TResponse>[],
  request: TRequest,
  handler: (request: TRequest) => Promise<TResponse>,
): Promise<TResponse> {
  let index = 0;

  async function next(req: unknown): Promise<TResponse> {
    const currentIndex = index;
    if (currentIndex > middleware.length) {
      throw new Error('next() called multiple times within a single middleware');
    }
    index++;

    const forwarded = req as TRequest; // A middleware can pass anything to `next`, which is what the handler receives

    const currentMiddleware = middleware[currentIndex];
    if (currentMiddleware) {
      return currentMiddleware(forwarded, next);
    }
    return handler(forwarded);
  }

  return next(request);
}
