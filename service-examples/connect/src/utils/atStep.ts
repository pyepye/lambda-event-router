import type { ConnectFilterInput } from '@latcher/connect';

import { STEP_PARAMETER } from './constants.js';

// A custom filter over the `step` parameter the flow sets on each Invoke AWS Lambda function block.
export function atStep(step: string): (input: ConnectFilterInput) => boolean {
  return ({ event }) => event.Details.Parameters[STEP_PARAMETER] === step;
}
