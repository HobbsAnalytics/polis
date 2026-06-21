// Production bundle via esbuild (no Vite — the dev npm proxy cannot serve vite).
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outfile: 'public/app.js',
  format: 'esm',
  jsx: 'automatic',
  minify: true,
  sourcemap: true,
  logLevel: 'info',
  define: { 'process.env.NODE_ENV': '"production"' },
});
