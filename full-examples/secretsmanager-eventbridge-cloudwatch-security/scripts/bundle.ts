import { build } from 'esbuild';

// Terraform does not build TypeScript, so it deploys this bundle.
await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.mjs',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  minify: true,
  sourcemap: true,
  mainFields: ['module', 'main'],
  conditions: ['module'],
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
});
