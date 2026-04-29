import { logger } from '@lambda-event-router/base';
import type { ApiRequest, HandlerResponse } from '@lambda-event-router/http';

import { tracer } from './tracer.js';

// HTTP API (API Gateway v2) emits no X-Ray segment of its own (only REST API v1 does), and the
// lambda's natural function segment is already on the correct trace as set by `_X_AMZN_TRACE_ID`.
// We don't open a stitched subsegment here: doing so would override parent_id to API Gateway's
// parent id and misparent every captured DDB call. This middleware now only enriches the logger
// with the trace id so app logs can be correlated to the trace.
export async function apiTracingMiddleware(
  request: ApiRequest,
  next: (request: ApiRequest) => Promise<HandlerResponse>,
): Promise<HandlerResponse> {
  const traceHeader = process.env._X_AMZN_TRACE_ID;

  logger.info({
    message: 'TEMP api middleware entry',
    envTraceId: traceHeader,
    segmentId: tracer.getSegment()?.id,
  });

  logger.appendKeys({ xrayTraceId: traceHeader, _X_AMZN_TRACE_ID: traceHeader });
  try {
    return await next(request);
  } finally {
    logger.removeKeys(['xrayTraceId', '_X_AMZN_TRACE_ID']);
  }
}
