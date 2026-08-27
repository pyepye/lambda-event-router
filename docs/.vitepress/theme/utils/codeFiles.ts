interface FileEntry {
  path: string;
  code: string;
}

/**
 * Convert an `import.meta.glob(..., { query: '?raw', eager: true })` result
 * into the `files` array expected by `<CodeFileViewer>`.
 *
 * The glob keys are absolute paths like `/examples/helloWorld/index.ts`.
 * This strips the shared directory prefix so paths become relative
 * (e.g. `index.ts`, `handlers/createItem.ts`).
 */
export function fromGlob(modules: Record<string, string>): FileEntry[] {
  const entries = Object.entries(modules).map(([fullPath, raw]) => ({
    fullPath,
    code: typeof raw === 'string' ? raw : (raw as { default: string }).default,
  }));

  const prefix = commonPrefix(entries.map((e) => e.fullPath));

  return entries.map(({ fullPath, code }) => ({
    path: fullPath.slice(prefix.length),
    code: code.trimEnd(),
  }));
}

function commonPrefix(paths: string[]): string {
  if (paths.length === 0) return '';
  const first = paths[0];
  let end = first.length;
  for (const path of paths) {
    for (let i = 0; i < end; i++) {
      if (path[i] !== first[i]) {
        end = i;
        break;
      }
    }
  }
  // Snap to last `/` so we don't cut mid-filename
  const slashIndex = first.lastIndexOf('/', end - 1);
  return slashIndex === -1 ? '' : first.slice(0, slashIndex + 1);
}
