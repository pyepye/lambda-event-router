import { randomUUID } from 'node:crypto';

import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { LexRuntimeV2Client, RecognizeTextCommand } from '@aws-sdk/client-lex-runtime-v2';

import type { ConversationStep } from '../src/conversation/steps.js';
import { conversationSteps } from '../src/conversation/steps.js';

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? process.env.CDK_DEFAULT_REGION;
if (!region) throw new Error('Set AWS_REGION to the region the stack is deployed in.');

const stackName = process.argv[2] ?? 'ler-example-lex';

const cloudFormation = new CloudFormationClient({ region });
const { Stacks } = await cloudFormation.send(new DescribeStacksCommand({ StackName: stackName }));
const outputs = new Map((Stacks?.[0]?.Outputs ?? []).map((entry) => [entry.OutputKey, entry.OutputValue]));

function output(key: string): string {
  const value = outputs.get(key);
  if (!value) throw new Error(`Stack ${stackName} has no output ${key}. Deploy it first.`);
  return value;
}

const botId = output('BotId');
const botAliasId = output('BotAliasId');
const localeId = output('LocaleId');

const lex = new LexRuntimeV2Client({ region });

// A fresh session per conversation per run, so a second run does not continue the first one's dialog.
const runId = randomUUID().slice(0, 8);
const sessionIds = new Map<string, string>();

function sessionIdFor(conversation: string): string {
  const existing = sessionIds.get(conversation);
  if (existing) return existing;
  const created = `${conversation}-${runId}`;
  sessionIds.set(conversation, created);
  return created;
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

async function run(step: ConversationStep): Promise<void> {
  const response = await lex.send(
    new RecognizeTextCommand({
      botId,
      botAliasId,
      localeId,
      sessionId: sessionIdFor(step.conversation),
      text: step.text,
      ...(step.sessionAttributes ? { sessionState: { sessionAttributes: step.sessionAttributes } } : {}),
    }),
  );

  const messages = (response.messages ?? []).map((message) => message.content ?? '').join(' | ');
  const intent = response.sessionState?.intent;
  const dialogActionType = response.sessionState?.dialogAction?.type;
  const problems: string[] = [];

  const { expected } = step;
  if (expected.messageIncludes && !messages.includes(expected.messageIncludes)) {
    problems.push(`said "${messages}"`);
  }
  if (expected.intentName && intent?.name !== expected.intentName) {
    problems.push(`resolved intent ${intent?.name}`);
  }
  if (expected.intentState && intent?.state !== expected.intentState) {
    problems.push(`intent state ${intent?.state}`);
  }
  if (expected.dialogActionType && dialogActionType !== expected.dialogActionType) {
    problems.push(`dialog action ${dialogActionType}`);
  }

  report(step.name, problems);
}

for (const step of conversationSteps) {
  await run(step);
}

console.log(failures.length === 0 ? '\nEvery turn answered as expected.' : `\n${failures.length} step(s) failed.`);

if (failures.length > 0) process.exitCode = 1;
