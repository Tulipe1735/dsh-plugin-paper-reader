/**
 * Build the browser half: src/app.jsx -> client.js in the DSH Client module
 * format (same wrapper shape the shipped plugins use).
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const pluginId = 'dsh-plugin-paper-reader'
const outDir = path.join(root, '.build')
await fs.mkdir(outDir, { recursive: true })

await build({
  entryPoints: [path.join(root, 'src', 'app.jsx')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome110'],
  minify: true,
  legalComments: 'none',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  outfile: path.join(outDir, 'app.cjs'),
  logLevel: 'warning',
})

const app = await fs.readFile(path.join(outDir, 'app.cjs'), 'utf8')
if (app.includes('@deepseek-ai/')) {
  console.warn('warning: client bundle still requires a Harness package; check imports')
}
if (/\bimport\s*\(/.test(app)) console.warn('warning: client bundle contains a dynamic import()')

const output = `// ${pluginId} — generated file, do not edit by hand. Source: src/app.jsx
if (typeof window !== "undefined" && window.__ModuleLoader__) {
window.__ModuleLoader__.load({
  id: ${JSON.stringify(pluginId)},
  factory(require) {
    var module = { exports: {} };
    var exports = module.exports;
    (function (module, exports, require) {
${app}
    })(module, module.exports, require);
    return module.exports;
  },
});
}
`
await fs.writeFile(path.join(root, 'client.js'), output, 'utf8')
const bytes = Buffer.byteLength(output)
console.log(`client.js ${(bytes / 1024).toFixed(1)} KiB`)
