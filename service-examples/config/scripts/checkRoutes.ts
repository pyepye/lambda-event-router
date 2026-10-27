import type { Context } from 'aws-lambda';

const STACK = 'ler-example-config';
const ACCOUNT = '123456789012';
const OTHER_ACCOUNT = '210987654321';
const REGION = 'eu-west-2';

// environment.ts reads these once, at import, and throws when either is missing. The logger builds
// itself on the first call. Both have to be settled before the matcher loads.
process.env.AWS_LAMBDA_LOG_FORMAT = 'JSON';
process.env.STACK_NAME = STACK;
process.env.ACCOUNT_ID = ACCOUNT;

const { fleetFunctionName, RULE_PARAMETERS, ruleName } = await import('../src/config.js');
const { configServiceClient } = await import('../src/environment.js');
const { configMatcher } = await import('../src/configMatcher.js');
const { configScheduledMatcher } = await import('../src/configScheduledMatcher.js');
const { handler } = await import('../src/index.js');

type TRule = Parameters<typeof ruleName>[1];

const CHECKOUT_API = fleetFunctionName(STACK, 'checkoutApi');
const REPORT_BUILDER = fleetFunctionName(STACK, 'reportBuilder');

const context = {
  functionName: `${STACK}-worker`,
  awsRequestId: 'check-routes',
  invokedFunctionArn: `arn:aws:lambda:${REGION}:${ACCOUNT}:function:${STACK}-worker`,
  getRemainingTimeInMillis: () => 10_000,
} as unknown as Context;

interface SentCommand {
  command: string;
  input: Record<string, unknown>;
}

const sent: SentCommand[] = [];

// Handlers call PutEvaluations and ListDiscoveredResources. Record the calls instead of making them.
configServiceClient.send = (async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
  sent.push({ command: command.constructor.name, input: command.input });
  if (command.constructor.name === 'ListDiscoveredResourcesCommand') {
    return { resourceIdentifiers: [{ resourceId: CHECKOUT_API }, { resourceId: REPORT_BUILDER }, { resourceId: 'x' }] };
  }
  return {};
}) as unknown as typeof configServiceClient.send;

interface LambdaResource {
  functionName: string;
  runtime: string;
  memorySize: number;
  timeout: number;
  description?: string;
  tags: Record<string, string>;
}

const checkoutApi: LambdaResource = {
  functionName: CHECKOUT_API,
  runtime: 'nodejs22.x',
  memorySize: 256,
  timeout: 10,
  description: 'Takes card payments at checkout',
  tags: { 'compliance-scope': STACK, owner: 'payments' },
};

const reportBuilder: LambdaResource = {
  functionName: REPORT_BUILDER,
  runtime: 'python3.12',
  memorySize: 2048,
  timeout: 60,
  tags: { 'compliance-scope': STACK, 'data-classification': 'confidential' },
};

const decommissioned: LambdaResource = { ...checkoutApi, functionName: 'legacy-invoice-export' };

function ruleEvent(rule: TRule, invokingEvent: Record<string, unknown>, accountId = ACCOUNT): Record<string, unknown> {
  const parameters = (RULE_PARAMETERS as Record<string, Record<string, string>>)[rule];
  return {
    version: '1.0',
    invokingEvent: JSON.stringify(invokingEvent),
    ...(parameters ? { ruleParameters: JSON.stringify(parameters) } : {}),
    resultToken: `token-${rule}`,
    eventLeftScope: false,
    executionRoleArn: `arn:aws:iam::${accountId}:role/config-recorder`,
    configRuleArn: `arn:aws:config:${REGION}:${accountId}:config-rule/config-rule-abc123`,
    configRuleName: ruleName(STACK, rule),
    configRuleId: 'config-rule-abc123',
    accountId,
    evaluationMode: 'DETECTIVE',
  };
}

interface ChangeOptions {
  status?: string;
  resourceType?: string;
  oversized?: boolean;
}

function changeEvent(rule: TRule, resource: LambdaResource, options: ChangeOptions = {}): Record<string, unknown> {
  const resourceType = options.resourceType ?? 'AWS::Lambda::Function';
  const status = options.status ?? 'OK';
  const arn = `arn:aws:lambda:${REGION}:${ACCOUNT}:function:${resource.functionName}`;

  if (options.oversized) {
    return ruleEvent(rule, {
      messageType: 'OversizedConfigurationItemChangeNotification',
      configurationItemSummary: {
        changeType: 'UPDATE',
        configurationItemVersion: '1.3',
        configurationItemCaptureTime: '2026-09-24T10:00:00.000Z',
        configurationStateId: 1790244000000,
        awsAccountId: ACCOUNT,
        configurationItemStatus: status,
        resourceType,
        resourceId: resource.functionName,
        resourceName: resource.functionName,
        ARN: arn,
        awsRegion: REGION,
        availabilityZone: 'Not Applicable',
        configurationStateMd5Hash: '',
        resourceCreationTime: null,
        configurationItemDeliveryTime: null,
        recordingFrequency: null,
      },
      s3DeliverySummary: null,
      notificationCreationTime: '2026-09-24T10:00:01.000Z',
      recordVersion: '1.0',
    });
  }

  // A deleted item carries no configuration, no tags and no availability zone
  const deleted = status === 'ResourceDeleted';

  return ruleEvent(rule, {
    messageType: 'ConfigurationItemChangeNotification',
    configurationItemDiff: null,
    configurationItem: {
      relatedEvents: [],
      relationships: [],
      configuration: deleted
        ? null
        : {
            functionName: resource.functionName,
            functionArn: arn,
            runtime: resource.runtime,
            memorySize: resource.memorySize,
            timeout: resource.timeout,
            description: resource.description ?? '',
          },
      supplementaryConfiguration: {},
      tags: deleted ? {} : resource.tags,
      configurationItemVersion: '1.3',
      configurationItemCaptureTime: '2026-09-24T10:00:00.000Z',
      configurationStateId: 1790244000000,
      awsAccountId: ACCOUNT,
      configurationItemStatus: status,
      resourceType,
      resourceId: resource.functionName,
      resourceName: resource.functionName,
      ARN: arn,
      awsRegion: REGION,
      availabilityZone: deleted ? null : 'Not Applicable',
      configurationStateMd5Hash: '',
      resourceCreationTime: null,
      configurationItemDeliveryTime: null,
      recordingFrequency: null,
    },
    notificationCreationTime: '2026-09-24T10:00:01.000Z',
    recordVersion: '1.3',
  });
}

function scheduledEvent(rule: TRule, accountId = ACCOUNT): Record<string, unknown> {
  return ruleEvent(
    rule,
    {
      awsAccountId: accountId,
      notificationCreationTime: '2026-09-24T10:00:00.000Z',
      messageType: 'ScheduledNotification',
      recordVersion: '1.0',
    },
    accountId,
  );
}

interface Check {
  name: string;
  event: Record<string, unknown>;
  expected: {
    logIncludes?: string[];
    evaluation?: string[];
    errorIncludes?: string;
  };
}

const checks: Check[] = [
  {
    name: 'an approved runtime reaches checkRuntime and reports COMPLIANT',
    event: changeEvent('approvedRuntime', checkoutApi),
    expected: {
      logIncludes: ['Handling configuration change', 'Evaluation reported'],
      evaluation: ['"ComplianceType":"COMPLIANT"', 'nodejs22.x is approved', CHECKOUT_API],
    },
  },
  {
    name: 'an unapproved runtime reaches checkRuntime and reports NON_COMPLIANT',
    event: changeEvent('approvedRuntime', reportBuilder),
    expected: {
      evaluation: ['"ComplianceType":"NON_COMPLIANT"', 'python3.12 is not one of nodejs22.x, python3.13'],
    },
  },
  {
    name: 'a newly discovered function passes the configurationItemStatus filter',
    event: changeEvent('approvedRuntime', checkoutApi, { status: 'ResourceDiscovered' }),
    expected: { evaluation: ['"ComplianceType":"COMPLIANT"'] },
  },
  {
    name: 'a deleted function fails the configurationItemStatus filter and matches no route',
    event: changeEvent('approvedRuntime', checkoutApi, { status: 'ResourceDeleted' }),
    expected: { errorIncludes: `No route matched for config rule ${STACK}-approved-runtime` },
  },
  {
    name: 'a resource that is not a Lambda function fails the resourceType filter',
    event: changeEvent('approvedRuntime', checkoutApi, { resourceType: 'AWS::S3::Bucket' }),
    expected: { errorIncludes: `No route matched for config rule ${STACK}-approved-runtime` },
  },
  {
    name: 'an oversized item reaches checkRuntime, skips the configuration schema and reports NOT_APPLICABLE',
    event: changeEvent('approvedRuntime', checkoutApi, { oversized: true }),
    expected: {
      logIncludes: ['OversizedConfigurationItemChangeNotification'],
      evaluation: ['"ComplianceType":"NOT_APPLICABLE"', 'Configuration item too large to evaluate'],
    },
  },
  {
    name: 'checkout-api reaches checkMemoryLimit with maxMemoryMb coerced to a number',
    event: changeEvent('memoryLimit', checkoutApi),
    expected: { evaluation: ['"ComplianceType":"COMPLIANT"', '256 MB is within the 1024 MB limit'] },
  },
  {
    name: 'report-builder reaches grantMemoryExemption, which ranks ahead of checkMemoryLimit',
    event: changeEvent('memoryLimit', reportBuilder),
    expected: { evaluation: ['"ComplianceType":"NOT_APPLICABLE"', 'Exempt from the memory limit until 2027-03-31'] },
  },
  {
    name: 'checkout-api passes the custom filter and is registered in the catalogue',
    event: changeEvent('serviceCatalogue', checkoutApi),
    expected: {
      logIncludes: ['Registered in service catalogue', 'Takes card payments at checkout'],
      evaluation: ['"ComplianceType":"COMPLIANT"', 'Registered in the service catalogue'],
    },
  },
  {
    name: 'report-builder has no description and fails the configuration schema',
    event: changeEvent('serviceCatalogue', reportBuilder),
    expected: { errorIncludes: 'Schema validation failed for configuration' },
  },
  {
    name: 'a decommissioned function fails the custom filter and matches no route',
    event: changeEvent('serviceCatalogue', decommissioned),
    expected: { errorIncludes: `No route matched for config rule ${STACK}-service-catalogue` },
  },
  {
    name: 'the timeout rule fails its ruleParameters schema',
    event: changeEvent('timeoutLimit', checkoutApi),
    expected: { errorIncludes: 'Schema validation failed for ruleParameters' },
  },
  {
    name: 'the on-call rota route runs its middleware and then throws',
    event: changeEvent('onCallRota', checkoutApi),
    expected: {
      logIncludes: ['Handling configuration change', 'Owner resolved', '"owner":"payments"'],
      errorIncludes: 'On-call directory unavailable for team payments',
    },
  },
  {
    name: 'the confidential tracing rule has no route',
    event: changeEvent('confidentialTracing', reportBuilder),
    expected: { errorIncludes: `No route matched for config rule ${STACK}-confidential-tracing` },
  },
  {
    name: 'the inventory rule reaches recordFunctionInventory with maxFunctions coerced to a number',
    event: scheduledEvent('lambdaInventory'),
    expected: {
      logIncludes: ['Handling scheduled evaluation', 'Account context resolved', '"maxFunctions":200'],
      evaluation: ['"ComplianceType":"COMPLIANT"', 'AWS::::Account', '3 of at most 200 Lambda functions recorded'],
    },
  },
  {
    name: 'the inventory rule from another account fails the accountId filter',
    event: scheduledEvent('lambdaInventory', OTHER_ACCOUNT),
    expected: { errorIncludes: `No route matched for scheduled config rule ${STACK}-lambda-inventory` },
  },
  {
    name: 'the idle sweep passes its custom filter and fails its ruleParameters schema',
    event: scheduledEvent('idleFunctionSweep'),
    expected: { errorIncludes: 'Schema validation failed for ruleParameters' },
  },
  {
    name: 'the concurrency route runs the matcher middleware and then throws',
    event: scheduledEvent('concurrencyHeadroom'),
    expected: {
      logIncludes: ['Handling scheduled evaluation'],
      errorIncludes: `Concurrency metrics unavailable for account ${ACCOUNT}`,
    },
  },
  {
    name: 'the cost report rule has no scheduled route',
    event: scheduledEvent('costReport'),
    expected: { errorIncludes: `No route matched for scheduled config rule ${STACK}-cost-report` },
  },
];

// Handlers report by logging and by the command they send. Both are captured.
async function runCapturingLogs(event: Record<string, unknown>): Promise<{ logged: string; error?: unknown }> {
  const lines: string[] = [];
  const collect = (...args: unknown[]): void => {
    lines.push(JSON.stringify(args));
  };

  const { log, info, debug, warn, error } = console;
  Object.assign(console, { log: collect, info: collect, debug: collect, warn: collect, error: collect });

  try {
    await handler(event, context, () => {});
    return { logged: lines.join('\n') };
  } catch (thrown) {
    return { logged: lines.join('\n'), error: thrown };
  } finally {
    Object.assign(console, { log, info, debug, warn, error });
  }
}

function problemsWith(logged: string, error: unknown, expected: Check['expected']): string[] {
  const problems: string[] = [];
  const evaluations = sent
    .filter((call) => call.command === 'PutEvaluationsCommand')
    .map((call) => JSON.stringify(call.input))
    .join('\n');

  if (expected.errorIncludes) {
    const message = error instanceof Error ? error.message : String(error);
    if (error === undefined) {
      problems.push(`did not throw, logged ${logged.slice(0, 200)}`);
    } else if (!message.includes(expected.errorIncludes)) {
      problems.push(`threw ${message}`);
    }
    if (evaluations) problems.push(`reported ${evaluations}`);
  } else if (error !== undefined) {
    problems.push(`threw ${error instanceof Error ? error.message : String(error)}`);
  }

  problems.push(
    ...(expected.logIncludes ?? [])
      .filter((fragment) => !logged.includes(fragment))
      .map((fragment) => `logged nothing containing ${fragment}`),
  );

  problems.push(
    ...(expected.evaluation ?? [])
      .filter((fragment) => !evaluations.includes(fragment))
      .map((fragment) => `reported ${evaluations || 'nothing'} rather than ${fragment}`),
  );

  return problems;
}

const failures: string[] = [];

function report(label: string, problems: string[]): void {
  if (problems.length === 0) {
    console.log(`ok   ${label}`);
    return;
  }
  failures.push(label);
  console.log(`FAIL ${label}: ${problems.join(', ')}`);
}

for (const check of checks) {
  sent.length = 0;
  const { logged, error } = await runCapturingLogs(check.event);
  report(check.name, problemsWith(logged, error, check.expected));
}

const change = changeEvent('approvedRuntime', checkoutApi);
const oversized = changeEvent('approvedRuntime', checkoutApi, { oversized: true });
const scheduled = scheduledEvent('lambdaInventory');
const sqs = { Records: [{ eventSource: 'aws:sqs' }] };

const claims: [string, boolean][] = [
  ['the change matcher takes a change notification', configMatcher.canHandleEvent(change)],
  ['the change matcher takes an oversized notification', configMatcher.canHandleEvent(oversized)],
  ['the change matcher turns a scheduled notification away', !configMatcher.canHandleEvent(scheduled)],
  ['the scheduled matcher takes a scheduled notification', configScheduledMatcher.canHandleEvent(scheduled)],
  ['the scheduled matcher turns a change notification away', !configScheduledMatcher.canHandleEvent(change)],
  [
    'neither matcher takes an SQS event',
    !(configMatcher.canHandleEvent(sqs) || configScheduledMatcher.canHandleEvent(sqs)),
  ],
];

for (const [label, held] of claims) {
  report(label, held ? [] : ['did not hold']);
}

console.log(
  failures.length === 0 ? '\nEvery event landed where it was meant to.' : `\n${failures.length} check(s) failed.`,
);

if (failures.length > 0) process.exitCode = 1;
