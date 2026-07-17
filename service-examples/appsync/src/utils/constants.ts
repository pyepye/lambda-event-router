export const AGENT_TOKEN = 'agent-8c21';
export const CUSTOMER_TOKEN = 'customer-4f70';
export const REVOKED_TOKEN = 'revoked-1d03';
export const EXPIRED_TOKEN = 'expired-9a55';
export const BROKEN_TOKEN = 'broken-7e18';

export const AGENT_ROLE = 'agent';
export const CUSTOMER_ROLE = 'customer';

export const TICKET_NAMESPACE = 'ticket';
export const PRESENCE_NAMESPACE = 'presence';
export const AUDIT_NAMESPACE = 'audit';
export const PROBE_NAMESPACE = 'probe';

export const TICKET_CHANNEL = `/${TICKET_NAMESPACE}/t-1`;
export const PRESENCE_CHANNEL = `/${PRESENCE_NAMESPACE}/desk-1`;
export const AUDIT_CHANNEL = `/${AUDIT_NAMESPACE}/trail`;

export const PROBE_REFLECT_CHANNEL = `/${PROBE_NAMESPACE}/reflect`;
export const PROBE_BOTH_CHANNEL = `/${PROBE_NAMESPACE}/both`;
export const PROBE_BARE_CHANNEL = `/${PROBE_NAMESPACE}/bare`;
export const PROBE_EMPTY_CHANNEL = `/${PROBE_NAMESPACE}/empty`;
export const PROBE_NOTHING_CHANNEL = `/${PROBE_NAMESPACE}/nothing`;
export const PROBE_EXTRA_ENTRY_CHANNEL = `/${PROBE_NAMESPACE}/extra-entry`;
export const PROBE_EXTRA_TOP_CHANNEL = `/${PROBE_NAMESPACE}/extra-top`;
export const PROBE_ERROR_ONLY_CHANNEL = `/${PROBE_NAMESPACE}/error-only`;
export const PROBE_EMPTY_LIST_CHANNEL = `/${PROBE_NAMESPACE}/empty-list`;
export const PROBE_BOTH_TOP_CHANNEL = `/${PROBE_NAMESPACE}/both-top`;
export const PROBE_ID_ONLY_CHANNEL = `/${PROBE_NAMESPACE}/id-only`;

export const TICKET_CHANNEL_PATTERN = `/${TICKET_NAMESPACE}/*`;
export const PRESENCE_CHANNEL_PATTERN = `/${PRESENCE_NAMESPACE}/*`;
export const AUDIT_CHANNEL_PATTERN = `/${AUDIT_NAMESPACE}/*`;

export const TYPING_EVENT = 'typing';

export const ADMIN_OPERATION = 'AdminAudit';

export interface TokenGrant {
  role: string;
  actorId: string;
  deniedFields?: string[];
}

// AppSync copies `resolverContext` onto `identity` for every resolver the request reaches, and only
// takes string values, so the role the custom filters read is a string.
export const TOKEN_GRANTS: Record<string, TokenGrant> = {
  [AGENT_TOKEN]: { role: AGENT_ROLE, actorId: 'ag-7' },
  [CUSTOMER_TOKEN]: { role: CUSTOMER_ROLE, actorId: 'cu-3', deniedFields: ['Query.listQueues'] },
};
