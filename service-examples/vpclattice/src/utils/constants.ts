// Ports the two Lattice listeners sit on. The port is the only thing that decides which payload
// version the target group sends, so the stack and the caller have to agree on both.
export const V1_LISTENER_PORT = 80;
export const V2_LISTENER_PORT = 8080;

// The service is signed for as vpc-lattice-svcs, not as vpc-lattice.
export const SIGNING_SERVICE = 'vpc-lattice-svcs';

// A caller names the depots it wants by repeating this header, so the handlers read it from the
// multi-value map as well as the flat one.
export const DEPOT_HEADER = 'x-depot';

// The freeze middleware on PUT /stock/:sku reads this.
export const STOCKTAKE_HEADER = 'x-stocktake';
export const STOCKTAKE_FROZEN = 'frozen';

// The custom filter on PATCH /stock/:sku reads this.
export const CHANNEL_HEADER = 'x-channel';
export const WAREHOUSE_FLOOR_CHANNEL = 'warehouse-floor';

// Any origin under this suffix is allowed by the CORS origin function.
export const ALLOWED_ORIGIN_SUFFIX = '.warehouse.internal';

export const STOCK_VERSION_HEADER = 'x-stock-version';
