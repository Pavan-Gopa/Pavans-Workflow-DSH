const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const runtimeDir = path.join(root, 'build', 'runtime')
const destination = path.join(runtimeDir, process.platform === 'win32' ? 'node.exe' : 'node')

fs.mkdirSync(runtimeDir, { recursive: true })
fs.copyFileSync(process.execPath, destination)
if (process.platform !== 'win32') fs.chmodSync(destination, 0o755)

const stat = fs.statSync(destination)
if (stat.size < 1_000_000) {
  throw new Error(`Prepared Node runtime is suspiciously small: ${destination} (${stat.size} bytes)`)
}
console.log(`Prepared Node runtime ${process.version} (${process.platform}/${process.arch}): ${destination}`)
