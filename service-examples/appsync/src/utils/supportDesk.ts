export interface Comment {
  id: string;
  author: string;
  body: string;
}

export interface Ticket {
  id: string;
  subject: string;
  priority: string;
  status: string;
  internalNote: string | null;
}

const TICKETS: Ticket[] = [
  {
    id: 't-1',
    subject: 'Card reader offline',
    priority: 'high',
    status: 'open',
    internalNote: 'Third report from this site this week',
  },
  { id: 't-2', subject: 'Refund not received', priority: 'normal', status: 'open', internalNote: 'Awaiting finance' },
  { id: 't-3', subject: 'Password reset loop', priority: 'low', status: 'closed', internalNote: null },
];

const COMMENTS: Record<string, Comment[]> = {
  't-1': [
    { id: 'c-1', author: 'ada@example.com', body: 'The reader shows a red light.' },
    { id: 'c-2', author: 'desk@example.com', body: 'Engineer booked for Thursday.' },
  ],
  't-2': [{ id: 'c-3', author: 'grace@example.com', body: 'Still nothing on the statement.' }],
};

const QUEUES = ['front-desk', 'payments', 'engineering'];

export function findTicket(id: string): Ticket | undefined {
  return TICKETS.find((ticket) => ticket.id === id);
}

export function listTickets(status?: string): Ticket[] {
  return status ? TICKETS.filter((ticket) => ticket.status === status) : TICKETS;
}

export function listQueues(): string[] {
  return QUEUES;
}

export function commentsFor(ticketId: string): Comment[] {
  return COMMENTS[ticketId] ?? [];
}

export function raiseTicket(subject: string, priority: string): Ticket {
  return { id: `t-${Date.now()}`, subject, priority, status: 'open', internalNote: null };
}
