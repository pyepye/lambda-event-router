// A 1.0 payload names the caller in these headers. A 2.0 payload names them in the request context
// and does not send them.
export const IDENTITY_HEADER = 'x-amzn-lattice-identity';
export const NETWORK_HEADER = 'x-amzn-lattice-network';

// VPC Lattice leaves the query string on the path it sends, unlike every other HTTP event source,
// so routes are matched against the part in front of it.
export function pathWithoutQuery(path: string): string {
  const queryStart = path.indexOf('?');
  return queryStart === -1 ? path : path.slice(0, queryStart);
}

// `Principal=arn:...; PrincipalOrgID=; SessionName=name; Type=AWS_IAM`, with an empty value for
// anything the caller has not got. Keys come back in the camelCase a 2.0 payload uses.
export function fieldsFromLatticeHeader(header: string | undefined): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!header) return fields;

  for (const entry of header.split(';')) {
    const separator = entry.indexOf('=');
    if (separator === -1) continue;

    const key = entry.slice(0, separator).trim();
    const fieldValue = entry.slice(separator + 1).trim();
    if (key === '' || fieldValue === '') continue;

    fields[key.charAt(0).toLowerCase() + key.slice(1)] = fieldValue;
  }

  return fields;
}
