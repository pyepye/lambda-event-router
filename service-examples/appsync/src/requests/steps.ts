import type { JsonValue } from '@lambda-event-router/base';

import {
  ADMIN_OPERATION,
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
  TYPING_EVENT,
} from '../utils/constants.js';

export interface Expected {
  // JSON.stringify of the value the handler returned, compared whole.
  resultIs?: string;
  resultIncludes?: string[];
  resultExcludes?: string;
  errorIncludes?: string;
}

export interface ResolverStep {
  name: string;
  token?: string;
  parentTypeName: string;
  fieldName: string;
  arguments?: Record<string, unknown>;
  source?: Record<string, unknown>;
  selectionSetList?: string[];
  expected: Expected;
}

export interface ResolverBatchStep {
  name: string;
  token?: string;
  parentTypeName: string;
  fieldName: string;
  sources: Record<string, unknown>[];
  selectionSetList?: string[];
  expected: Expected;
}

export interface EventsStep {
  name: string;
  operation: 'PUBLISH' | 'SUBSCRIBE';
  channel: string;
  payloads?: Record<string, JsonValue>[];
  expected: Expected;
}

export interface AuthorizerStep {
  name: string;
  token: string;
  operationName?: string;
  expected: Expected;
}

export interface EventsAuthorizerStep {
  name: string;
  token: string;
  operation: 'EVENT_CONNECT' | 'EVENT_PUBLISH' | 'EVENT_SUBSCRIBE';
  channel?: string;
  expected: Expected;
}

export const resolverSteps: ResolverStep[] = [
  {
    name: 'agent reads a ticket',
    token: AGENT_TOKEN,
    parentTypeName: 'Query',
    fieldName: 'getTicket',
    arguments: { id: 't-1' },
    selectionSetList: ['id', 'subject', 'internalNote'],
    expected: { resultIncludes: ['"internalNote":"Third report from this site this week"'] },
  },
  {
    name: 'customer reads the same ticket',
    token: CUSTOMER_TOKEN,
    parentTypeName: 'Query',
    fieldName: 'getTicket',
    arguments: { id: 't-1' },
    selectionSetList: ['id', 'subject', 'internalNote'],
    expected: { resultIncludes: ['"id":"t-1"', '"internalNote":null'] },
  },
  {
    name: 'ticket comments resolve from the parent',
    token: AGENT_TOKEN,
    parentTypeName: 'Ticket',
    fieldName: 'comments',
    source: { id: 't-1' },
    selectionSetList: ['id', 'author', 'body'],
    expected: { resultIncludes: ['"id":"c-1"', '"id":"c-2"'] },
  },
  {
    name: 'open tickets list',
    token: AGENT_TOKEN,
    parentTypeName: 'Query',
    fieldName: 'listTickets',
    arguments: { status: 'open' },
    selectionSetList: ['id'],
    expected: { resultIncludes: ['"id":"t-1"', '"id":"t-2"'], resultExcludes: '"id":"t-3"' },
  },
  {
    name: 'queues list through the same route',
    token: AGENT_TOKEN,
    parentTypeName: 'Query',
    fieldName: 'listQueues',
    selectionSetList: [],
    expected: { resultIs: '["front-desk","payments","engineering"]' },
  },
  {
    name: 'ticket is created',
    token: AGENT_TOKEN,
    parentTypeName: 'Mutation',
    fieldName: 'createTicket',
    arguments: { subject: 'Printer jammed', priority: 'high' },
    selectionSetList: ['id', 'status'],
    expected: { resultIncludes: ['"subject":"Printer jammed"', '"priority":"high"', '"status":"open"'] },
  },
  {
    name: 'feed subscription opens',
    token: AGENT_TOKEN,
    parentTypeName: 'Subscription',
    fieldName: 'onTicketCreated',
    selectionSetList: ['id', 'subject'],
    expected: { resultIs: 'null' },
  },
  {
    name: 'unusable ticket id is refused',
    token: AGENT_TOKEN,
    parentTypeName: 'Query',
    fieldName: 'getTicket',
    arguments: { id: 'nope' },
    selectionSetList: ['id'],
    expected: { errorIncludes: 'Arguments validation failed for Query.getTicket' },
  },
  {
    name: 'unknown priority is refused',
    token: AGENT_TOKEN,
    parentTypeName: 'Mutation',
    fieldName: 'createTicket',
    arguments: { subject: '', priority: 'urgent' },
    selectionSetList: ['id'],
    expected: { errorIncludes: 'Arguments validation failed for Mutation.createTicket' },
  },
  {
    name: 'escalation fails in the handler',
    token: AGENT_TOKEN,
    parentTypeName: 'Mutation',
    fieldName: 'escalateTicket',
    arguments: { id: 't-1' },
    selectionSetList: ['id'],
    expected: { errorIncludes: 'Escalation queue unavailable for t-1' },
  },
  {
    name: 'closing a ticket matches no route',
    token: AGENT_TOKEN,
    parentTypeName: 'Mutation',
    fieldName: 'closeTicket',
    arguments: { id: 't-1' },
    selectionSetList: ['id'],
    expected: { errorIncludes: 'No route matched for Mutation.closeTicket' },
  },
];

// A batched resolver answers with one entry per source, in order, each value under `data`.
export const resolverBatchSteps: ResolverBatchStep[] = [
  {
    name: 'comments for a page of tickets resolve in one invocation',
    token: AGENT_TOKEN,
    parentTypeName: 'Ticket',
    fieldName: 'comments',
    sources: [{ id: 't-1' }, { id: 't-2' }, { id: 't-3' }],
    selectionSetList: ['id', 'author'],
    expected: {
      resultIncludes: [
        '"data":[{"id":"c-1"',
        '"data":[{"id":"c-3"',
        '"data":null,"errorMessage":"Comments for t-3 are archived","errorType":"Error"',
      ],
    },
  },
];

export const eventsSteps: EventsStep[] = [
  {
    name: 'ticket activity is recorded',
    operation: 'PUBLISH',
    channel: TICKET_CHANNEL,
    payloads: [
      { type: 'comment', author: 'ada@example.com', body: 'The reader shows a red light.' },
      { type: 'comment', author: 'desk@example.com', body: 'Engineer booked for Thursday.' },
      { type: 'status', author: 'desk@example.com', body: 'Moved to engineering.' },
    ],
    expected: { resultIncludes: ['"id":"e-1"', '"id":"e-2"', '"id":"e-3"'], resultExcludes: '"error"' },
  },
  {
    name: 'activity without a body is rejected on its own',
    operation: 'PUBLISH',
    channel: TICKET_CHANNEL,
    payloads: [
      { type: 'comment', author: 'ada@example.com', body: 'Any update?' },
      { type: 'comment', author: 'ada@example.com' },
    ],
    expected: { resultIncludes: ['"id":"e-1","payload"', '"id":"e-2","error":"Activity needs a body"'] },
  },
  {
    name: 'typing notices are dropped',
    operation: 'PUBLISH',
    channel: TICKET_CHANNEL,
    payloads: [
      { type: TYPING_EVENT, author: 'ada@example.com' },
      { type: TYPING_EVENT, author: 'desk@example.com' },
    ],
    expected: { resultIs: '{"events":[]}' },
  },
  {
    name: 'ticket watcher is admitted',
    operation: 'SUBSCRIBE',
    channel: TICKET_CHANNEL_PATTERN,
    expected: { resultIs: 'null' },
  },
  {
    name: 'presence heartbeat is recorded',
    operation: 'PUBLISH',
    channel: PRESENCE_CHANNEL,
    payloads: [{ status: 'available', agentId: 'ag-7' }],
    expected: { resultIncludes: ['"id":"e-1"', '"status":"available"'] },
  },
  {
    name: 'desk joins presence through the same route',
    operation: 'SUBSCRIBE',
    channel: PRESENCE_CHANNEL_PATTERN,
    expected: { resultIs: 'null' },
  },
  {
    name: 'audit entry is archived',
    operation: 'PUBLISH',
    channel: AUDIT_CHANNEL,
    payloads: [{ actor: 'ag-7', action: 'ticket.escalated' }],
    expected: { resultIncludes: ['"id":"e-1"', '"actor":"ag-7"'] },
  },
  {
    name: 'audit entry with no actor fails the publish',
    operation: 'PUBLISH',
    channel: AUDIT_CHANNEL,
    payloads: [{ action: 'ticket.escalated' }],
    expected: { errorIncludes: 'Audit entry e-1 names no actor' },
  },
  {
    name: 'audit trail cannot be watched',
    operation: 'SUBSCRIBE',
    channel: AUDIT_CHANNEL_PATTERN,
    expected: { errorIncludes: `No route matched for SUBSCRIBE on channel ${AUDIT_CHANNEL_PATTERN}` },
  },
];

// The Event API reads `handlerContext`, and never `resolverContext` or `deniedFields`.
export const eventsAuthorizerSteps: EventsAuthorizerStep[] = [
  {
    name: 'a known token connects',
    token: AGENT_TOKEN,
    operation: 'EVENT_CONNECT',
    expected: { resultIs: '{"isAuthorized":true,"ttlOverride":0}' },
  },
  {
    name: 'an unknown token may not connect',
    token: REVOKED_TOKEN,
    operation: 'EVENT_CONNECT',
    expected: { resultIs: '{"isAuthorized":false,"ttlOverride":0}' },
  },
  {
    name: 'an agent may publish ticket activity',
    token: AGENT_TOKEN,
    operation: 'EVENT_PUBLISH',
    channel: TICKET_CHANNEL,
    expected: { resultIncludes: ['"handlerContext":{"role":"agent","actorId":"ag-7"}'] },
  },
  {
    name: 'a customer may not publish ticket activity',
    token: CUSTOMER_TOKEN,
    operation: 'EVENT_PUBLISH',
    channel: TICKET_CHANNEL,
    expected: { resultIs: '{"isAuthorized":false,"ttlOverride":0}' },
  },
  {
    name: 'presence may be watched',
    token: AGENT_TOKEN,
    operation: 'EVENT_SUBSCRIBE',
    channel: PRESENCE_CHANNEL_PATTERN,
    expected: { resultIs: '{"isAuthorized":true,"ttlOverride":0}' },
  },
  {
    name: 'the audit namespace refuses every operation',
    token: AGENT_TOKEN,
    operation: 'EVENT_PUBLISH',
    channel: AUDIT_CHANNEL,
    expected: { resultIs: '{"isAuthorized":false,"ttlOverride":0}' },
  },
  {
    name: 'a ticket subscribe matches no authorizer route',
    token: AGENT_TOKEN,
    operation: 'EVENT_SUBSCRIBE',
    channel: TICKET_CHANNEL_PATTERN,
    expected: { errorIncludes: `No authorizer route matched for EVENT_SUBSCRIBE on channel ${TICKET_CHANNEL_PATTERN}` },
  },
];

// The expired and revoked tokens produce the same response. Only the log says which path built it.
export const authorizerSteps: AuthorizerStep[] = [
  {
    name: 'agent token is authorised',
    token: AGENT_TOKEN,
    expected: { resultIs: '{"isAuthorized":true,"resolverContext":{"role":"agent","actorId":"ag-7"},"ttlOverride":0}' },
  },
  {
    name: 'customer token is authorised without the queue field',
    token: CUSTOMER_TOKEN,
    expected: { resultIncludes: ['"isAuthorized":true', '"deniedFields":["Query.listQueues"]'] },
  },
  {
    name: 'revoked token is denied by the handler',
    token: REVOKED_TOKEN,
    expected: { resultIs: '{"isAuthorized":false,"ttlOverride":0}' },
  },
  {
    name: 'expired token is denied by the middleware',
    token: EXPIRED_TOKEN,
    expected: { resultIs: '{"isAuthorized":false,"ttlOverride":0}' },
  },
  {
    name: 'broken token fails the authorizer',
    token: BROKEN_TOKEN,
    expected: { errorIncludes: 'Token store unreachable' },
  },
  {
    name: 'an agent takes the admin route',
    token: AGENT_TOKEN,
    operationName: ADMIN_OPERATION,
    expected: { resultIncludes: ['"admin":"true"'] },
  },
  {
    name: 'a customer naming the admin operation falls through to the ordinary grant',
    token: CUSTOMER_TOKEN,
    operationName: ADMIN_OPERATION,
    expected: { resultIncludes: ['"deniedFields":["Query.listQueues"]'], resultExcludes: '"admin"' },
  },
];
