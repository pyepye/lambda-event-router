import { setTimeout as sleep } from 'node:timers/promises';

import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import {
  ConnectClient,
  GetContactAttributesCommand,
  StartChatContactCommand,
  StartTaskContactCommand,
} from '@aws-sdk/client-connect';
import { ConnectParticipantClient, CreateParticipantConnectionCommand } from '@aws-sdk/client-connectparticipant';

import { expectedAttributes, expectedTaskAttributes } from '../src/contactFlow/steps.js';
import { FLOW_COMPLETE_ATTRIBUTE, ORDER_REF, ORDER_REF_ATTRIBUTE } from '../src/utils/constants.js';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90_000;

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? process.env.CDK_DEFAULT_REGION;
if (!region) throw new Error('Set AWS_REGION to the region the stack is deployed in.');

const stackName = process.argv[2] ?? 'ler-example-connect';

const cloudFormation = new CloudFormationClient({ region });
const { Stacks } = await cloudFormation.send(new DescribeStacksCommand({ StackName: stackName }));
const outputs = new Map((Stacks?.[0]?.Outputs ?? []).map((entry) => [entry.OutputKey, entry.OutputValue]));

function output(key: string): string {
  const value = outputs.get(key);
  if (!value) throw new Error(`Stack ${stackName} has no output ${key}. Deploy it first.`);
  return value;
}

const instanceId = output('InstanceId');
const contactFlowId = output('ContactFlowId');
const taskFlowId = output('TaskFlowId');

const connect = new ConnectClient({ region });

// The participant service authorises on the chat's own participant token, so it takes no credentials.
const participant = new ConnectParticipantClient({ region });

const failures: string[] = [];

function report(label: string, problems: string[]): void {
  if (problems.length === 0) {
    console.log(`ok   ${label}`);
    return;
  }
  failures.push(label);
  console.log(`FAIL ${label}: ${problems.join(', ')}`);
}

async function waitForFlow(contactId: string): Promise<Record<string, string>> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const { Attributes } = await connect.send(
      new GetContactAttributesCommand({ InstanceId: instanceId, InitialContactId: contactId }),
    );
    if (Attributes?.[FLOW_COMPLETE_ATTRIBUTE] === 'true') return Attributes;
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Contact ${contactId} did not finish the flow within ${POLL_TIMEOUT_MS / 1000} seconds.`);
}

// One chat contact runs the whole flow. Every block is a separate invocation of the worker, so a
// second run needs no teardown.
const { ContactId: chatContactId, ParticipantToken: participantToken } = await connect.send(
  new StartChatContactCommand({
    InstanceId: instanceId,
    ContactFlowId: contactFlowId,
    ParticipantDetails: { DisplayName: 'Ada Lovelace' },
    Attributes: { [ORDER_REF_ATTRIBUTE]: ORDER_REF },
  }),
);

if (!(chatContactId && participantToken)) {
  throw new Error('Connect started the chat without returning a contact id and participant token.');
}

// StartChatContact creates the contact but does not run the flow. The flow starts once the customer
// holds the chat's websocket open, so the trigger stands in for the chat client.
const { Websocket: websocket } = await participant.send(
  new CreateParticipantConnectionCommand({
    ParticipantToken: participantToken,
    Type: ['WEBSOCKET', 'CONNECTION_CREDENTIALS'],
  }),
);

if (!websocket?.Url) throw new Error('Connect returned no websocket for the chat participant.');

const socket = new WebSocket(websocket.Url);
socket.addEventListener('open', () => {
  socket.send(JSON.stringify({ topic: 'aws/subscribe', content: { topics: ['aws/chat'] } }));
});

console.log(`Started chat contact ${chatContactId}`);

const chatAttributes = await waitForFlow(chatContactId);
socket.close();

for (const [key, expected] of Object.entries(expectedAttributes)) {
  const actual = chatAttributes[key];
  report(key, actual === expected ? [] : [`stored ${actual === undefined ? 'nothing' : `"${actual}"`}`]);
}

// A task contact arrives on the TASK channel, which only ConnectChannel carries. It runs a flow of
// its own, because every block of the chat flow filters on a step only a chat reaches.
const { ContactId: taskContactId } = await connect.send(
  new StartTaskContactCommand({
    InstanceId: instanceId,
    ContactFlowId: taskFlowId,
    Name: 'Parcel enquiry',
  }),
);

if (!taskContactId) throw new Error('Connect started the task without returning a contact id.');

console.log(`Started task contact ${taskContactId}`);

const taskAttributes = await waitForFlow(taskContactId);

for (const [key, expected] of Object.entries(expectedTaskAttributes)) {
  const actual = taskAttributes[key];
  report(key, actual === expected ? [] : [`stored ${actual === undefined ? 'nothing' : `"${actual}"`}`]);
}

const leaked = Object.keys(expectedAttributes).filter((key) => taskAttributes[key] !== undefined);

report('the task refund block matches no route', leaked.length === 0 ? [] : [`stored ${leaked.join(', ')}`]);

console.log(
  failures.length === 0 ? '\nEvery handler response reached the flow.' : `\n${failures.length} check(s) failed.`,
);

if (failures.length > 0) process.exitCode = 1;
