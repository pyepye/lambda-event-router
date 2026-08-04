import { createSQSRecord } from './sqs.js';

suite('createSQSRecord', () => {
  test('stringifies an object body', () => {
    const record = createSQSRecord({ body: { orderId: '123' } });

    expect(record.body).toBe('{"orderId":"123"}');
  });

  test('keeps a string body as it is', () => {
    const record = createSQSRecord({ body: 'plain text' });

    expect(record.body).toBe('plain text');
  });
});
