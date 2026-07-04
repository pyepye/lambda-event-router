import { randomUUID } from 'node:crypto';

import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import WebSocket from 'ws';
import { eventsSteps } from '../src/requests/steps.js';
import {
  AGENT_TOKEN,
  AUDIT_CHANNEL,
  AUDIT_CHANNEL_PATTERN,
  BROKEN_TOKEN,
  CUSTOMER_TOKEN,
  EXPIRED_TOKEN,
  PRESENCE_CHANNEL,
  PRESENCE_CHANNEL_PATTERN,
  REVOKED_TOKEN,
  TICKET_CHANNEL,
  TICKET_CHANNEL_PATTERN,
} from '../src/utils/constants.js';

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? process.env.CDK_DEFAULT_REGION;
if (!region) throw new Error('Set AWS_REGION to the region the stack is deployed in.');

const stackName = process.argv[2] ?? 'ler-example-appsync';

const SOCKET_TIMEOUT_MS = 15_000;

// =============================================================================
// Stack outputs
// =============================================================================

const cloudFormation = new CloudFormationClient({ region });
const { Stacks } = await cloudFormation.send(new DescribeStacksCommand({ StackName: stackName }));
const outputs = new Map((Stacks?.[0]?.Outputs ?? []).map((entry) => [entry.OutputKey, entry.OutputValue]));

function output(key: string): string {
  const value = outputs.get(key);
  if (!value) throw new Error(`Stack ${stackName} has no output ${key}. Deploy it first.`);
  return value;
}

const supportApiUrl = output('SupportApiUrl');
const supportApiRealtimeUrl = output('SupportApiRealtimeUrl');
const supportApiHost = new URL(supportApiUrl).host;
const activityHttpDns = output('ActivityApiHttpDns');
const activityRealtimeDns = output('ActivityApiRealtimeDns');
const activityApiKey = output('ActivityApiKey');

// =============================================================================
// Assertions
// =============================================================================

const failures: string[] = [];

interface Expected {
  status?: number;
  bodyIncludes?: string[];
  bodyExcludes?: string;
  bodyIs?: string;
}

function assert(step: string, problems: string[]): void {
  if (problems.length === 0) {
    console.log(`ok   ${step}`);
    return;
  }
  failures.push(step);
  console.log(`FAIL ${step}: ${problems.join(', ')}`);
}

function assertBody(step: string, status: number, body: string, expected: Expected): void {
  const problems: string[] = [];

  if (expected.status !== undefined && status !== expected.status) {
    problems.push(`status ${status} (${body.slice(0, 160)})`);
  }
  if (expected.bodyIs !== undefined && body !== expected.bodyIs) problems.push(`body ${body.slice(0, 200)}`);
  for (const fragment of expected.bodyIncludes ?? []) {
    if (!body.includes(fragment)) problems.push(`body ${body.slice(0, 240)}`);
  }
  if (expected.bodyExcludes !== undefined && body.includes(expected.bodyExcludes)) {
    problems.push(`body holds ${expected.bodyExcludes}`);
  }

  assert(step, problems);
}

// =============================================================================
// GraphQL over HTTPS
// =============================================================================

async function callGraphql(step: string, token: string, query: string, expected: Expected): Promise<void> {
  const response = await fetch(supportApiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: token },
    body: JSON.stringify({ query }),
  });

  assertBody(step, response.status, await response.text(), expected);
}

await callGraphql(
  'agent reads a ticket',
  AGENT_TOKEN,
  '{ getTicket(id: "t-1") { id subject internalNote comments { id author } } }',
  {
    status: 200,
    bodyIncludes: ['"internalNote":"Third report from this site this week"', '"id":"c-1"', '"id":"c-2"'],
  },
);

await callGraphql('customer reads the same ticket', CUSTOMER_TOKEN, '{ getTicket(id: "t-1") { id internalNote } }', {
  status: 200,
  bodyIncludes: ['"id":"t-1"', '"internalNote":null'],
});

await callGraphql('agent lists open tickets', AGENT_TOKEN, '{ listTickets(status: "open") { id } }', {
  status: 200,
  bodyIncludes: ['"t-1"', '"t-2"'],
  bodyExcludes: '"t-3"',
});

await callGraphql(
  'comments for a page of tickets resolve in one batch',
  AGENT_TOKEN,
  '{ listTickets { id comments { id } } }',
  {
    status: 200,
    bodyIncludes: ['"id":"c-1"', '"id":"c-3"', '"comments":null', 'Comments for t-3 are archived'],
  },
);

await callGraphql('agent lists queues', AGENT_TOKEN, '{ listQueues }', {
  status: 200,
  bodyIncludes: ['"front-desk"', '"payments"', '"engineering"'],
});

await callGraphql('customer is denied the queues field', CUSTOMER_TOKEN, '{ listQueues }', {
  status: 200,
  bodyIncludes: ['Not Authorized to access listQueues on type Query'],
});

await callGraphql(
  'agent creates a ticket',
  AGENT_TOKEN,
  'mutation { createTicket(subject: "Printer jammed", priority: "high") { id subject priority status } }',
  {
    status: 200,
    bodyIncludes: ['"subject":"Printer jammed"', '"priority":"high"', '"status":"open"'],
  },
);

await callGraphql(
  'unknown priority is refused',
  AGENT_TOKEN,
  'mutation { createTicket(subject: "", priority: "urgent") { id } }',
  {
    status: 200,
    bodyIncludes: ['Arguments validation failed for Mutation.createTicket'],
  },
);

await callGraphql('unusable ticket id is refused', AGENT_TOKEN, '{ getTicket(id: "nope") { id } }', {
  status: 200,
  bodyIncludes: ['Arguments validation failed for Query.getTicket'],
});

await callGraphql('escalation fails in the handler', AGENT_TOKEN, 'mutation { escalateTicket(id: "t-1") { id } }', {
  status: 200,
  bodyIncludes: ['Escalation queue unavailable for t-1'],
});

await callGraphql('closing a ticket matches no route', AGENT_TOKEN, 'mutation { closeTicket(id: "t-1") { id } }', {
  status: 200,
  bodyIncludes: ['No route matched for Mutation.closeTicket'],
});

for (const [step, token] of [
  ['revoked token is refused', REVOKED_TOKEN],
  ['expired token is refused', EXPIRED_TOKEN],
] as const) {
  await callGraphql(step, token, '{ listTickets { id } }', {
    status: 401,
    bodyIncludes: ['UnauthorizedException'],
  });
}

// A denied token and a failed authorizer answer differently. A denial is a 401, and an authorizer
// that throws is a 500 carrying the error's own message.
await callGraphql('broken token fails the authorizer', BROKEN_TOKEN, '{ listTickets { id } }', {
  status: 500,
  bodyIncludes: ['AuthorizerFailureException', 'Token store unreachable for broken-7e18'],
});

// =============================================================================
// WebSockets
// =============================================================================

interface SocketOutcome {
  type: string;
  body: string;
}

// Both protocols open the same way: connect, send `connection_init`, wait for `connection_ack`, then
// send the operation. Keep-alives arrive until the socket closes and carry nothing to assert.
function socketExchange(
  url: string,
  protocols: string[],
  operation: Record<string, unknown>,
  terminalTypes: string[],
): Promise<SocketOutcome> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, protocols);

    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`No reply within ${SOCKET_TIMEOUT_MS}ms`));
    }, SOCKET_TIMEOUT_MS);

    function finish(outcome: SocketOutcome): void {
      clearTimeout(timer);
      socket.close();
      resolve(outcome);
    }

    socket.on('open', () => socket.send(JSON.stringify({ type: 'connection_init' })));

    socket.on('message', (raw: Buffer) => {
      const body = raw.toString();
      const type = String((JSON.parse(body) as { type?: unknown }).type ?? '');

      if (type === 'connection_ack') {
        socket.send(JSON.stringify(operation));
        return;
      }
      if (terminalTypes.includes(type)) finish({ type, body });
    });

    socket.on('error', (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function base64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

async function assertSocket(
  step: string,
  exchange: Promise<SocketOutcome>,
  expected: Expected & { type: string },
): Promise<void> {
  try {
    const outcome = await exchange;
    if (outcome.type !== expected.type) {
      assert(step, [`${outcome.type} (${outcome.body.slice(0, 200)})`]);
      return;
    }
    assertBody(step, 200, outcome.body, expected);
  } catch (error) {
    assert(step, [error instanceof Error ? error.message : String(error)]);
  }
}

// The GraphQL real-time endpoint takes its authorization twice: once in the connection's `header`
// query parameter, and again on the subscription itself.
const graphqlAuth = { host: supportApiHost, Authorization: AGENT_TOKEN };
const graphqlHeader = Buffer.from(JSON.stringify(graphqlAuth)).toString('base64');

await assertSocket(
  'agent opens the ticket feed subscription',
  socketExchange(
    `${supportApiRealtimeUrl}?header=${encodeURIComponent(graphqlHeader)}&payload=e30=`,
    ['graphql-ws'],
    {
      id: randomUUID(),
      type: 'start',
      payload: {
        data: JSON.stringify({ query: 'subscription { onTicketCreated { id subject } }', variables: {} }),
        extensions: { authorization: graphqlAuth },
      },
    },
    ['start_ack', 'error', 'connection_error'],
  ),
  { type: 'start_ack' },
);

// The Event API real-time endpoint takes its authorization in a subprotocol, and again on each
// subscribe message.
const activityAuth = { host: activityHttpDns, 'x-api-key': activityApiKey };
const activityProtocols = ['aws-appsync-event-ws', `header-${base64Url(JSON.stringify(activityAuth))}`];
const activityRealtimeUrl = `wss://${activityRealtimeDns}/event/realtime`;

function subscribeToChannel(channel: string): Promise<SocketOutcome> {
  return socketExchange(
    activityRealtimeUrl,
    activityProtocols,
    { type: 'subscribe', id: randomUUID(), channel, authorization: activityAuth },
    ['subscribe_success', 'subscribe_error'],
  );
}

await assertSocket('ticket watcher is admitted', subscribeToChannel(TICKET_CHANNEL_PATTERN), {
  type: 'subscribe_success',
});

await assertSocket('desk joins presence', subscribeToChannel(PRESENCE_CHANNEL_PATTERN), {
  type: 'subscribe_success',
});

await assertSocket('audit trail cannot be watched', subscribeToChannel(AUDIT_CHANNEL_PATTERN), {
  type: 'subscribe_error',
});

// =============================================================================
// Event API publishes over HTTPS
// =============================================================================

function payloadsFor(stepName: string): Record<string, unknown>[] {
  const step = eventsSteps.find((candidate) => candidate.name === stepName);
  if (!step?.payloads) throw new Error(`No publish payloads for step "${stepName}".`);
  return step.payloads;
}

async function publish(
  step: string,
  channel: string,
  payloads: Record<string, unknown>[],
  expected: Expected,
): Promise<void> {
  const response = await fetch(`https://${activityHttpDns}/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': activityApiKey },
    body: JSON.stringify({ channel, events: payloads.map((payload) => JSON.stringify(payload)) }),
  });

  assertBody(step, response.status, await response.text(), expected);
}

await publish('ticket activity is recorded', TICKET_CHANNEL, payloadsFor('ticket activity is recorded'), {
  status: 200,
  bodyIncludes: ['"failed":[]', '"index":0', '"index":1', '"index":2'],
});

await publish(
  'activity without a body is rejected on its own',
  TICKET_CHANNEL,
  payloadsFor('activity without a body is rejected on its own'),
  {
    status: 200,
    bodyIncludes: ['"index":0', '"index":1', '"message":"Activity needs a body"'],
    bodyExcludes: '"failed":[]',
  },
);

// A handler that broadcasts nothing still answers successful. `successful` is what the API accepted,
// not what it sent on, so the worker log is the only place the drop shows.
await publish('typing notices are dropped', TICKET_CHANNEL, payloadsFor('typing notices are dropped'), {
  status: 200,
  bodyIncludes: ['"failed":[]', '"index":0', '"index":1'],
});

await publish('presence heartbeat is recorded', PRESENCE_CHANNEL, payloadsFor('presence heartbeat is recorded'), {
  status: 200,
  bodyIncludes: ['"failed":[]', '"index":0'],
});

await publish('audit entry is archived', AUDIT_CHANNEL, payloadsFor('audit entry is archived'), {
  status: 200,
  bodyIncludes: ['"failed":[]', '"index":0'],
});

await publish(
  'audit entry with no actor fails the publish',
  AUDIT_CHANNEL,
  payloadsFor('audit entry with no actor fails the publish'),
  {
    status: 502,
    bodyIncludes: ['DependencyFailedException'],
  },
);

console.log(failures.length === 0 ? '\nEvery step matched.' : `\n${failures.length} step(s) failed.`);

if (failures.length > 0) process.exitCode = 1;
