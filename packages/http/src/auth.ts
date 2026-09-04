import type { StandardSchemaV1 } from '@standard-schema/spec';

import { isObject, logger } from '@lambda-event-router/base';

// missing answers 401, invalid 403, and wrongType 500 because only a setup fault can cause it
export type AuthFailureReason = 'missing' | 'wrongType' | 'invalid';

export type AuthCheckResult<TAuth> =
  | { success: true; auth: TAuth }
  | {
      success: false;
      reason: AuthFailureReason;
      message: string;
      issues?: ReadonlyArray<StandardSchemaV1.Issue>;
    };

export interface AuthPreset<TInput, TOutput> {
  readonly name: string;
  readonly check: (auth: TInput) => Promise<AuthCheckResult<TOutput>>;
}

export type AuthOf<TPreset> = TPreset extends AuthPreset<never, infer TOutput> ? TOutput : never;

function authType(auth: unknown): unknown {
  return isObject(auth) ? auth.type : typeof auth;
}

export function noAuth<TInput>(): AuthPreset<TInput, undefined> {
  return {
    name: 'noAuth',
    check: async (auth: TInput) => {
      if (auth !== undefined) {
        logger.warn('A noAuth route received auth, which its handler does not see', { authType: authType(auth) });
      }
      return { success: true, auth: undefined };
    },
  };
}
