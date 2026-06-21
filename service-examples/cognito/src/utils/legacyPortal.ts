import { LEGACY_ACCOUNT_PREFIX, LEGACY_PASSWORD, LEGACY_PROGRAMME, simulatorEmail } from './constants.js';

export interface LegacyApplicant {
  email: string;
  programme: string;
  password: string;
}

// Stands in for the lookup a real migration would make against the old portal's database.
export function findLegacyApplicant(userName: string): LegacyApplicant | undefined {
  if (!userName.startsWith(LEGACY_ACCOUNT_PREFIX)) return undefined;

  return {
    email: simulatorEmail(userName),
    programme: LEGACY_PROGRAMME,
    password: LEGACY_PASSWORD,
  };
}
