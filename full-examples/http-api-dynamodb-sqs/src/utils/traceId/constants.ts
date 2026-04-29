// Top-level item attribute used to carry the writer's X-Ray trace header to stream consumers.
// Underscore prefix flags it as plumbing/reserved.
export const TRACE_FIELD = '_xrayTraceId';

export const UPDATE_NAME_PLACEHOLDER = `#_${TRACE_FIELD}`;
export const UPDATE_VALUE_PLACEHOLDER = `:${TRACE_FIELD}Val`;
