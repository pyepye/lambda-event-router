import { SFNClient } from '@aws-sdk/client-sfn';

export const sfnClient = new SFNClient();

// Task names are fixed strings rather than CDK-generated ones, so the route filters and the state
// machine payloads share one source.
export const RESERVE_STOCK_TASK = 'reserve-stock';
export const CHARGE_PAYMENT_TASK = 'charge-payment';
export const FRAUD_REVIEW_TASK = 'fraud-review';
export const RELEASE_STOCK_HOLD_TASK = 'release-stock-hold';
export const MANUAL_RELEASE_TASK = 'manual-release';
export const RECONCILE_LEDGER_TASK = 'reconcile-ledger';

// The trigger script looks the state machine up by this name, so it needs no deploy output.
export const STATE_MACHINE_NAME = 'ler-example-stepfunctions-orders';
