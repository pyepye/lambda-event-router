import { lambdaAuth } from '@latcher/apigateway';
import { z } from 'zod';

// A fixed token keeps the example runnable with curl. A real authorizer verifies a token it cannot guess
export const DEMO_TOKEN = 'demo-token';

export const CustomerContextSchema = z.object({ customerId: z.string() });

export const customerAuth = lambdaAuth(CustomerContextSchema);
