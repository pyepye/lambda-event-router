import { build } from 'esbuild';

// sam deploy uploads this bundle as it is. sam build is not used: it runs npm install, which cannot
// resolve workspace:* versions.
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
