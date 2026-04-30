import type { Tracer } from '@aws-lambda-powertools/tracer';
import { isObject } from '@lambda-event-router/base';
import { Segment, type Subsegment } from 'aws-xray-sdk-core';

import { parseTraceHeader } from './parseTraceHeader.js';

interface SegmentTraceContext {
  traceId: string;
  segmentId: string;
  notTraced: boolean;
}

// Subsegment doesn't declare trace_id in its public TS interface (only Segment does), even though
// the X-Ray SDK reads trace_id off the parent Segment when stitching async hops. Read defensively
// without a type assertion: re-narrow via isObject so trace_id is `unknown`.
function readSegmentTraceContext(segment: Segment | Subsegment | undefined): SegmentTraceContext | undefined {
  if (!(segment && isObject(segment))) return undefined;
  const segmentId = segment.id;
  if (typeof segmentId !== 'string') return undefined;

  let traceId: string | undefined;
  if (typeof segment.trace_id === 'string') {
    traceId = segment.trace_id;
  } else if (isObject(segment.segment) && typeof segment.segment.trace_id === 'string') {
    traceId = segment.segment.trace_id;
  }
  if (!traceId) return undefined;

  const notTraced = typeof segment.notTraced === 'boolean' ? segment.notTraced : false;
  return { traceId, segmentId, notTraced };
}

export function buildHeaderFromSegment(segment: Segment | Subsegment | undefined): string | undefined {
  const ctx = readSegmentTraceContext(segment);
  if (!ctx) return undefined;
  return `Root=${ctx.traceId};Parent=${ctx.segmentId};Sampled=${ctx.notTraced ? '0' : '1'}`;
}

export interface OpenedBridgedSegment {
  segment: Segment;
  previousSegment: Segment | Subsegment | undefined;
}

// Bridge into the upstream trace by emitting a NEW top-level Segment with the upstream's
// trace_id and parent_id. Subsegments don't relocate across traces in X-Ray (they're filed under
// their containing segment's trace_id), so a subsegment with an overridden trace_id never reaches
// the upstream trace. A separate Segment, closed independently, is delivered to the X-Ray daemon
// as its own document and gets filed under the upstream trace_id.
//
// AWS Lambda commits the *primary* segment's sampling decision before user code runs. The bridged
// segment is independent: its notTraced flag is taken from upstream's Sampled value, so a
// stream/SQS-triggered invocation can emit a sampled bridged segment even when its primary is
// unsampled.
export function openBridgedSegmentWithUpstream(
  tracer: Tracer,
  name: string,
  upstreamHeader: string | undefined,
): OpenedBridgedSegment | undefined {
  const upstream = parseTraceHeader(upstreamHeader);
  if (!upstream) return undefined;

  const previousSegment = tracer.getSegment();
  const segment = new Segment(name, upstream.root, upstream.parent);
  if (upstream.sampled === '0') segment.notTraced = true;

  tracer.setSegment(segment);

  return { segment, previousSegment };
}

export function closeBridgedSegment(tracer: Tracer, opened: OpenedBridgedSegment): void {
  opened.segment.close();
  if (opened.previousSegment) tracer.setSegment(opened.previousSegment);
}
