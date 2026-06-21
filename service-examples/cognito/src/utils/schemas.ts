import { z } from 'zod';

// Cognito sends every attribute as a string, so the schema checks presence and shape rather than
// coercing to another type. A staff sign-up without a staff number fails here.
export const StaffAttributesSchema = z.object({
  email: z.string().min(3),
  'custom:department': z.string().min(1),
  'custom:staffNumber': z.string().regex(/^\d{5}$/),
});

export type TStaffAttributes = z.infer<typeof StaffAttributesSchema>;
