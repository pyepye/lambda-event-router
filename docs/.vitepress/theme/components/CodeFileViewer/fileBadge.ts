const badgeLabels: Record<string, string> = { json: '{}', html: '<>' };

export function getExt(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot + 1).toLowerCase();
}

export function getBadgeLabel(ext: string): string {
  const normalised = ext.toLowerCase();
  return badgeLabels[normalised] || ext;
}
