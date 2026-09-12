const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { prepareBundledToolchain, shellQuote } = require('./toolchain.cjs')

test('shellQuote preserves paths with spaces and apostrophes', () => {
  assert.equal(shellQuote("/tmp/Pavan's App"), "'/tmp/Pavan'\\''s App'")
})

test('bundled toolchain creates node and pnpm shims on Unix', { skip: process.platform === 'win32' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pavan-toolchain-'))
  const executable = path.join(root, 'Pavan Workflow')
  const pnpmEntry = path.join(root, 'pnpm.cjs')
  fs.writeFileSync(executable, '#!/bin/sh\n')
  fs.writeFileSync(pnpmEntry, 'console.log("pnpm")\n')

  const result = prepareBundledToolchain({ directory: path.join(root, 'toolchain'), execPath: executable, pnpmEntry, platform: 'darwin' })
  assert.equal(fs.readlinkSync(path.join(result.binDir, 'node')), executable)
  const pnpm = fs.readFileSync(path.join(result.binDir, 'pnpm'), 'utf8')
  assert.match(pnpm, /ELECTRON_RUN_AS_NODE=1/)
  assert.match(pnpm, /pnpm\.cjs/)
  assert.ok((fs.statSync(path.join(result.binDir, 'pnpm')).mode & 0o111) !== 0)
  fs.rmSync(root, { recursive: true, force: true })
})
