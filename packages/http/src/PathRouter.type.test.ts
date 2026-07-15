import { PathRouter } from './PathRouter.js';
import type { HTTPFilterInput } from './types.js';

function readsTenant(input: HTTPFilterInput): boolean {
  return input.headers['x-tenant'] === 'acme';
}

suite('PathRouter convenience method filters', () => {
  let router: PathRouter;

  beforeEach(() => {
    router = new PathRouter();
  });

  test('types an inline custom on a method without a body', () => {
    const result = router.get({
      filters: {
        path: '/items',
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<HTTPFilterInput>();
          return true;
        },
      },
      handler: vi.fn(),
    });

    expect(result).toBe(router);
  });

  test('types an inline custom on a method with a body', () => {
    const result = router.post({
      filters: {
        path: '/items',
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<HTTPFilterInput>();
          return true;
        },
      },
      handler: vi.fn(),
    });

    expect(result).toBe(router);
  });

  test('accepts a custom declared with an annotated parameter', () => {
    router.get({ filters: { path: '/items', custom: readsTenant }, handler: vi.fn() });
    router.post({ filters: { path: '/items', custom: readsTenant }, handler: vi.fn() });

    expect(router.getMethodsForPath('/items')).toEqual(['GET', 'POST']);
  });
});
