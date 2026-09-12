const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const DSH_VERSION = '0.1.5-rc.2'
const PNPM_VERSION = '11.7.0'
const MAX_ROUNDS = 12

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function installedFirstPartyPackages(runtimeRoot) {
  const scope = path.join(runtimeRoot, 'node_modules', '@deepseek-ai')
  if (!fs.existsSync(scope)) return []
  return fs.readdirSync(scope, { withFileTypes: true })
    .filter(entry => entry.isDirectory() || entry.isSymbolicLink())
    .map(entry => {
      const dir = path.join(scope, entry.name)
      const manifest = path.join(dir, 'package.json')
      if (!fs.existsSync(manifest)) return null
      const pkg = readJson(manifest)
      return { dir, manifest, pkg }
    })
    .filter(Boolean)
}

function normalizePeerSpec(name, spec, versionByName) {
  if (typeof spec !== 'string' || !spec) return '*'
  if (!spec.startsWith('workspace:')) return spec
  const installedVersion = versionByName.get(name)
  if (installedVersion) return installedVersion
  if (name.startsWith('@deepseek-ai/dsh-')) return DSH_VERSION
  // Cordis/Schemastery packages use their own release lines. A published npm
  // manifest should already contain a semver range; reaching this fallback is
  // therefore a build-time signal that the registry package is malformed.
  throw new Error(`Cannot resolve workspace peer spec for ${name}: ${spec}`)
}

function findMissingInternalPeers(runtimeRoot) {
  const packages = installedFirstPartyPackages(runtimeRoot)
  const installed = new Set(packages.map(({ pkg }) => pkg.name))
  const versionByName = new Map(packages.map(({ pkg }) => [pkg.name, pkg.version]))
  const missing = new Map()

  for (const { pkg } of packages) {
    const peers = pkg.peerDependencies || {}
    const meta = pkg.peerDependenciesMeta || {}
    for (const [name, rawSpec] of Object.entries(peers)) {
      if (!name.startsWith('@deepseek-ai/')) continue
      // Upstream Desktop closes first-party peer dependencies. Keep optional
      // peers too when they are part of the first-party runtime graph: a DSH
      // config may activate them later without changing the signed app.
      if (installed.has(name)) continue
      const spec = normalizePeerSpec(name, rawSpec, versionByName)
      const previous = missing.get(name)
      if (previous && previous !== spec) {
        throw new Error(`Conflicting peer requirements for ${name}: ${previous} vs ${spec}`)
      }
      missing.set(name, spec)
    }
  }
  return missing
}

function verifyRuntime(runtimeRoot) {
  const dsh = path.join(runtimeRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  const pnpm = path.join(runtimeRoot, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')
  if (!fs.existsSync(dsh)) throw new Error(`DSH runtime is missing: ${dsh}`)
  if (!fs.existsSync(pnpm)) throw new Error(`pnpm runtime is missing: ${pnpm}`)
  const missing = findMissingInternalPeers(runtimeRoot)
  if (missing.size) {
    throw new Error(`DSH runtime has unresolved first-party peers:\n${[...missing].map(([name, spec]) => `  ${name}@${spec}`).join('\n')}`)
  }
  const packages = installedFirstPartyPackages(runtimeRoot)
  if (packages.length < 20) throw new Error(`DSH runtime package set is unexpectedly small: ${packages.length} first-party packages`)
  return {
    dsh,
    pnpm,
    packages: packages.map(({ pkg }) => ({ name: pkg.name, version: pkg.version })).sort((a, b) => a.name.localeCompare(b.name)),
  }
}

function npmCommand() {
  const cli = process.env.npm_execpath
  if (cli && fs.existsSync(cli)) return { command: process.execPath, prefix: [cli] }
  return { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', prefix: [] }
}

function runNpm(runtimeRoot) {
  const npm = npmCommand()
  const args = [
    ...npm.prefix,
    'install',
    '--omit=dev',
    '--no-audit',
    '--no-fund',
    '--package-lock=true',
  ]
  const result = spawnSync(npm.command, args, {
    cwd: runtimeRoot,
    env: {
      ...process.env,
      NODE_OPTIONS: '',
      npm_config_registry: 'https://registry.npmjs.org/',
    },
    stdio: 'inherit',
    timeout: 10 * 60 * 1000,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`npm install for DSH runtime failed with exit code ${result.status}`)
}

function writeManifest(runtimeRoot, dependencies) {
  fs.writeFileSync(path.join(runtimeRoot, 'package.json'), JSON.stringify({
    name: '@pavan-workflow/dsh-runtime',
    private: true,
    version: DSH_VERSION,
    description: 'Closed production runtime for Pavan Workflow Desktop',
    dependencies: Object.fromEntries([...dependencies.entries()].sort(([a], [b]) => a.localeCompare(b))),
  }, null, 2) + '\n')
}

function prepareRuntime(runtimeRoot) {
  fs.rmSync(runtimeRoot, { recursive: true, force: true })
  fs.mkdirSync(runtimeRoot, { recursive: true })
  const dependencies = new Map([
    ['@deepseek-ai/dsh', DSH_VERSION],
    ['pnpm', PNPM_VERSION],
  ])
  writeManifest(runtimeRoot, dependencies)
  runNpm(runtimeRoot)

  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    const missing = findMissingInternalPeers(runtimeRoot)
    if (!missing.size) {
      const verified = verifyRuntime(runtimeRoot)
      const descriptor = {
        schemaVersion: 1,
        dshVersion: DSH_VERSION,
        pnpmVersion: PNPM_VERSION,
        generatedAt: new Date().toISOString(),
        firstPartyPackageCount: verified.packages.length,
        packages: verified.packages,
      }
      fs.writeFileSync(path.join(runtimeRoot, 'pavan-runtime.json'), JSON.stringify(descriptor, null, 2) + '\n')
      console.log(`Prepared closed DSH runtime: ${verified.packages.length} first-party packages`)
      return descriptor
    }

    console.log(`DSH runtime closure round ${round}: adding ${missing.size} missing first-party peer(s)`)
    for (const [name, spec] of missing) dependencies.set(name, spec)
    writeManifest(runtimeRoot, dependencies)
    runNpm(runtimeRoot)
  }

  throw new Error(`DSH runtime did not close after ${MAX_ROUNDS} dependency rounds`)
}

function main() {
  const args = process.argv.slice(2)
  if (args[0] === '--verify') {
    const runtimeRoot = path.resolve(args[1] || '')
    const verified = verifyRuntime(runtimeRoot)
    console.log(`Verified closed DSH runtime: ${verified.packages.length} first-party packages`)
    return
  }

  const root = path.resolve(__dirname, '..')
  const runtimeRoot = path.join(root, 'build', 'dsh-runtime')
  prepareRuntime(runtimeRoot)
}

if (require.main === module) main()

module.exports = { findMissingInternalPeers, installedFirstPartyPackages, prepareRuntime, verifyRuntime }
