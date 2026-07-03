import type { StandardSchemaV1 } from '@standard-schema/spec';

import { BinaryBody, decodeBody } from './binaryBody.js';

function encode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64');
}

suite('decodeBody', () => {
  suite('a base64 body', () => {
    test('decodes a text content type to a string', () => {
      expect(decodeBody(encode('plain text'), true, 'text/plain')).toBe('plain text');
    });

    test('ignores the parameters and the case of the content type', () => {
      expect(decodeBody(encode('plain text'), true, 'TEXT/Plain; charset=UTF-8')).toBe('plain text');
    });

    test('decodes any JSON, XML or YAML media type to a string', () => {
      expect(decodeBody(encode('{"ok":true}'), true, 'application/json')).toBe('{"ok":true}');
      expect(decodeBody(encode('{"ok":true}'), true, 'application/vnd.api+json')).toBe('{"ok":true}');
      expect(decodeBody(encode('{"ok":true}'), true, 'application/x-amz-json-1.1')).toBe('{"ok":true}');
      expect(decodeBody(encode('<ok/>'), true, 'application/atom+xml')).toBe('<ok/>');
      expect(decodeBody(encode('ok: true'), true, 'application/yaml')).toBe('ok: true');
    });

    test('decodes a listed application type to a string', () => {
      expect(decodeBody(encode('a=1&b=2'), true, 'application/x-www-form-urlencoded')).toBe('a=1&b=2');
    });

    test('returns bytes for a content type that is not text', () => {
      const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

      expect(decodeBody(encode(bytes), true, 'image/png')).toEqual(bytes);
    });

    test('returns a string with no content type when the bytes are utf-8', () => {
      expect(decodeBody(encode('a note'), true, undefined)).toBe('a note');
    });

    test('returns bytes with no content type that utf-8 cannot carry', () => {
      const bytes = Buffer.from([0xff, 0xfe, 0x00, 0x80]);

      expect(decodeBody(encode(bytes), true, undefined)).toEqual(bytes);
    });
  });

  suite('a body that is not base64', () => {
    test('leaves a text content type as the string it arrived as', () => {
      expect(decodeBody('plain text', false, 'text/csv')).toBe('plain text');
    });

    test('leaves a body with no content type as the string it arrived as', () => {
      expect(decodeBody('plain text', false, undefined)).toBe('plain text');
    });

    test('gives bytes for a content type that is not text, so the route sees one type either way', () => {
      expect(decodeBody('sku,4\n', false, 'application/octet-stream')).toEqual(Buffer.from('sku,4\n', 'utf-8'));
    });
  });
});

suite('BinaryBody', () => {
  function validate(value: unknown): StandardSchemaV1.Result<Buffer> | Promise<StandardSchemaV1.Result<Buffer>> {
    return BinaryBody['~standard'].validate(value);
  }

  test('accepts a Buffer and hands it back', () => {
    const bytes = Buffer.from([0x01, 0x02]);

    expect(validate(bytes)).toEqual({ value: bytes });
  });

  test('names what it got instead of bytes', () => {
    expect(validate('sku,4')).toEqual({ issues: [{ message: 'Expected a binary body, got a string' }] });
    expect(validate({ sku: 'brk-9' })).toEqual({ issues: [{ message: 'Expected a binary body, got an object' }] });
    expect(validate([1, 2])).toEqual({ issues: [{ message: 'Expected a binary body, got an array' }] });
    expect(validate(null)).toEqual({ issues: [{ message: 'Expected a binary body, got no body' }] });
  });
});
