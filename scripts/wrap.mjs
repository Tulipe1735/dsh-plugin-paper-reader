/** Wrap esbuild's CJS output in the DSH Client module loader envelope. */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const pluginId = 'dsh-plugin-paper-reader'
const app = await fs.readFile(path.join(root, '.build', 'app.cjs'), 'utf8')

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
console.log(`client.js ${(Buffer.byteLength(output) / 1024).toFixed(1)} KiB`)
