import type { AppSyncEventsAuthorizerEvent, AppSyncEventsEvent } from '@lambda-event-router/appsync';
import type { AppSyncAuthorizerEvent, AppSyncResolverEvent, Context } from 'aws-lambda';

import { authorizerRouter } from '../src/authorizerRouter.js';
import { eventsAuthorizerRouter } from '../src/eventsAuthorizerRouter.js';
import { eventsRouter } from '../src/eventsRouter.js';
import type {
  AuthorizerStep,
  EventsAuthorizerStep,
  EventsStep,
  Expected,
  ResolverStep,
} from '../src/requests/steps.js';
import {
  authorizerSteps,
  eventsAuthorizerSteps,
  eventsSteps,
  resolverBatchSteps,
  resolverSteps,
} from '../src/requests/steps.js';
import { resolverRouter } from '../src/resolverRouter.js';
import { TOKEN_GRANTS } from '../src/utils/constants.js';

const ACCOUNT = '123456789012';
const REGION = 'eu-west-2';
const API_ID = 'tzt4abcdefghjklmnopqrstuvw';

const context = {
  functionName: 'ler-example-appsync-worker',
  awsRequestId: 'check-routes',
  invokedFunctionArn: `arn:aws:lambda:${REGION}:${ACCOUNT}:function:ler-example-appsync-worker`,
  getRemainingTimeInMillis: () => 10_000,
} as unknown as Context;

type ResolverEventShape = Pick<
  ResolverStep,
  'token' | 'parentTypeName' | 'fieldName' | 'arguments' | 'source' | 'selectionSetList'
>;

// The delivered event, copied field for field. A Lambda authorizer puts its `resolverContext` under
// `identity`, and nothing else about the caller reaches the resolver.
function buildResolverEvent(step: ResolverEventShape): AppSyncResolverEvent<Record<string, unknown>> {
  const grant = step.token ? TOKEN_GRANTS[step.token] : undefined;
  const selectionSetList = step.selectionSetList ?? [];

  return {
    arguments: step.arguments ?? {},
    identity: grant ? { resolverContext: { role: grant.role, actorId: grant.actorId } } : null,
    source: step.source ?? null,
    request: { headers: { authorization: step.token }, domainName: null },
    info: {
      selectionSetList,
      selectionSetGraphQL: `{\n${selectionSetList.join('\n')}\n}`,
      parentTypeName: step.parentTypeName,
      fieldName: step.fieldName,
      variables: {},
    },
    prev: null,
    stash: {},
  };
}

// A publish carries its events already parsed, each under an id AppSync minted. A subscribe carries
// `events: null`.
function buildEventsEvent(step: EventsStep): AppSyncEventsEvent {
  const segments = step.channel.replace(/^\//, '').split('/');

  return {
    identity: null,
    request: { headers: {}, domainName: null },
    info: {
      channel: { path: step.channel, segments },
      channelNamespace: { name: segments[0] ?? '' },
      operation: step.operation,
    },
    stash: {},
    events: step.payloads?.map((payload, index) => ({ id: `e-${index + 1}`, payload })) ?? null,
    prev: null,
    result: null,
    error: null,
    outErrors: [],
  };
}

function buildAuthorizerEvent(step: AuthorizerStep): AppSyncAuthorizerEvent {
  return {
    authorizationToken: step.token,
    requestContext: {
      apiId: API_ID,
      accountId: ACCOUNT,
      requestId: 'check-routes',
      queryString: `query ${step.operationName ?? 'GetTicket'} { getTicket(id: "t-1") { id } }`,
      operationName: step.operationName ?? 'GetTicket',
      variables: {},
    },
    requestHeaders: { authorization: step.token },
  };
}

// A connect carries no channel at all, rather than an empty one.
function buildEventsAuthorizerEvent(step: EventsAuthorizerStep): AppSyncEventsAuthorizerEvent {
  const segments = step.channel?.replace(/^\//, '').split('/');

  return {
    authorizationToken: step.token,
    requestContext: {
      apiId: API_ID,
      accountId: ACCOUNT,
      requestId: 'check-routes',
      operation: step.operation,
      ...(step.channel && { channel: step.channel, channelNamespaceName: segments?.[0] }),
    },
    requestHeaders: { authorization: step.token },
  };
}

function problemsWith(result: unknown, error: unknown, expected: Expected): string[] {
  const problems: string[] = [];

  if (error !== undefined) {
    const message = error instanceof Error ? error.message : String(error);
    if (!expected.errorIncludes) return [`threw ${message}`];
    if (!message.includes(expected.errorIncludes)) problems.push(`threw ${message}`);
    return problems;
  }

  const serialised = JSON.stringify(result) ?? 'undefined';

  if (expected.errorIncludes) return [`returned ${serialised.slice(0, 200)} instead of throwing`];
  if (expected.resultIs !== undefined && serialised !== expected.resultIs) {
    problems.push(`returned ${serialised.slice(0, 200)}`);
  }
  for (const fragment of expected.resultIncludes ?? []) {
    if (!serialised.includes(fragment)) problems.push(`returned ${serialised.slice(0, 200)}`);
  }
  if (expected.resultExcludes !== undefined && serialised.includes(expected.resultExcludes)) {
    problems.push(`returned ${expected.resultExcludes}`);
  }

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

async function run(label: string, handle: () => Promise<unknown>, expected: Expected): Promise<void> {
  try {
    report(label, problemsWith(await handle(), undefined, expected));
  } catch (error) {
    report(label, problemsWith(undefined, error, expected));
  }
}

for (const step of resolverSteps) {
  await run(
    `resolver ${step.name}`,
    () => resolverRouter.handleEvent(buildResolverEvent(step), context),
    step.expected,
  );
}

for (const step of resolverBatchSteps) {
  const events = step.sources.map((source) =>
    buildResolverEvent({
      token: step.token,
      parentTypeName: step.parentTypeName,
      fieldName: step.fieldName,
      selectionSetList: step.selectionSetList,
      source,
    }),
  );

  await run(`resolver ${step.name}`, () => resolverRouter.handleEvent(events, context), step.expected);
}

for (const step of eventsSteps) {
  await run(`events ${step.name}`, () => eventsRouter.handleEvent(buildEventsEvent(step), context), step.expected);
}

for (const step of authorizerSteps) {
  await run(
    `authorizer ${step.name}`,
    () => authorizerRouter.handleEvent(buildAuthorizerEvent(step), context),
    step.expected,
  );
}

for (const step of eventsAuthorizerSteps) {
  await run(
    `events authorizer ${step.name}`,
    () => eventsAuthorizerRouter.handleEvent(buildEventsAuthorizerEvent(step), context),
    step.expected,
  );
}

// Four routers share one AppSync account, and they share two Lambdas, so each one has to turn the
// others' events away on shape alone.
const firstResolverStep = resolverSteps[0];
const firstEventsStep = eventsSteps[0];
const firstAuthorizerStep = authorizerSteps[0];

if (!(firstResolverStep && firstEventsStep && firstAuthorizerStep)) {
  throw new Error('The step lists are empty, so canHandleEvent cannot be checked.');
}

const firstEventsAuthorizerStep = eventsAuthorizerSteps[0];
if (!firstEventsAuthorizerStep) throw new Error('The events authorizer step list is empty.');

const resolverEvent = buildResolverEvent(firstResolverStep);
const eventsEvent = buildEventsEvent(firstEventsStep);
const authorizerEvent = buildAuthorizerEvent(firstAuthorizerStep);
const eventsAuthorizerEvent = buildEventsAuthorizerEvent(firstEventsAuthorizerStep);

const claims: [string, boolean][] = [
  ['resolver router takes a resolver event', resolverRouter.canHandleEvent(resolverEvent)],
  ['resolver router takes a batch of resolver events', resolverRouter.canHandleEvent([resolverEvent, resolverEvent])],
  ['resolver router turns an empty batch away', !resolverRouter.canHandleEvent([])],
  ['resolver router turns an events event away', !resolverRouter.canHandleEvent(eventsEvent)],
  ['resolver router turns an authorizer event away', !resolverRouter.canHandleEvent(authorizerEvent)],
  ['events router takes an events event', eventsRouter.canHandleEvent(eventsEvent)],
  ['events router turns a resolver event away', !eventsRouter.canHandleEvent(resolverEvent)],
  ['events router turns an authorizer event away', !eventsRouter.canHandleEvent(authorizerEvent)],
  ['authorizer router takes an authorizer event', authorizerRouter.canHandleEvent(authorizerEvent)],
  ['authorizer router turns a resolver event away', !authorizerRouter.canHandleEvent(resolverEvent)],
  ['authorizer router turns an events event away', !authorizerRouter.canHandleEvent(eventsEvent)],
  ['authorizer router turns an events authorizer event away', !authorizerRouter.canHandleEvent(eventsAuthorizerEvent)],
  [
    'events authorizer router takes an events authorizer event',
    eventsAuthorizerRouter.canHandleEvent(eventsAuthorizerEvent),
  ],
  [
    'events authorizer router turns a GraphQL authorizer event away',
    !eventsAuthorizerRouter.canHandleEvent(authorizerEvent),
  ],
  ['events authorizer router turns a resolver event away', !eventsAuthorizerRouter.canHandleEvent(resolverEvent)],
  ['events authorizer router turns an events event away', !eventsAuthorizerRouter.canHandleEvent(eventsEvent)],
];

for (const [label, held] of claims) {
  report(label, held ? [] : ['did not hold']);
}

console.log(
  failures.length === 0 ? '\nEvery route landed where it was meant to.' : `\n${failures.length} step(s) failed.`,
);

if (failures.length > 0) process.exitCode = 1;
