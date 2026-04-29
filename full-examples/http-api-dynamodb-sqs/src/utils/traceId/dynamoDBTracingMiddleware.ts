import { isObject, logger } from '@lambda-event-router/base';
import type { DynamoDBRequest } from '@lambda-event-router/dynamodb';

import { TRACE_FIELD } from './constants.js';
import { closeBridgedSegment, openBridgedSegmentWithUpstream } from './segment.js';
import { tracer } from './tracer.js';

function readDynamoDBUpstreamHeader(record: DynamoDBRequest['record']): string | undefined {
  const newImage = record.dynamodb?.NewImage;
  const oldImage = record.dynamodb?.OldImage;
  const fromNew = isObject(newImage) ? newImage[TRACE_FIELD] : undefined;
  const fromOld = isObject(oldImage) ? oldImage[TRACE_FIELD] : undefined;
  if (isObject(fromNew) && typeof fromNew.S === 'string') return fromNew.S;
  if (isObject(fromOld) && typeof fromOld.S === 'string') return fromOld.S;
  return undefined;
}

export async function dynamoDBTracingMiddleware(
  request: DynamoDBRequest,
  next: (request: DynamoDBRequest) => Promise<void>,
): Promise<void> {
  const upstreamHeader = readDynamoDBUpstreamHeader(request.record);
  const keyNames = Object.keys(request.record.dynamodb?.Keys ?? {}).join('/');

  logger.info({
    message: 'TEMP ddb stream middleware entry',
    upstreamHeader,
    keyNames,
    eventName: request.record.eventName,
    hasNewImage: request.record.dynamodb?.NewImage !== undefined,
    hasOldImage: request.record.dynamodb?.OldImage !== undefined,
  });

  const opened = openBridgedSegmentWithUpstream(tracer, `DDBStream ${keyNames}`, upstreamHeader);
  logger.appendKeys({ xrayTraceId: upstreamHeader, _X_AMZN_TRACE_ID: process.env._X_AMZN_TRACE_ID });
  try {
    await next(request);
  } finally {
    if (opened) closeBridgedSegment(tracer, opened);
    logger.removeKeys(['xrayTraceId', '_X_AMZN_TRACE_ID']);
  }
}
