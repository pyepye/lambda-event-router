// A 1.0 payload names the caller in this header. A 2.0 payload names them in the request context
// and does not send it.
export const IDENTITY_HEADER = 'x-amzn-lattice-identity';

// VPC Lattice leaves the query string on the path it sends, unlike every other HTTP event source,
// so routes are matched against the part in front of it.
export function pathWithoutQuery(path: string): string {
  const queryStart = path.indexOf('?');
  return queryStart === -1 ? path : path.slice(0, queryStart);
}

// `Principal=arn:...; PrincipalOrgID=; SessionName=name; Type=AWS_IAM`, with an empty value for
// anything the caller has not got.
export function principalFromIdentityHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;

  for (const entry of header.split(';')) {
    const separator = entry.indexOf('=');
    if (separator === -1) continue;
    if (entry.slice(0, separator).trim() !== 'Principal') continue;

    const principal = entry.slice(separator + 1).trim();
    return principal === '' ? undefined : principal;
  }

  return undefined;
}
