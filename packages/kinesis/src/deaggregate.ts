import { createHash } from 'node:crypto';

export interface UserRecord {
  data: Buffer;
  partitionKey: string;
  subSequenceNumber?: number;
}

type ProtobufField =
  | { fieldNumber: number; wireType: 'varint'; value: number }
  | { fieldNumber: number; wireType: 'lengthDelimited'; value: Buffer };

interface VarintResult {
  value: number;
  nextOffset: number;
}

const KPL_MAGIC: Buffer = Buffer.from([0xf3, 0x89, 0x9a, 0xc2]);
const MD5_LENGTH = 16;

const WIRE_TYPE_VARINT = 0;
const WIRE_TYPE_LENGTH_DELIMITED = 2;
const WIRE_TYPE_BITS = 3;
const MAX_VARINT_BYTES = 10;
const VARINT_PAYLOAD_BITS = 7;
const VARINT_PAYLOAD_MASK = 0x7f;
const VARINT_CONTINUATION_BIT = 0x80;

const AGGREGATED_PARTITION_KEY_TABLE_FIELD = 1;
const AGGREGATED_RECORDS_FIELD = 3;
const RECORD_PARTITION_KEY_INDEX_FIELD = 1;
const RECORD_DATA_FIELD = 3;

export function deaggregateRecord(rawData: Buffer, partitionKey: string): UserRecord[] {
  const plainRecord: UserRecord[] = [{ data: rawData, partitionKey }];

  const message = extractAggregatedMessage(rawData);
  if (!message) return plainRecord;

  // KCL routes anything it cannot decode as a plain record, so this does too
  try {
    return decodeAggregatedRecord(message);
  } catch {
    return plainRecord;
  }
}

function extractAggregatedMessage(rawData: Buffer): Buffer | undefined {
  const frameLength = KPL_MAGIC.length + MD5_LENGTH;
  if (rawData.length <= frameLength) return undefined;

  const hasMagic = rawData.subarray(0, KPL_MAGIC.length).equals(KPL_MAGIC);
  if (!hasMagic) return undefined;

  const checksumStart = rawData.length - MD5_LENGTH;
  const message = rawData.subarray(KPL_MAGIC.length, checksumStart);
  const checksum = rawData.subarray(checksumStart);
  const expectedChecksum = createHash('md5').update(message).digest();
  if (!checksum.equals(expectedChecksum)) return undefined;

  return message;
}

function decodeAggregatedRecord(message: Buffer): UserRecord[] {
  const partitionKeys: string[] = [];
  const recordMessages: Buffer[] = [];

  for (const field of readFields(message)) {
    if (field.wireType !== 'lengthDelimited') continue;
    if (field.fieldNumber === AGGREGATED_PARTITION_KEY_TABLE_FIELD) partitionKeys.push(field.value.toString('utf-8'));
    if (field.fieldNumber === AGGREGATED_RECORDS_FIELD) recordMessages.push(field.value);
  }

  if (recordMessages.length === 0) throw new Error('Aggregated record holds no records');

  return recordMessages.map((recordMessage, subSequenceNumber) =>
    decodeUserRecord(recordMessage, partitionKeys, subSequenceNumber),
  );
}

function decodeUserRecord(message: Buffer, partitionKeys: string[], subSequenceNumber: number): UserRecord {
  let partitionKeyIndex: number | undefined;
  let data: Buffer | undefined;

  for (const field of readFields(message)) {
    const isPartitionKeyIndex = field.fieldNumber === RECORD_PARTITION_KEY_INDEX_FIELD && field.wireType === 'varint';
    const isData = field.fieldNumber === RECORD_DATA_FIELD && field.wireType === 'lengthDelimited';
    if (isPartitionKeyIndex) partitionKeyIndex = field.value;
    if (isData) data = field.value;
  }

  const partitionKey = partitionKeyIndex === undefined ? undefined : partitionKeys[partitionKeyIndex];
  if (partitionKey === undefined || data === undefined) {
    throw new Error(`Aggregated record ${subSequenceNumber} has no partition key or data`);
  }

  return { data, partitionKey, subSequenceNumber };
}

function readFields(message: Buffer): ProtobufField[] {
  const fields: ProtobufField[] = [];
  let offset = 0;

  while (offset < message.length) {
    const tag = readVarint(message, offset);
    const fieldNumber = Math.floor(tag.value / 2 ** WIRE_TYPE_BITS);
    const wireType = tag.value % 2 ** WIRE_TYPE_BITS;

    if (wireType === WIRE_TYPE_VARINT) {
      const varint = readVarint(message, tag.nextOffset);
      fields.push({ fieldNumber, wireType: 'varint', value: varint.value });
      offset = varint.nextOffset;
      continue;
    }

    if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
      const length = readVarint(message, tag.nextOffset);
      const end = length.nextOffset + length.value;
      if (end > message.length) throw new Error('Protobuf field runs past the end of the message');

      fields.push({ fieldNumber, wireType: 'lengthDelimited', value: message.subarray(length.nextOffset, end) });
      offset = end;
      continue;
    }

    throw new Error(`Unsupported protobuf wire type ${wireType}`);
  }

  return fields;
}

function readVarint(buffer: Buffer, offset: number): VarintResult {
  const varintBytes = buffer.subarray(offset, offset + MAX_VARINT_BYTES);
  let value = 0;

  for (const [position, byte] of varintBytes.entries()) {
    value += (byte & VARINT_PAYLOAD_MASK) * 2 ** (VARINT_PAYLOAD_BITS * position);
    if (byte < VARINT_CONTINUATION_BIT) return { value, nextOffset: offset + position + 1 };
  }

  throw new Error('Protobuf varint is truncated or longer than 10 bytes');
}
