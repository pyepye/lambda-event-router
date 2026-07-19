import { filtersSubsume, orderRoutesBySpecificity } from './routeOrder.js';

const names = (routes: Array<{ filters: object; name: string }>): string[] => routes.map((entry) => entry.name);

suite('filtersSubsume', () => {
  suite('key structure', () => {
    test('fewer keys with equal values subsumes more keys', () => {
      expect(filtersSubsume({ source: 'my.app' }, { source: 'my.app', detailType: 'OrderPlaced' })).toBe(true);
    });

    test('a key missing from the narrower side is not provable', () => {
      expect(filtersSubsume({ source: 'my.app', detailType: 'OrderPlaced' }, { source: 'my.app' })).toBe(false);
    });

    test('empty filters subsume every filters object', () => {
      expect(filtersSubsume({}, { source: 'my.app', detailType: 'OrderPlaced' })).toBe(true);
      expect(filtersSubsume({}, {})).toBe(true);
    });

    test('identical filters subsume each other, so neither is strictly broader', () => {
      const filters = { source: 'my.app' };

      expect(filtersSubsume(filters, { ...filters })).toBe(true);
      expect(filtersSubsume({ ...filters }, filters)).toBe(true);
    });

    test('a key set to undefined is not a constraint', () => {
      expect(filtersSubsume({ source: undefined }, { source: 'my.app' })).toBe(true);
    });
  });

  suite('string matchers', () => {
    test('a lone wildcard subsumes any exact string', () => {
      expect(filtersSubsume({ key: '*' }, { key: 'reports/june.csv' })).toBe(true);
    });

    test('a wildcard pattern subsumes an exact string it matches', () => {
      expect(filtersSubsume({ path: '/prod/*' }, { path: '/prod/thing' })).toBe(true);
    });

    test('a wildcard pattern does not subsume an exact string it cannot match', () => {
      expect(filtersSubsume({ path: '/prod/*' }, { path: '/other/thing' })).toBe(false);
    });

    test('an exact string does not subsume a wildcard pattern', () => {
      expect(filtersSubsume({ path: '/prod/thing' }, { path: '/prod/*' })).toBe(false);
    });

    test('equal exact strings subsume, unequal do not', () => {
      expect(filtersSubsume({ source: 'my.app' }, { source: 'my.app' })).toBe(true);
      expect(filtersSubsume({ source: 'my.app' }, { source: 'other.app' })).toBe(false);
    });

    test('a trailing wildcard subsumes a longer pattern with the same shape', () => {
      expect(filtersSubsume({ path: '/prod/*' }, { path: '/prod/a*' })).toBe(true);
      expect(filtersSubsume({ path: '/prod/a*' }, { path: '/prod/*' })).toBe(false);
    });

    test('a lone wildcard subsumes any other pattern', () => {
      expect(filtersSubsume({ key: '*' }, { key: 'test*' })).toBe(true);
      expect(filtersSubsume({ key: '*' }, { key: '*test' })).toBe(true);
      expect(filtersSubsume({ key: 'test*' }, { key: '*' })).toBe(false);
    });

    test('a leading wildcard subsumes a longer pattern with the same shape', () => {
      expect(filtersSubsume({ key: '*.json' }, { key: '*report.json' })).toBe(true);
      expect(filtersSubsume({ key: '*report.json' }, { key: '*.json' })).toBe(false);
    });

    test('patterns with the wildcard at opposite ends are not provable', () => {
      expect(filtersSubsume({ key: 'a*' }, { key: '*a' })).toBe(false);
      expect(filtersSubsume({ key: '*a' }, { key: 'a*' })).toBe(false);
    });

    test('a wildcard in the middle is not provable', () => {
      expect(filtersSubsume({ key: 'a*c' }, { key: 'ab*c' })).toBe(false);
    });

    test('more than one wildcard is not provable', () => {
      expect(filtersSubsume({ key: 'a*b*' }, { key: 'a*xb*' })).toBe(false);
    });

    test('a wildcard on both sides is provable when the patterns are equal', () => {
      expect(filtersSubsume({ path: '/prod/*' }, { path: '/prod/*' })).toBe(true);
    });

    test('regex characters in a pattern stay literal', () => {
      expect(filtersSubsume({ key: 'report?.csv' }, { key: 'reportX.csv' })).toBe(false);
      expect(filtersSubsume({ key: 'report?.csv' }, { key: 'report?.csv' })).toBe(true);
    });
  });

  suite('RegExp matchers', () => {
    test('the same source and flags subsumes', () => {
      expect(filtersSubsume({ source: /^my\./ }, { source: /^my\./ })).toBe(true);
    });

    test('a different source is not provable either way', () => {
      expect(filtersSubsume({ source: /^my\./ }, { source: /^my\.app$/ })).toBe(false);
      expect(filtersSubsume({ source: /^my\.app$/ }, { source: /^my\./ })).toBe(false);
    });

    test('the same source with different flags is not provable', () => {
      expect(filtersSubsume({ source: /^my\./i }, { source: /^my\./ })).toBe(false);
    });

    test('a RegExp against a string is not provable either way', () => {
      expect(filtersSubsume({ source: /^my\./ }, { source: 'my.app' })).toBe(false);
      expect(filtersSubsume({ source: 'my.app' }, { source: /^my\./ })).toBe(false);
    });

    test('a lone wildcard subsumes a RegExp, but not the other way round', () => {
      expect(filtersSubsume({ source: '*' }, { source: /^my\./ })).toBe(true);
      expect(filtersSubsume({ source: /^my\./ }, { source: '*' })).toBe(false);
    });
  });

  suite('arrays', () => {
    test('an array subsumes a single member of it', () => {
      expect(filtersSubsume({ eventName: ['INSERT', 'MODIFY'] }, { eventName: 'INSERT' })).toBe(true);
    });

    test('an array strictly subsumes a shorter array of its members', () => {
      expect(filtersSubsume({ eventName: ['INSERT', 'MODIFY'] }, { eventName: ['INSERT'] })).toBe(true);
      expect(filtersSubsume({ eventName: ['INSERT'] }, { eventName: ['INSERT', 'MODIFY'] })).toBe(false);
    });

    test('a lone wildcard covers every member of an array', () => {
      expect(filtersSubsume({ key: '*' }, { key: ['a', 'b*'] })).toBe(true);
    });

    test('a member carrying a wildcard covers an exact string', () => {
      expect(filtersSubsume({ eventSourceArn: ['prod-*'] }, { eventSourceArn: 'prod-1' })).toBe(true);
    });

    test('a single value subsumes a one-member array holding it', () => {
      expect(filtersSubsume({ eventName: 'INSERT' }, { eventName: ['INSERT'] })).toBe(true);
      expect(filtersSubsume({ eventName: 'INSERT' }, { eventName: ['INSERT', 'MODIFY'] })).toBe(false);
    });

    test('an empty array subsumes nothing', () => {
      expect(filtersSubsume({ eventName: [] }, { eventName: 'INSERT' })).toBe(false);
    });

    test('an empty array on the narrower side is covered by anything', () => {
      expect(filtersSubsume({ eventName: ['INSERT'] }, { eventName: [] })).toBe(true);
    });
  });

  suite('primitives', () => {
    test('equal numbers subsume, unequal do not', () => {
      expect(filtersSubsume({ schemaVersion: 2 }, { schemaVersion: 2 })).toBe(true);
      expect(filtersSubsume({ schemaVersion: 2 }, { schemaVersion: 3 })).toBe(false);
    });

    test('booleans only subsume their own value', () => {
      expect(filtersSubsume({ tombstone: true }, { tombstone: true })).toBe(true);
      expect(filtersSubsume({ tombstone: true }, { tombstone: false })).toBe(false);
    });

    test('a string and a number are unrelated in both directions', () => {
      expect(filtersSubsume({ partitionKey: '2' }, { partitionKey: 2 })).toBe(false);
      expect(filtersSubsume({ partitionKey: 2 }, { partitionKey: '2' })).toBe(false);
    });

    test('null is unrelated to anything', () => {
      expect(filtersSubsume({ tombstone: null }, { tombstone: true })).toBe(false);
    });
  });

  suite('nested records', () => {
    test('fewer sub-keys subsumes more sub-keys', () => {
      expect(
        filtersSubsume({ messageAttributes: { type: 'X' } }, { messageAttributes: { type: 'X', tenant: 'a' } }),
      ).toBe(true);
    });

    test('more sub-keys does not subsume fewer', () => {
      expect(
        filtersSubsume({ messageAttributes: { type: 'X', tenant: 'a' } }, { messageAttributes: { type: 'X' } }),
      ).toBe(false);
    });

    test('a wildcard sub-key subsumes an exact one', () => {
      expect(filtersSubsume({ messageAttributes: { type: '*' } }, { messageAttributes: { type: 'X' } })).toBe(true);
    });

    test('no record key at all subsumes any record', () => {
      expect(
        filtersSubsume({ eventSourceArn: 'arn' }, { eventSourceArn: 'arn', messageAttributes: { type: 'X' } }),
      ).toBe(true);
    });

    test('an own key is required, so a prototype key does not count', () => {
      expect(filtersSubsume({ m: { ['__proto__']: {} } }, { m: {} })).toBe(false);
    });

    test('only a plain object counts as a record', () => {
      expect(filtersSubsume({ m: new Date() }, { m: { type: 'X' } })).toBe(false);
      expect(filtersSubsume({ m: new Map([['k', 'v']]) }, { m: { type: 'X' } })).toBe(false);
      expect(filtersSubsume({ m: new Set(['x']) }, { m: { type: 'X' } })).toBe(false);
    });

    test('a record does not subsume a plain matcher', () => {
      expect(filtersSubsume({ messageAttributes: { type: 'X' } }, { messageAttributes: 'X' })).toBe(false);
      expect(filtersSubsume({ messageAttributes: {} }, { messageAttributes: /x/ })).toBe(false);
    });

    test('an empty record subsumes any record, because it constrains nothing', () => {
      expect(filtersSubsume({ messageAttributes: {} }, { messageAttributes: { type: 'X' } })).toBe(true);
    });

    test('a numeric sub-key compares exactly', () => {
      expect(filtersSubsume({ messageAttributes: { version: 2 } }, { messageAttributes: { version: 2 } })).toBe(true);
      expect(filtersSubsume({ messageAttributes: { version: 2 } }, { messageAttributes: { version: 3 } })).toBe(false);
    });
  });

  suite('custom', () => {
    test('a custom on one side only makes that route strictly narrower', () => {
      const custom = (): boolean => true;

      expect(filtersSubsume({ path: '/prod*' }, { path: '/prod*', custom })).toBe(true);
      expect(filtersSubsume({ path: '/prod*', custom }, { path: '/prod*' })).toBe(false);
    });

    test('a custom on the broader candidate is not provable', () => {
      const custom = (): boolean => true;

      expect(filtersSubsume({ eventSourceArn: 'arn', custom }, { eventSourceArn: 'arn', queue: 'orders' })).toBe(false);
    });

    test('a different custom on each side is not provable', () => {
      expect(filtersSubsume({ custom: (): boolean => true }, { custom: (): boolean => false })).toBe(false);
    });

    test('the same function reference on both sides is provable, so the other keys decide', () => {
      const custom = (): boolean => true;

      expect(filtersSubsume({ custom }, { custom, source: 'my.app' })).toBe(true);
      expect(filtersSubsume({ custom, source: 'my.app' }, { custom })).toBe(false);
    });
  });
});

suite('orderRoutesBySpecificity', () => {
  test('moves a narrower route ahead of a broader one registered first', () => {
    const ordered = orderRoutesBySpecificity([
      { name: 'broad', filters: { eventSourceArn: 'arn' } },
      { name: 'narrow', filters: { eventSourceArn: 'arn', messageAttributes: { type: 'X' } } },
    ]);

    expect(names(ordered)).toEqual(['narrow', 'broad']);
  });

  test('leaves a narrower route alone when it is already first', () => {
    const ordered = orderRoutesBySpecificity([
      { name: 'narrow', filters: { eventSourceArn: 'arn', messageAttributes: { type: 'X' } } },
      { name: 'broad', filters: { eventSourceArn: 'arn' } },
    ]);

    expect(names(ordered)).toEqual(['narrow', 'broad']);
  });

  test('keeps incomparable routes in registration order when a third route is ranked', () => {
    const ordered = orderRoutesBySpecificity([
      { name: 'broad', filters: { source: 'my.app' } },
      { name: 'other', filters: { detailType: 'OrderPlaced' } },
      { name: 'narrow', filters: { source: 'my.app', detailType: 'X' } },
    ]);

    expect(names(ordered)).toEqual(['narrow', 'broad', 'other']);
  });

  test('moves only the route that has to move', () => {
    const ordered = orderRoutesBySpecificity([
      { name: 'broad', filters: { source: 'my.app' } },
      { name: 'dupA', filters: { account: '111' } },
      { name: 'dupB', filters: { account: '111' } },
      { name: 'narrow', filters: { source: 'my.app', region: 'eu-west-2' } },
    ]);

    expect(names(ordered)).toEqual(['narrow', 'broad', 'dupA', 'dupB']);
  });

  test('keeps equivalent filters in registration order while a third route is ranked', () => {
    const ordered = orderRoutesBySpecificity([
      { name: 'broad', filters: { source: 'my.app' } },
      { name: 'dupA', filters: { account: '111' } },
      { name: 'dupB', filters: { account: '111' } },
      { name: 'narrow', filters: { source: 'my.app', region: 'eu-west-2' } },
    ]);

    expect(names(ordered).indexOf('dupA')).toBeLessThan(names(ordered).indexOf('dupB'));
  });

  test('keeps incomparable routes in registration order', () => {
    const ordered = orderRoutesBySpecificity([
      { name: 'first', filters: { source: 'a.app' } },
      { name: 'second', filters: { source: 'b.app' } },
    ]);

    expect(names(ordered)).toEqual(['first', 'second']);
  });

  test('sorts a chain of three narrowest first from every input order', () => {
    const broad = { name: 'broad', filters: { source: 'my.app' } };
    const middle = { name: 'middle', filters: { source: 'my.app', detailType: 'OrderPlaced' } };
    const narrow = {
      name: 'narrow',
      filters: { source: 'my.app', detailType: 'OrderPlaced', account: '111122223333' },
    };
    const permutations = [
      [broad, middle, narrow],
      [broad, narrow, middle],
      [middle, broad, narrow],
      [middle, narrow, broad],
      [narrow, broad, middle],
      [narrow, middle, broad],
    ];

    for (const permutation of permutations) {
      expect(names(orderRoutesBySpecificity(permutation))).toEqual(['narrow', 'middle', 'broad']);
    }
  });

  test('keeps two incomparable narrow routes ahead of the broad one, in registration order', () => {
    const ordered = orderRoutesBySpecificity([
      { name: 'broad', filters: { source: 'my.app' } },
      { name: 'placed', filters: { source: 'my.app', detailType: 'OrderPlaced' } },
      { name: 'cancelled', filters: { source: 'my.app', detailType: 'OrderCancelled' } },
    ]);

    expect(names(ordered)).toEqual(['placed', 'cancelled', 'broad']);
  });

  test('keeps identical filters in registration order', () => {
    const ordered = orderRoutesBySpecificity([
      { name: 'first', filters: { source: 'my.app' } },
      { name: 'second', filters: { source: 'my.app' } },
    ]);

    expect(names(ordered)).toEqual(['first', 'second']);
  });

  test('puts a guarded route ahead of its fallback from either registration order', () => {
    const custom = (): boolean => true;
    const guarded = { name: 'guarded', filters: { path: '/prod*', custom } };
    const fallback = { name: 'fallback', filters: { path: '/prod*' } };

    expect(names(orderRoutesBySpecificity([fallback, guarded]))).toEqual(['guarded', 'fallback']);
    expect(names(orderRoutesBySpecificity([guarded, fallback]))).toEqual(['guarded', 'fallback']);
  });

  test('leaves a pair alone when the broader route carries the custom, in either order', () => {
    const custom = (): boolean => true;
    const guarded = { name: 'guarded', filters: { eventSourceArn: 'arn', custom } };
    const narrow = { name: 'narrow', filters: { eventSourceArn: 'arn', messageAttributes: { type: 'X' } } };
    // A third route that does rank, so the assertion only holds if the ordering ran
    const broad = { name: 'broad', filters: { eventSourceArn: 'arn' } };

    expect(names(orderRoutesBySpecificity([broad, guarded, narrow]))).toEqual(['guarded', 'narrow', 'broad']);
    expect(names(orderRoutesBySpecificity([broad, narrow, guarded]))).toEqual(['narrow', 'guarded', 'broad']);
  });

  test('orders an exact wildcard fallback last', () => {
    const ordered = orderRoutesBySpecificity([
      { name: 'fallback', filters: { key: '*' } },
      { name: 'uploads', filters: { key: 'uploads/*' } },
    ]);

    expect(names(ordered)).toEqual(['uploads', 'fallback']);
  });

  test('returns an empty list and a single route unchanged', () => {
    expect(orderRoutesBySpecificity([])).toEqual([]);
    expect(names(orderRoutesBySpecificity([{ name: 'only', filters: {} }]))).toEqual(['only']);
  });

  test('does not mutate the array it is given', () => {
    const input = [
      { name: 'broad', filters: { source: 'my.app' } },
      { name: 'narrow', filters: { source: 'my.app', detailType: 'OrderPlaced' } },
    ];

    orderRoutesBySpecificity(input);

    expect(names(input)).toEqual(['broad', 'narrow']);
  });

  test('orders a catch-all last however many routes precede it', () => {
    const ordered = orderRoutesBySpecificity([
      { name: 'catchAll', filters: {} },
      { name: 'placed', filters: { source: 'my.app', detailType: 'OrderPlaced' } },
      { name: 'any', filters: { source: 'my.app' } },
    ]);

    expect(names(ordered)).toEqual(['placed', 'any', 'catchAll']);
  });
});
