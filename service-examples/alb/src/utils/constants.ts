// Ports the two ALB listeners sit on. The target group behind each one decides which event form
// the load balancer sends, so the stack and the trigger have to agree on both.
export const SINGLE_VALUE_LISTENER_PORT = 80;
export const MULTI_VALUE_LISTENER_PORT = 8080;

// A caller names the desks it wants by repeating this header, so the handlers read it from the
// multi-value map as well as the flat one.
export const DESK_HEADER = 'x-desk';

// The route middleware on GET /carriers/:carrierId/returns reads this.
export const DESK_ROLE_HEADER = 'x-desk-role';
export const RETURNS_DESK_ROLE = 'returns-desk';

// The freeze middleware on PUT /returns/:returnId/note reads this.
export const DESK_STATE_HEADER = 'x-desk-state';
export const DESK_CLOSED = 'closed';

// The custom filter on PATCH /returns/:returnId reads this.
export const CHANNEL_HEADER = 'x-channel';
export const RETURNS_DESK_CHANNEL = 'returns-desk';

// Any origin under this suffix is allowed by the CORS origin function.
export const ALLOWED_ORIGIN_SUFFIX = '.returns.example';

export const RETURN_VERSION_HEADER = 'x-return-version';
