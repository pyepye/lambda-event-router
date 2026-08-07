import { ConfigServiceClient } from '@aws-sdk/client-config-service';

import { fleetFunctionName, ruleName, type TRule } from './config.js';

// An absent value would leave a filter as an empty string, which the router reads as no filter at
// all. Failing at cold start is louder.
function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set on this function`);
  }
  return value;
}

const STACK_NAME = requiredEnvironment('STACK_NAME');

// The accountId filter on the inventory route matches against this. CDK injects it on the worker.
export const ACCOUNT_ID = requiredEnvironment('ACCOUNT_ID');

export const REPORT_BUILDER_FUNCTION_NAME = fleetFunctionName(STACK_NAME, 'reportBuilder');

export function configRuleName(rule: TRule): string {
  return ruleName(STACK_NAME, rule);
}

// Handlers report their results through this client. Sharing it from here lets the route check swap
// it for a recorder.
export const configServiceClient = new ConfigServiceClient();
