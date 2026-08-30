import { createHash } from 'node:crypto';

const RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const HASH_PREFIX_LENGTH = 5;

// Only the first 5 characters of the SHA-1 hash leave the Lambda. The API returns every breached hash
// with that prefix, and the match is made here.
export async function countBreaches(secret: string): Promise<number> {
  const hash = createHash('sha1').update(secret).digest('hex').toUpperCase();
  const prefix = hash.slice(0, HASH_PREFIX_LENGTH);
  const suffix = hash.slice(HASH_PREFIX_LENGTH);

  const response = await fetch(`${RANGE_URL}${prefix}`, { headers: { 'user-agent': 'lambda-event-router-example' } });
  if (!response.ok) throw new Error(`Pwned Passwords returned HTTP ${response.status}`);

  const body = await response.text();
  // Each line is "<hash suffix>:<breach count>"
  const breach = body
    .split('\n')
    .map((line) => line.trim().split(':'))
    .find(([lineSuffix]) => lineSuffix === suffix);

  return Number(breach?.[1] ?? 0);
}
