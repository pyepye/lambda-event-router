import { iamAuth, lambdaAuth } from '@lambda-event-router/apigateway';
import { z } from 'zod';

// A REST API sends every context value on as a string, so `clearance` arrives as '3' and the schema
// reads it back as a number
export const StaffContextSchema = z.object({ department: z.string(), clearance: z.coerce.number() });
export const ReconciliationContextSchema = z.object({ costCentre: z.string(), shift: z.string() });

export const staffAuth = lambdaAuth(StaffContextSchema);
export const warehouseReadAuth = lambdaAuth();
export const stockAdjustmentAuth = lambdaAuth();
export const reconciliationAuth = lambdaAuth(ReconciliationContextSchema);
export const auditAuth = iamAuth();
