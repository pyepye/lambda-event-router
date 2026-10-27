import { createKinesisMatcher } from '@latcher/kinesis';

import { flagHighValueOrder } from './handlers/flagHighValueOrder.js';
import { processOrder } from './handlers/processOrder.js';
import { quarantineDevice } from './handlers/quarantineDevice.js';
import { recordDeviceReading } from './handlers/recordDeviceReading.js';
import { logRecord } from './middleware/logRecord.js';

export const kinesisMatcher = createKinesisMatcher({
  batchItemFailures: true,
  middleware: [logRecord],
});

// Order matters twice. flagHighValueOrder's custom filter must win over processOrder's partition key,
// and quarantineDevice's partition key must win over recordDeviceReading, which matches the whole
// telemetry stream.
kinesisMatcher.route(flagHighValueOrder).route(processOrder).route(quarantineDevice).route(recordDeviceReading);
