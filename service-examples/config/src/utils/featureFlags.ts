// Stands in for a feature flag service. The lookup is async, as a real one would be.
const enabled = new Set(['idle-function-sweep']);

export async function isEnabled(flag: string): Promise<boolean> {
  return enabled.has(flag);
}
