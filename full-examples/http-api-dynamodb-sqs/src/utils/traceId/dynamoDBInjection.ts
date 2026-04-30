import type { ServiceInputTypes, ServiceOutputTypes } from '@aws-sdk/lib-dynamodb';
import { isObject } from '@lambda-event-router/base';
import type {
  HandlerExecutionContext,
  InitializeHandler,
  InitializeHandlerArguments,
  InitializeHandlerOutput,
} from '@smithy/types';

import { TRACE_FIELD, UPDATE_NAME_PLACEHOLDER, UPDATE_VALUE_PLACEHOLDER } from './constants.js';
import { buildHeaderFromSegment } from './segment.js';
import { tracer } from './tracer.js';

function stampPutItem(input: object, header: string): void {
  if (!isObject(input)) return;
  const item = input.Item;
  if (!isObject(item)) return;
  if (item[TRACE_FIELD] === undefined) item[TRACE_FIELD] = header;
}

function stampUpdateExpression(input: object, header: string): void {
  if (!isObject(input)) return;
  const names: Record<string, string> = {};
  if (isObject(input.ExpressionAttributeNames)) {
    for (const [key, value] of Object.entries(input.ExpressionAttributeNames)) {
      if (typeof value === 'string') names[key] = value;
    }
  }
  if (names[UPDATE_NAME_PLACEHOLDER]) return; // idempotent

  names[UPDATE_NAME_PLACEHOLDER] = TRACE_FIELD;

  const values: Record<string, unknown> = isObject(input.ExpressionAttributeValues)
    ? { ...input.ExpressionAttributeValues }
    : {};
  values[UPDATE_VALUE_PLACEHOLDER] = header;

  const existingExpression = typeof input.UpdateExpression === 'string' ? input.UpdateExpression : '';
  const updatedExpression = appendSetClause(existingExpression);

  // Mutate input in place (DocumentClient middleware passes args.input by reference).
  Object.assign(input, {
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    UpdateExpression: updatedExpression,
  });
}

function appendSetClause(expression: string): string {
  const fragment = `${UPDATE_NAME_PLACEHOLDER} = ${UPDATE_VALUE_PLACEHOLDER}`;
  if (!expression.trim()) return `SET ${fragment}`;
  // Match an existing top-level SET clause (case-insensitive, terminated by ADD/REMOVE/DELETE or
  // end of string). The /s flag lets `.` match newlines so multi-line UpdateExpressions work.
  const setRegex = /\bSET\b(.*?)(?=\b(?:ADD|REMOVE|DELETE)\b|$)/is;
  const match = expression.match(setRegex);
  if (match && match.index !== undefined) {
    const before = expression.slice(0, match.index);
    const setBody = (match[1] ?? '').trim();
    const after = expression.slice(match.index + match[0].length);
    const newSet = setBody ? `SET ${setBody}, ${fragment} ` : `SET ${fragment} `;
    return `${before}${newSet}${after}`.trim();
  }
  return `${expression.trim()} SET ${fragment}`;
}

function stampBatchWrite(input: object, header: string): void {
  if (!isObject(input)) return;
  const requestItems = input.RequestItems;
  if (!isObject(requestItems)) return;
  for (const requests of Object.values(requestItems)) {
    if (!Array.isArray(requests)) continue;
    for (const request of requests) {
      if (!isObject(request)) continue;
      const putRequest = request.PutRequest;
      if (!isObject(putRequest)) continue;
      stampPutItem(putRequest, header);
    }
  }
}

function stampTransactWrite(input: object, header: string): void {
  if (!isObject(input)) return;
  const transactItems = input.TransactItems;
  if (!Array.isArray(transactItems)) return;
  for (const item of transactItems) {
    if (!isObject(item)) continue;
    if (isObject(item.Put)) stampPutItem(item.Put, header);
    if (isObject(item.Update)) stampUpdateExpression(item.Update, header);
    // ConditionCheck and Delete are intentionally skipped: ConditionCheck has no item to tag, and
    // Delete leaves stream consumers reading OldImage._xrayTraceId of the prior writer (limitation).
  }
}

export function traceIdInjectionMiddleware(
  next: InitializeHandler<ServiceInputTypes, ServiceOutputTypes>,
  context: HandlerExecutionContext,
): InitializeHandler<ServiceInputTypes, ServiceOutputTypes> {
  return async function injectXrayTraceId(
    args: InitializeHandlerArguments<ServiceInputTypes>,
  ): Promise<InitializeHandlerOutput<ServiceOutputTypes>> {
    const header = buildHeaderFromSegment(tracer.getSegment());

    if (!header) return next(args);

    const input = args.input;
    if (!isObject(input)) return next(args);

    switch (context.commandName) {
      case 'PutCommand':
      case 'PutItemCommand':
        stampPutItem(input, header);
        break;
      case 'UpdateCommand':
      case 'UpdateItemCommand':
        stampUpdateExpression(input, header);
        break;
      case 'BatchWriteCommand':
      case 'BatchWriteItemCommand':
        stampBatchWrite(input, header);
        break;
      case 'TransactWriteCommand':
      case 'TransactWriteItemsCommand':
        stampTransactWrite(input, header);
        break;
      // DeleteCommand: no-op. Stream consumers see OldImage._xrayTraceId of the prior writer.
      default:
        break;
    }
    return next(args);
  };
}
