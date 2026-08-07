import {
  ConfigServiceClient,
  DescribeConfigRuleEvaluationStatusCommand,
  GetResourceConfigHistoryCommand,
  LimitExceededException,
  ResourceNotDiscoveredException,
  StartConfigRulesEvaluationCommand,
} from '@aws-sdk/client-config-service';
import { GetFunctionConfigurationCommand, LambdaClient } from '@aws-sdk/client-lambda';

import { FLEET, fleetFunctionName, RULES, ruleName, type TRule } from '../src/config.js';

const stackName = process.argv[2] ?? 'ler-example-config';

// A client with no region fails at the point of use rather than at construction, so check here.
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

if (!region) {
  throw new Error('Set AWS_REGION to the region the stack is deployed in');
}

const client = new ConfigServiceClient({ region });
const lambdaClient = new LambdaClient({ region });
const ruleNames = (Object.keys(RULES) as TRule[]).map((rule) => ruleName(stackName, rule));

const RECORDING_TIMEOUT_MS = 30 * 60_000;
const RECORDING_POLL_MS = 30_000;
const TIMEOUT_MS = 10 * 60_000;
const REASK_AFTER_MS = 90_000;
const START_RETRY_MS = 20_000;
const POLL_MS = 10_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function recordedLastModified(functionName: string): Promise<string | undefined> {
  try {
    const { configurationItems = [] } = await client.send(
      new GetResourceConfigHistoryCommand({
        resourceType: 'AWS::Lambda::Function',
        resourceId: functionName,
        limit: 1,
      }),
    );
    const configuration = configurationItems[0]?.configuration;
    return configuration ? (JSON.parse(configuration) as { lastModified?: string }).lastModified : undefined;
  } catch (error) {
    if (error instanceof ResourceNotDiscoveredException) return undefined;
    throw error;
  }
}

// On a redeploy that reuses a function name, Config can take 20 minutes to record the new function,
// and can first send an item for the old one. An evaluation before then skips or misjudges it.
async function waitForRecording(): Promise<void> {
  const deadline = Date.now() + RECORDING_TIMEOUT_MS;
  const functionNames = (Object.keys(FLEET) as (keyof typeof FLEET)[]).map((fn) => fleetFunctionName(stackName, fn));

  for (;;) {
    const unrecorded: string[] = [];
    for (const functionName of functionNames) {
      const deployed = await lambdaClient.send(new GetFunctionConfigurationCommand({ FunctionName: functionName }));
      const recorded = await recordedLastModified(functionName);
      if (!(recorded && deployed.LastModified && Date.parse(recorded) === Date.parse(deployed.LastModified))) {
        unrecorded.push(functionName);
      }
    }

    if (unrecorded.length === 0) return;
    if (Date.now() > deadline) {
      throw new Error(`Config has not recorded the deployed ${unrecorded.join(', ')}`);
    }
    console.log(`Waiting for Config to record the deployed ${unrecorded.join(', ')}.`);
    await sleep(RECORDING_POLL_MS);
  }
}

async function lastInvocations(): Promise<Map<string, number>> {
  const { ConfigRulesEvaluationStatus = [] } = await client.send(
    new DescribeConfigRuleEvaluationStatusCommand({ ConfigRuleNames: ruleNames }),
  );
  return new Map(
    ConfigRulesEvaluationStatus.map((status) => [
      status.ConfigRuleName ?? '',
      status.LastSuccessfulInvocationTime?.getTime() ?? 0,
    ]),
  );
}

// Config refuses a new evaluation while the last one is still running, or when asked twice inside a
// minute. Retrying lets two runs go back to back.
// Each rule's last invocation is read just before the attempt that succeeds. The wait below compares
// against it rather than the local clock, so clock skew cannot hide an invocation.
async function startEvaluation(names: string[]): Promise<{ startedAt: number; before: Map<string, number> }> {
  const deadline = Date.now() + TIMEOUT_MS;

  for (;;) {
    const before = await lastInvocations();
    const startedAt = Date.now();
    try {
      await client.send(new StartConfigRulesEvaluationCommand({ ConfigRuleNames: names }));
      return { startedAt, before };
    } catch (error) {
      if (!(error instanceof LimitExceededException) || Date.now() > deadline) throw error;
      console.log('Config is still busy with the last evaluation. Retrying in 20 seconds.');
      await sleep(START_RETRY_MS);
    }
  }
}

await waitForRecording();
const { startedAt, before } = await startEvaluation(ruleNames);
console.log(`Started an evaluation of ${ruleNames.length} rules.`);

const deadline = Date.now() + TIMEOUT_MS;
let askedAt = Date.now();
let pending = ruleNames;

// A change-triggered rule that Config has just evaluated for a newly recorded item can accept the
// request and still not run. Asking again for the rules still pending gets them run.
while (pending.length > 0 && Date.now() < deadline) {
  await sleep(POLL_MS);
  const after = await lastInvocations();
  pending = pending.filter((name) => (after.get(name) ?? 0) <= (before.get(name) ?? 0));

  if (pending.length > 0 && Date.now() - askedAt > REASK_AFTER_MS) {
    console.log(`Asking Config again for ${pending.join(', ')}.`);
    await startEvaluation(pending);
    askedAt = Date.now();
  }
}

if (pending.length > 0) {
  throw new Error(`Config has not invoked the worker for ${pending.join(', ')}`);
}

console.log(`Config has invoked the worker for every rule. Log start time: ${startedAt}`);
console.log('Failed evaluations retry for about 3 more minutes. Wait 5 minutes before exporting the log.');
