// Dev server via esbuild (bundle + watch + serve). CSS is plain static
// public/app.css — no Tailwind build (the dev npm proxy cannot reliably serve
// the Tailwind toolchain). Vite is likewise unavailable here.
import * as esbuild from 'esbuild';

const ctx = await esbuild.context({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outfile: 'public/app.js',
  format: 'esm',
  jsx: 'automatic',
  sourcemap: true,
  logLevel: 'info',
  define: { 'process.env.NODE_ENV': '"development"' },
});

await ctx.watch();
const { port } = await ctx.serve({ servedir: 'public' });
console.log(`\nPolis dev server running at http://localhost:${port}\n`);
