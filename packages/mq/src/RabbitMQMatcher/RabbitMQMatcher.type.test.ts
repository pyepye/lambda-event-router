import type { RabbitMQBasicProperties, RabbitMQFilterInput, RabbitMQHeaderValue, RabbitMQRequest } from './types.js';

type Headers = RabbitMQBasicProperties['headers'];

suite('RabbitMQ property types', () => {
  test('contentType is null when the publisher set none', () => {
    expectTypeOf<RabbitMQBasicProperties['contentType']>().toEqualTypeOf<string | null>();
    expectTypeOf<RabbitMQFilterInput['contentType']>().toEqualTypeOf<string | null>();
  });

  test('request and filter input timestamps are a Date or null', () => {
    expectTypeOf<RabbitMQRequest['timestamp']>().toEqualTypeOf<Date | null>();
    expectTypeOf<RabbitMQFilterInput['timestamp']>().toEqualTypeOf<Date | null>();
  });

  test('headers take every shape Amazon MQ delivers', () => {
    const headers: Headers = {
      longString: { bytes: [116, 101, 120, 116] },
      voidValue: null,
      booleanValue: false,
      numberValue: -100000,
      decimalValue: 123.45,
      timestampValue: 'Sep 21, 2026, 2:13:20 PM',
      byteArray: [1, 2, -1],
      array: [{ bytes: [120] }, 1, true, null],
      table: { inner: { bytes: [121] }, deeper: { n: 2 } },
    };

    expectTypeOf(headers).toEqualTypeOf<Record<string, RabbitMQHeaderValue>>();
  });

  test('headers reject a value Amazon MQ never delivers', () => {
    const headers: Headers = {
      // @ts-expect-error - undefined is not an AMQP field value
      missing: undefined,
    };

    expectTypeOf(headers).toEqualTypeOf<Record<string, RabbitMQHeaderValue>>();
  });
});
