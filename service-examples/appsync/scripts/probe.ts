import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';

import {
  PROBE_BARE_CHANNEL,
  PROBE_BOTH_CHANNEL,
  PROBE_BOTH_TOP_CHANNEL,
  PROBE_EMPTY_CHANNEL,
  PROBE_EMPTY_LIST_CHANNEL,
  PROBE_ERROR_ONLY_CHANNEL,
  PROBE_EXTRA_ENTRY_CHANNEL,
  PROBE_EXTRA_TOP_CHANNEL,
  PROBE_ID_ONLY_CHANNEL,
  PROBE_NOTHING_CHANNEL,
  PROBE_REFLECT_CHANNEL,
} from '../src/utils/constants.js';

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? process.env.CDK_DEFAULT_REGION;
if (!region) throw new Error('Set AWS_REGION to the region the stack is deployed in.');

const stackName = process.argv[2] ?? 'ler-example-appsync';

const cloudFormation = new CloudFormationClient({ region });
const { Stacks } = await cloudFormation.send(new DescribeStacksCommand({ StackName: stackName }));
const outputs = new Map((Stacks?.[0]?.Outputs ?? []).map((entry) => [entry.OutputKey, entry.OutputValue]));

function output(key: string): string {
  const value = outputs.get(key);
  if (!value) throw new Error(`Stack ${stackName} has no output ${key}. Deploy it first.`);
  return value;
}

const activityHttpDns = output('ActivityApiHttpDns');
const activityApiKey = output('ActivityApiKey');

// Each entry goes on the wire exactly as written, so a case can send something that is not valid JSON.
async function publishRaw(question: string, channel: string, events: string[]): Promise<void> {
  const response = await fetch(`https://${activityHttpDns}/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': activityApiKey },
    body: JSON.stringify({ channel, events }),
  });

  const body = await response.text();

  console.log(`\n=== ${question}`);
  console.log(`channel  ${channel}`);
  console.log(`sent     ${events.join('  |  ')}`);
  console.log(`status   ${response.status}`);
  console.log(`body     ${body}`);
}

await publishRaw('Does an object payload arrive as an object?', PROBE_REFLECT_CHANNEL, ['{"a":1}']);

await publishRaw('Do JSON values that are not objects reach the handler?', PROBE_REFLECT_CHANNEL, [
  '42',
  '"hello"',
  '[1,2]',
  'null',
  'true',
]);

await publishRaw('What happens to an event that is not valid JSON?', PROBE_REFLECT_CHANNEL, ['not json at all']);

await publishRaw('Which wins when one entry carries both a payload and an error?', PROBE_BOTH_CHANNEL, ['{"a":1}']);

await publishRaw('Is a bare array accepted instead of { events }?', PROBE_BARE_CHANNEL, ['{"a":1}']);

await publishRaw('Is an empty object accepted?', PROBE_EMPTY_CHANNEL, ['{"a":1}']);

await publishRaw('Is returning nothing accepted?', PROBE_NOTHING_CHANNEL, ['{"a":1}']);

await publishRaw('Is an empty events list accepted?', PROBE_EMPTY_LIST_CHANNEL, ['{"a":1}']);

await publishRaw('Is an unknown field on an entry rejected?', PROBE_EXTRA_ENTRY_CHANNEL, ['{"a":1}']);

await publishRaw('Is an unknown field at the top level rejected?', PROBE_EXTRA_TOP_CHANNEL, ['{"a":1}']);

await publishRaw('Is a top level error on its own accepted?', PROBE_ERROR_ONLY_CHANNEL, ['{"a":1}']);

await publishRaw('Are events and a top level error accepted together?', PROBE_BOTH_TOP_CHANNEL, ['{"a":1}']);

await publishRaw('Is an entry with an id and nothing else accepted?', PROBE_ID_ONLY_CHANNEL, ['{"a":1}']);
