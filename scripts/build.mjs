import { build } from 'esbuild';
import { readdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
const vendor = 'docs/vendor/cubing';
await rm(vendor, { recursive: true, force: true });
await build({
 entryPoints: {
  scramble: 'node_modules/cubing/dist/lib/cubing/scramble/index.js',
  'search-worker-entry': 'node_modules/cubing/dist/lib/cubing/chunks/search-worker-entry.js'
 },
 outdir: vendor, bundle: true, splitting: true, format: 'esm', platform: 'browser',
 target: 'es2022', minify: true, sourcemap: true, legalComments: 'linked', chunkNames: '[name]-[hash]'
});
async function walk(dir) {
 const entries = await readdir(dir, { withFileTypes: true });
 return (await Promise.all(entries.map(e => e.isDirectory() ? walk(path.join(dir,e.name)) : path.join(dir,e.name)))).flat();
}
const files = (await walk('docs')).filter(p => !p.endsWith('/sw.js') && !p.endsWith('.map') && !p.endsWith('.nojekyll')).sort();
const assets = ['./', ...files.map(p => './' + p.slice(5))];
const template = await readFile('scripts/sw-template.js','utf8');
await writeFile('docs/sw.js', template.replace('__ASSETS__', JSON.stringify(assets)));
console.log(`Cached assets: ${assets.length}`);
