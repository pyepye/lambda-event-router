// Values the stack, the worker and the scripts all need. The CDK stack imports this file, so nothing
// here may read the worker's environment.

// Every rule is named `<stackName>-<suffix>`, so the stack and the route filters share one source.
export const RULES = {
  approvedRuntime: 'approved-runtime',
  memoryLimit: 'memory-limit',
  serviceCatalogue: 'service-catalogue',
  timeoutLimit: 'timeout-limit',
  onCallRota: 'on-call-rota',
  confidentialTracing: 'confidential-tracing',
  lambdaInventory: 'lambda-inventory',
  idleFunctionSweep: 'idle-function-sweep',
  concurrencyHeadroom: 'concurrency-headroom',
  costReport: 'cost-report',
} as const;

export type TRule = keyof typeof RULES;

export function ruleName(stackName: string, rule: TRule): string {
  return `${stackName}-${RULES[rule]}`;
}

// Config passes these to the worker as the event's ruleParameters. `15m` and `ninety` fail their
// schemas on purpose.
export const RULE_PARAMETERS = {
  approvedRuntime: { allowedRuntimes: 'nodejs22.x,python3.13' },
  memoryLimit: { maxMemoryMb: '1024' },
  timeoutLimit: { maxTimeoutSeconds: '15m' },
  lambdaInventory: { maxFunctions: '200' },
  idleFunctionSweep: { maxIdleDays: 'ninety' },
} as const;

// The two functions the change-triggered rules evaluate.
export const FLEET = {
  checkoutApi: 'checkout-api',
  reportBuilder: 'report-builder',
} as const;

export function fleetFunctionName(stackName: string, fn: keyof typeof FLEET): string {
  return `${stackName}-${FLEET[fn]}`;
}

export const COMPLIANCE_SCOPE_TAG = 'compliance-scope';
export const OWNER_TAG = 'owner';
export const DATA_CLASSIFICATION_TAG = 'data-classification';
