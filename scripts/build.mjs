// Production bundle via esbuild (no Vite). Outputs a classic IIFE script so the
// app runs by simply opening public/index.html — no server, no install needed.
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outfile: 'public/app.js',
  format: 'iife',
  jsx: 'automatic',
  minify: true,
  sourcemap: false,
  logLevel: 'info',
  define: { 'process.env.NODE_ENV': '"production"' },
});
