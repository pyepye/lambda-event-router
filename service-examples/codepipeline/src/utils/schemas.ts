import { z } from 'zod';

// UserParameters for the verify action. `environment` is the field the pipeline's rollback verify
// action leaves out, which is the only way a job here fails its schema.
export const VerifyParametersSchema = z.object({
  step: z.literal('verify'),
  environment: z.enum(['staging', 'production']),
  bundleName: z.string().min(1),
});

export type TVerifyParameters = z.infer<typeof VerifyParametersSchema>;

// UserParameters for both canary routes. `bundleSha` arrives as a CodePipeline variable produced by
// the verify action.
export const CanaryParametersSchema = z.object({
  step: z.literal('canary'),
  environment: z.enum(['staging', 'production']),
  bundleSha: z.string().min(1),
});

export type TCanaryParameters = z.infer<typeof CanaryParametersSchema>;
