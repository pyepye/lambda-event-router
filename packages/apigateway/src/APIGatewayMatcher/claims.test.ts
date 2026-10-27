import { parseClaims } from './claims.js';

// Every input is a value API Gateway delivered to a Lambda in a real request
suite('parseClaims', () => {
  suite('time claims', () => {
    test('turns epoch seconds from HTTP API into a Date', () => {
      const claims = parseClaims({ exp: '1790635493', iat: '1790631893', auth_time: '1790631893' });

      expect(claims.exp).toEqual(new Date('2026-09-28T22:44:53Z'));
      expect(claims.iat).toEqual(new Date('2026-09-28T21:44:53Z'));
      expect(claims.auth_time).toEqual(new Date('2026-09-28T21:44:53Z'));
    });

    test('turns the date string from a REST Cognito authorizer into a Date', () => {
      const claims = parseClaims({ exp: 'Mon Sep 28 22:44:53 UTC 2026', iat: 'Mon Sep 8 02:04:03 UTC 2026' });

      expect(claims.exp).toEqual(new Date('2026-09-28T22:44:53Z'));
      expect(claims.iat).toEqual(new Date('2026-09-08T02:04:03Z'));
    });

    test('turns nbf and updated_at into a Date', () => {
      const claims = parseClaims({ nbf: '1790633885', updated_at: '1790630295' });

      expect(claims.nbf).toEqual(new Date(1790633885 * 1000));
      expect(claims.updated_at).toEqual(new Date(1790630295 * 1000));
    });

    test('leaves a time claim it cannot read as the string that arrived', () => {
      const claims = parseClaims({ auth_time: 'yesterday' });

      expect(claims.auth_time).toBe('yesterday');
    });
  });

  suite('boolean claims', () => {
    test('turns email_verified and phone_number_verified into booleans', () => {
      const claims = parseClaims({ email_verified: 'true', phone_number_verified: 'false' });

      expect(claims.email_verified).toBe(true);
      expect(claims.phone_number_verified).toBe(false);
    });
  });

  suite('list claims', () => {
    test('splits cognito:groups from a REST Cognito authorizer on commas', () => {
      const claims = parseClaims({ 'cognito:groups': 'pickers,supervisors' });

      expect(claims['cognito:groups']).toEqual(['pickers', 'supervisors']);
    });

    test('gives a single REST group as a list of one', () => {
      const claims = parseClaims({ 'cognito:groups': 'pickers' });

      expect(claims['cognito:groups']).toEqual(['pickers']);
    });

    test('reads cognito:groups from HTTP API', () => {
      const claims = parseClaims({ 'cognito:groups': '[pickers supervisors]' });

      expect(claims['cognito:groups']).toEqual(['pickers', 'supervisors']);
    });

    test('reads cognito:roles and amr from HTTP API', () => {
      const claims = parseClaims({
        'cognito:roles': '[arn:aws:iam::1:role/a arn:aws:iam::1:role/b]',
        amr: '[pwd mfa]',
      });

      expect(claims['cognito:roles']).toEqual(['arn:aws:iam::1:role/a', 'arn:aws:iam::1:role/b']);
      expect(claims.amr).toEqual(['pwd', 'mfa']);
    });

    test('reads an aud array and leaves a single aud as a string', () => {
      expect(parseClaims({ aud: '[probe-audience other-audience]' }).aud).toEqual(['probe-audience', 'other-audience']);
      expect(parseClaims({ aud: 'probe-audience' }).aud).toBe('probe-audience');
    });
  });

  suite('address claim', () => {
    test('reads the address fields, including a value with spaces', () => {
      const claims = parseClaims({ address: 'map[country:GB street_address:1 High St]' });

      expect(claims.address).toEqual({ country: 'GB', street_address: '1 High St' });
    });
  });

  suite('string claims', () => {
    test('leaves standard string claims as they arrived', () => {
      const claims = parseClaims({
        sub: 'custom-user',
        iss: 'https://issuer.example',
        scope: 'probe/read other/write',
      });

      expect(claims).toEqual({ sub: 'custom-user', iss: 'https://issuer.example', scope: 'probe/read other/write' });
    });
  });

  suite('custom claims', () => {
    test('leaves scalar values as the strings that arrived', () => {
      const claims = parseClaims({
        integer: '3',
        yes: 'true',
        exponent: '1e+21',
        comma: 'a,b',
        spaced: 'a b',
        blank: '',
      });

      expect(claims).toEqual({ integer: '3', yes: 'true', exponent: '1e+21', comma: 'a,b', spaced: 'a b', blank: '' });
    });

    test('keeps Cognito Number, Boolean and DateTime custom attributes as strings', () => {
      const claims = parseClaims({
        'custom:seats': '3',
        'custom:isManager': 'true',
        'custom:hiredAt': '2026-01-15 09:30:00 UTC',
      });

      expect(claims['custom:seats']).toBe('3');
      expect(claims['custom:isManager']).toBe('true');
      expect(claims['custom:hiredAt']).toBe('2026-01-15 09:30:00 UTC');
    });

    test('turns <nil> into null', () => {
      expect(parseClaims({ nothing: '<nil>' }).nothing).toBeNull();
    });

    test('reads an array, keeping its items as strings', () => {
      const claims = parseClaims({ list: '[a b]', single: '[a]', empty: '[]', mixed: '[a 1 true]' });

      expect(claims).toEqual({ list: ['a', 'b'], single: ['a'], empty: [], mixed: ['a', '1', 'true'] });
    });

    test('splits an array item that held a space, because the delivered value cannot show it', () => {
      expect(parseClaims({ spaced: '[a b c]' }).spaced).toEqual(['a', 'b', 'c']);
    });

    test('keeps a comma inside an array item', () => {
      expect(parseClaims({ comma: '[a,b c]' }).comma).toEqual(['a,b', 'c']);
    });

    test('reads a string that looks like an array as an array', () => {
      expect(parseClaims({ bracketed: '[a b]' }).bracketed).toEqual(['a', 'b']);
    });

    test('reads an object, keeping its values as strings', () => {
      expect(parseClaims({ nested: 'map[level:3 team:goods-in]' }).nested).toEqual({ level: '3', team: 'goods-in' });
    });

    test('reads nested objects and an empty object', () => {
      const claims = parseClaims({ deep: 'map[a:map[b:map[c:d]]]', emptyObject: 'map[]' });

      expect(claims).toEqual({ deep: { a: { b: { c: 'd' } } }, emptyObject: {} });
    });

    test('reads an array of objects', () => {
      expect(parseClaims({ listOfObjects: '[map[a:1] map[b:two]]' }).listOfObjects).toEqual([{ a: '1' }, { b: 'two' }]);
    });

    test('reads an array that holds a bracketed item', () => {
      expect(parseClaims({ bracketed: '[[a] b]' }).bracketed).toEqual([['a'], 'b']);
    });
  });
});
