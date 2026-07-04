import { z } from 'zod';

// Ticket ids are minted as `t-<number>`, so anything else is a bad reference rather than a miss.
export const TicketIdSchema = z.object({
  id: z.string().regex(/^t-\d+$/),
});

export type TTicketId = z.infer<typeof TicketIdSchema>;

// The GraphQL schema types `priority` as `String!`, so the enum is enforced here and nowhere else.
export const NewTicketSchema = z.object({
  subject: z.string().min(1),
  priority: z.enum(['low', 'normal', 'high']),
});

export type TNewTicket = z.infer<typeof NewTicketSchema>;
