function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set on the ordering function.`);
  return value;
}

export const config = {
  // The Lattice service domain. Both listeners answer on it.
  latticeDomain: required('LATTICE_DOMAIN'),
  region: required('AWS_REGION'),
  accessKeyId: required('AWS_ACCESS_KEY_ID'),
  secretAccessKey: required('AWS_SECRET_ACCESS_KEY'),
  sessionToken: required('AWS_SESSION_TOKEN'),
};
