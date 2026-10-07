// Inlines the Vite build (dist/) into one self-contained HTML file.
// Usage: npm run build && node scripts/build-single.mjs [out.html]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const out = process.argv[2] ?? join(dist, 'bhishi-manager.html');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const read = (src) => readFileSync(join(dist, src.replace(/^\.?\//, '')), 'utf8');

const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map((m) => read(m[1])).join('\n');
const js = [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)]
  .map((m) => read(m[1]).replace(/<\/script/gi, '<\\/script'))
  .join('\n');
const title = html.match(/<title>.*?<\/title>/)?.[0] ?? '<title>Bhishi Manager</title>';

writeFileSync(out, `${title}\n<style>\n${css}\n</style>\n<div id="root"></div>\n<script type="module">\n${js}\n</script>\n`);
console.log(`wrote ${out} (${(css.length + js.length) / 1000 | 0} kB)`);
