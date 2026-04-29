export interface ParsedTraceId {
  root: string;
  parent?: string;
  sampled?: string;
}

export function parseTraceHeader(header: string | undefined): ParsedTraceId | undefined {
  if (!header) return undefined;
  const map: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [key, value] = part.trim().split('=');
    if (key && value) map[key] = value;
  }
  if (!map.Root) return undefined;
  return { root: map.Root, parent: map.Parent, sampled: map.Sampled };
}
