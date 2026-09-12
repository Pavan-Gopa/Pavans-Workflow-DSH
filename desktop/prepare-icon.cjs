const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

if (process.platform !== 'darwin') {
  console.error('prepare-icon is only required for macOS packaging.')
  process.exit(0)
}

const root = path.resolve(__dirname, '..')
const source = path.join(root, 'build', 'icon.svg')
const destination = path.join(root, 'build', 'icon.png')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pavan-icon-'))

try {
  if (!fs.existsSync(source)) throw new Error(`Missing icon source: ${source}`)

  const result = spawnSync('/usr/bin/qlmanage', ['-t', '-s', '1024', '-o', temporary, source], {
    encoding: 'utf8',
    timeout: 30000,
  })
  if (result.status !== 0) {
    throw new Error(`qlmanage failed (${result.status}): ${result.stderr || result.stdout}`)
  }

  const candidates = fs.readdirSync(temporary)
    .filter(name => name.toLowerCase().endsWith('.png'))
    .map(name => path.join(temporary, name))
  if (candidates.length !== 1) {
    throw new Error(`Expected one rendered PNG, found ${candidates.length}: ${candidates.join(', ')}`)
  }

  fs.copyFileSync(candidates[0], destination)
  const stat = fs.statSync(destination)
  if (stat.size < 10000) throw new Error(`Rendered icon is suspiciously small: ${stat.size} bytes`)
  console.log(`Prepared macOS icon: ${destination} (${stat.size} bytes)`)
} finally {
  fs.rmSync(temporary, { recursive: true, force: true })
}
