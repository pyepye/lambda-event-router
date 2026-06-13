import { z } from 'zod';

// An outbound notification request. `category` drives the custom filter that holds marketing sends.
export const NotificationSchema = z.object({
  recipient: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  category: z.enum(['transactional', 'marketing']).default('transactional'),
});

export type TNotification = z.infer<typeof NotificationSchema>;

// Message attributes carried alongside a notification. `channel` drives the messageAttributes filter.
// `retryCount` is optional, and the filter never reads it, so it is the only attribute a message can
// fail validation on. Sent as a Number attribute it arrives as a number; sent as a String it does not
// coerce and the record fails.
export const NotificationAttributesSchema = z.object({
  channel: z.enum(['email', 'sms', 'push']),
  retryCount: z.coerce.number().int().min(0).optional(),
});

export type TNotificationAttributes = z.infer<typeof NotificationAttributesSchema>;

// A priority alert delivered in order per tenant on the FIFO queue.
export const PriorityAlertSchema = z.object({
  tenantId: z.string().min(1),
  alertId: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['warning', 'critical']),
});

export type TPriorityAlert = z.infer<typeof PriorityAlertSchema>;
