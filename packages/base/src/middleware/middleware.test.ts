import { handleEventWithMiddleware } from './middleware.js';

interface TestRequest {
  value: string;
}

interface TestResponse {
  result: string;
}

type TestNext = (request: TestRequest) => Promise<TestResponse>;
type TestVoidNext = (request: TestRequest) => Promise<void>;

suite('handleEventWithMiddleware', () => {
  test('calls the handler directly when no middleware is provided', async () => {
    const handler = vi.fn().mockResolvedValue({ result: 'ok' });

    const response = await handleEventWithMiddleware<TestRequest, TestResponse>([], { value: 'test' }, handler);

    expect(handler).toHaveBeenCalledWith({ value: 'test' });
    expect(response).toEqual({ result: 'ok' });
  });

  test('executes middleware in order before calling the handler', async () => {
    const callOrder: string[] = [];

    async function middlewareOne(request: TestRequest, next: TestNext): Promise<TestResponse> {
      callOrder.push('mw1-pre');
      const response = await next(request);
      callOrder.push('mw1-post');
      return response;
    }

    async function middlewareTwo(request: TestRequest, next: TestNext): Promise<TestResponse> {
      callOrder.push('mw2-pre');
      const response = await next(request);
      callOrder.push('mw2-post');
      return response;
    }

    async function handler(_request: TestRequest): Promise<TestResponse> {
      callOrder.push('handler');
      return { result: 'ok' };
    }

    await handleEventWithMiddleware([middlewareOne, middlewareTwo], { value: 'test' }, handler);

    expect(callOrder).toEqual(['mw1-pre', 'mw2-pre', 'handler', 'mw2-post', 'mw1-post']);
  });

  test('allows middleware to short-circuit by not calling next', async () => {
    const handler = vi.fn().mockResolvedValue({ result: 'ok' });

    async function blockingMiddleware(_request: TestRequest, _next: TestNext): Promise<TestResponse> {
      return { result: 'blocked' };
    }

    const response = await handleEventWithMiddleware([blockingMiddleware], { value: 'test' }, handler);

    expect(response).toEqual({ result: 'blocked' });
    expect(handler).not.toHaveBeenCalled();
  });

  test('allows middleware to modify the request before passing to next', async () => {
    const handler = vi.fn().mockResolvedValue({ result: 'ok' });

    async function modifyRequest(request: TestRequest, next: TestNext): Promise<TestResponse> {
      return next({ value: `${request.value}-modified` });
    }

    await handleEventWithMiddleware([modifyRequest], { value: 'original' }, handler);

    expect(handler).toHaveBeenCalledWith({ value: 'original-modified' });
  });

  test('allows middleware to modify the response after calling next', async () => {
    async function handler(_request: TestRequest): Promise<TestResponse> {
      return { result: 'original' };
    }

    async function modifyResponse(request: TestRequest, next: TestNext): Promise<TestResponse> {
      const response = await next(request);
      return { result: `${response.result}-modified` };
    }

    const response = await handleEventWithMiddleware([modifyResponse], { value: 'test' }, handler);

    expect(response).toEqual({ result: 'original-modified' });
  });

  test('propagates errors thrown by the handler', async () => {
    async function handler(): Promise<TestResponse> {
      throw new Error('handler error');
    }

    async function middleware(request: TestRequest, next: TestNext): Promise<TestResponse> {
      return next(request);
    }

    await expect(handleEventWithMiddleware([middleware], { value: 'test' }, handler)).rejects.toThrow('handler error');
  });

  test('propagates errors thrown by middleware', async () => {
    const handler = vi.fn().mockResolvedValue({ result: 'ok' });

    async function failingMiddleware(_request: TestRequest, _next: TestNext): Promise<TestResponse> {
      throw new Error('middleware error');
    }

    await expect(handleEventWithMiddleware([failingMiddleware], { value: 'test' }, handler)).rejects.toThrow(
      'middleware error',
    );
    expect(handler).not.toHaveBeenCalled();
  });

  test('allows middleware to catch and handle errors from downstream', async () => {
    async function handler(): Promise<TestResponse> {
      throw new Error('handler error');
    }

    async function errorHandler(request: TestRequest, next: TestNext): Promise<TestResponse> {
      try {
        return await next(request);
      } catch {
        return { result: 'recovered' };
      }
    }

    const response = await handleEventWithMiddleware([errorHandler], { value: 'test' }, handler);

    expect(response).toEqual({ result: 'recovered' });
  });

  test('works with void responses for record-based handlers', async () => {
    const callOrder: string[] = [];

    async function middleware(request: TestRequest, next: TestVoidNext): Promise<void> {
      callOrder.push('pre');
      await next(request);
      callOrder.push('post');
    }

    async function handler(): Promise<void> {
      callOrder.push('handler');
    }

    await handleEventWithMiddleware([middleware], { value: 'test' }, handler);

    expect(callOrder).toEqual(['pre', 'handler', 'post']);
  });

  test('allows void middleware to skip the handler by not calling next', async () => {
    const handler = vi.fn();

    async function skipMiddleware(_request: TestRequest, _next: TestVoidNext): Promise<void> {
      return;
    }

    await handleEventWithMiddleware([skipMiddleware], { value: 'test' }, handler);

    expect(handler).not.toHaveBeenCalled();
  });

  test('throws an error if next() is called multiple times within a single middleware', async () => {
    const handler = vi.fn().mockResolvedValue({ result: 'ok' });

    async function doubleNextMiddleware(request: TestRequest, next: TestNext): Promise<TestResponse> {
      await next(request);
      return next(request);
    }

    await expect(handleEventWithMiddleware([doubleNextMiddleware], { value: 'test' }, handler)).rejects.toThrow(
      'next() called multiple times within a single middleware',
    );
  });
});
