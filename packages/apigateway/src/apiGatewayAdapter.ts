import type { FinalizedHTTPResponse, HTTPAdapter, NormalizedHTTPEvent } from '@lambda-event-router/http';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayProxyResultV2 } from 'aws-lambda';
import { apiGatewayV1Adapter, canHandleV1Event } from './apiGatewayV1Adapter.js';
import { type APIGatewayV2EventType, apiGatewayV2Adapter, canHandleV2Event } from './apiGatewayV2Adapter.js';

export type APIGatewayEvent = APIGatewayV2EventType | APIGatewayProxyEvent;
export type APIGatewayResult = APIGatewayProxyResultV2 | APIGatewayProxyResult;

function isV2Event(event: APIGatewayEvent): event is APIGatewayV2EventType {
  return 'rawPath' in event;
}

export const apiGatewayAdapter: HTTPAdapter<APIGatewayEvent, APIGatewayResult> = {
  canHandleEvent(event: unknown): event is APIGatewayEvent {
    return canHandleV2Event(event) || canHandleV1Event(event);
  },

  normalize(event: APIGatewayEvent): NormalizedHTTPEvent {
    if (isV2Event(event)) {
      return apiGatewayV2Adapter.normalize(event);
    }
    return apiGatewayV1Adapter.normalize(event);
  },

  buildResult(response: FinalizedHTTPResponse, event: APIGatewayEvent): APIGatewayResult {
    if (isV2Event(event)) {
      return apiGatewayV2Adapter.buildResult(response, event);
    }
    return apiGatewayV1Adapter.buildResult(response, event);
  },
};
