const fs = require('node:fs')
const path = require('node:path')

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

function unlinkIfPresent(target) {
  try { fs.unlinkSync(target) } catch (error) { if (error?.code !== 'ENOENT') throw error }
}

function prepareBundledToolchain({ directory, execPath, pnpmEntry, platform = process.platform }) {
  if (!directory || !execPath || !pnpmEntry) throw new Error('Bundled toolchain requires directory, execPath, and pnpmEntry.')
  if (!fs.existsSync(execPath)) throw new Error(`Bundled Node executable is missing: ${execPath}`)
  if (!fs.existsSync(pnpmEntry)) throw new Error(`Bundled pnpm entrypoint is missing: ${pnpmEntry}`)

  const binDir = path.join(directory, 'bin')
  fs.mkdirSync(binDir, { recursive: true })

  if (platform === 'win32') {
    fs.writeFileSync(path.join(binDir, 'node.cmd'), `@echo off\r\n"${execPath}" %*\r\n`)
    for (const name of ['pnpm', 'pnpx']) {
      fs.writeFileSync(path.join(binDir, `${name}.cmd`), `@echo off\r\n"${execPath}" "${pnpmEntry}" ${name === 'pnpx' ? 'dlx ' : ''}%*\r\n`)
    }
    return { binDir }
  }

  const nodeShim = path.join(binDir, 'node')
  unlinkIfPresent(nodeShim)
  fs.symlinkSync(execPath, nodeShim)

  const writePnpmShim = (name, extra = '') => {
    const target = path.join(binDir, name)
    const body = `#!/bin/sh\nexec ${shellQuote(execPath)} ${shellQuote(pnpmEntry)} ${extra}"$@"\n`
    fs.writeFileSync(target, body, { mode: 0o755 })
    fs.chmodSync(target, 0o755)
  }
  writePnpmShim('pnpm')
  writePnpmShim('pnpx', 'dlx ')

  return { binDir, nodeShim, pnpmShim: path.join(binDir, 'pnpm') }
}

module.exports = { prepareBundledToolchain, shellQuote }
