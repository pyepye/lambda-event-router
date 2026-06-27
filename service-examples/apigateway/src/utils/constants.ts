// Bearer tokens the REST API's TOKEN authorizer recognises. Each one takes a different branch.
export const STAFF_TOKEN = 'staff-4821';
export const EXPIRED_TOKEN = 'expired-1907';
export const REVOKED_TOKEN = 'revoked-3355';
export const SIMPLE_MODE_TOKEN = 'simple-6640';

// Bearer tokens the HTTP API's two authorizers recognise.
export const SERVICE_TOKEN = 'service-7710';
export const RETIRED_SERVICE_TOKEN = 'retired-8802';

// Methods the read-only authorizer route matches through its custom filter.
export const READ_METHODS = ['GET', 'HEAD'];

// The REST API's REQUEST authorizer reads the staff id, and requireDispatchRole reads the role.
export const STAFF_ID_HEADER = 'x-staff-id';
export const STAFF_ROLE_HEADER = 'x-staff-role';
export const DISPATCH_ROLE = 'dispatcher';

// The custom filter on PATCH /orders/:orderId reads this.
export const CHANNEL_HEADER = 'x-channel';
export const WAREHOUSE_FLOOR_CHANNEL = 'warehouse-floor';

// Any origin under this suffix is allowed by the CORS origin function.
export const ALLOWED_ORIGIN_SUFFIX = '.warehouse.example';

// WebSocket route keys with this prefix reach runAdminCommand through its custom filter.
export const ADMIN_ROUTE_KEY_PREFIX = 'admin';
