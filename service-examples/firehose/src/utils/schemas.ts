import { z } from 'zod';

// A page view from the clickstream. `occurredAt` is what the freshness guard reads.
export const PageViewSchema = z.object({
  runId: z.string().min(1),
  eventType: z.literal('pageView'),
  url: z.url(),
  visitorId: z.string().min(1),
  userAgent: z.string().min(1),
  occurredAt: z.iso.datetime(),
});

export type TPageView = z.infer<typeof PageViewSchema>;

// A sign up carries the visitor's email, which the handler masks before Firehose writes it to S3.
export const SignUpSchema = z.object({
  runId: z.string().min(1),
  eventType: z.literal('signUp'),
  email: z.email(),
  visitorId: z.string().min(1),
  plan: z.enum(['free', 'team']),
});

export type TSignUp = z.infer<typeof SignUpSchema>;

// An audit event. `tenantId` goes back to Firehose as a partition key, so it decides the S3 prefix.
export const AuditEventSchema = z.object({
  runId: z.string().min(1),
  tenantId: z.string().min(1),
  actor: z.string().min(1),
  action: z.enum(['roleGranted', 'roleRevoked', 'policyChanged']),
  occurredAt: z.iso.datetime(),
});

export type TAuditEvent = z.infer<typeof AuditEventSchema>;
