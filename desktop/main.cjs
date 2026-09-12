const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { installWorkflow } = require('./workflow.cjs')
const { prepareBundledToolchain } = require('./toolchain.cjs')

let window
let harness
let harnessOrigin
let quitting = false
let cachedRuntimePath
let cachedToolchainBin
let cachedNodeRuntime

const READY = /(?:^|\n)dsh web:\s+(http:\/\/127\.0\.0\.1:\d+(?:\/[^\s]*)?)(?:\s|$)/

function stateFile() {
  return path.join(app.getPath('userData'), 'desktop-state.json')
}

function readState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')) } catch { return {} }
}

function writeState(next) {
  fs.mkdirSync(path.dirname(stateFile()), { recursive: true })
  fs.writeFileSync(stateFile(), JSON.stringify(next, null, 2) + '\n')
}

function dshHome() {
  const home = path.join(app.getPath('userData'), 'dsh-home')
  fs.mkdirSync(home, { recursive: true })
  return home
}

function nodeRuntime() {
  if (cachedNodeRuntime) return cachedNodeRuntime

  if (app.isPackaged) {
    const bundled = path.join(process.resourcesPath, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node')
    if (!fs.existsSync(bundled)) {
      throw new Error(`The bundled Node runtime is missing: ${bundled}`)
    }
    cachedNodeRuntime = bundled
    return bundled
  }

  const explicit = process.env.PAVAN_NODE_RUNTIME
  if (explicit && fs.existsSync(explicit)) {
    cachedNodeRuntime = explicit
    return explicit
  }

  const locator = process.platform === 'win32' ? 'where' : '/usr/bin/which'
  try {
    const result = spawnSync(locator, ['node'], { encoding: 'utf8', timeout: 5000 })
    const found = String(result.stdout || '').split(/\r?\n/).find(Boolean)
    if (found && fs.existsSync(found)) {
      cachedNodeRuntime = found
      return found
    }
  } catch {}

  throw new Error('A regular Node runtime is required for Desktop development. Set PAVAN_NODE_RUNTIME to a Node executable.')
}

function assertBundledRuntime() {
  const root = app.getAppPath()
  const required = [
    path.join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
    path.join(root, 'node_modules', '@deepseek-ai', 'cordis-plugin-group', 'package.json'),
    path.join(root, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'),
  ]
  if (app.isPackaged) required.push(path.join(process.resourcesPath, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node'))
  const missing = required.filter(file => !fs.existsSync(file))
  if (missing.length) {
    throw new Error(
      `The Pavan Workflow application bundle is incomplete. Missing runtime file(s):\n${missing.join('\n')}\n\n` +
      'This is a packaging bug, not a problem with your selected project folder.'
    )
  }
}

function dshEntry() {
  assertBundledRuntime()
  return path.join(app.getAppPath(), 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
}

function pnpmEntry() {
  assertBundledRuntime()
  return path.join(app.getAppPath(), 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')
}

function toolchainBin() {
  if (cachedToolchainBin) return cachedToolchainBin
  cachedToolchainBin = prepareBundledToolchain({
    directory: path.join(app.getPath('userData'), 'toolchain'),
    execPath: nodeRuntime(),
    pnpmEntry: pnpmEntry(),
  }).binDir
  return cachedToolchainBin
}

function runtimePath() {
  if (cachedRuntimePath) return cachedRuntimePath

  const pathValues = [toolchainBin()]
  if (process.platform === 'darwin') {
    const preferredShell = process.env.SHELL && fs.existsSync(process.env.SHELL) ? process.env.SHELL : '/bin/zsh'
    try {
      const shellEnv = { ...process.env }
      delete shellEnv.ELECTRON_RUN_AS_NODE
      const result = spawnSync(preferredShell, ['-ilc', `printf '\n__PAVAN_PATH__%s\n' "$PATH"`], {
        encoding: 'utf8',
        timeout: 5000,
        env: shellEnv,
      })
      const matches = String(result.stdout || '').match(/__PAVAN_PATH__([^\r\n]*)/g) || []
      const last = matches.at(-1)
      if (last) pathValues.push(last.replace('__PAVAN_PATH__', ''))
    } catch {}
  }

  pathValues.push(process.env.PATH || '')
  if (process.platform === 'darwin') pathValues.push('/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin')
  pathValues.push('/usr/bin:/bin:/usr/sbin:/sbin')

  const seen = new Set()
  cachedRuntimePath = pathValues
    .flatMap(value => String(value).split(path.delimiter))
    .map(value => value.trim())
    .filter(value => value && !seen.has(value) && seen.add(value))
    .join(path.delimiter)
  return cachedRuntimePath
}

function dshEnv() {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  return {
    ...env,
    PATH: runtimePath(),
    DSH_HOME: dshHome(),
    DSH_TELEMETRY_DISABLED: process.env.DSH_TELEMETRY_DISABLED ?? '1',
  }
}

function emitStatus(stage, message, kind = 'info') {
  if (window && !window.isDestroyed()) window.webContents.send('desktop:status', { stage, message, kind })
}

function runDshOnce(args, cwd, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const child = spawn(nodeRuntime(), [dshEntry(), ...args], {
      cwd,
      env: dshEnv(),
      shell: false,
      windowsHide: true,
    })
    let output = ''
    child.stdout?.on('data', chunk => { output = (output + String(chunk)).slice(-12000) })
    child.stderr?.on('data', chunk => { output = (output + String(chunk)).slice(-12000) })
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`Command timed out: dsh ${args.join(' ')}`))
    }, timeoutMs)
    child.once('error', error => { clearTimeout(timer); reject(error) })
    child.once('exit', code => {
      clearTimeout(timer)
      if (code === 0) resolve(output)
      else reject(new Error(`dsh ${args.join(' ')} failed with exit code ${code}.\n${output}`))
    })
  })
}

async function ensureRecommendedPlugins(workspace) {
  const marker = path.join(dshHome(), 'pavan-recommended-plugins-v1')
  if (fs.existsSync(marker)) return
  const installs = [
    ['Codegraph', ['plugin', '--profile', 'web', 'add', 'dsh-plugin-codegraph']],
    ['Usage / quota', ['plugin', '--profile', 'web', 'add', 'https://github.com/Lottle7/dsh-quota/releases/download/v0.8.0/dsh-quota.tgz']],
  ]
  let allOk = true
  for (const [name, args] of installs) {
    emitStatus('plugins', `Installing ${name}…`)
    try { await runDshOnce(args, workspace) }
    catch (error) {
      allOk = false
      emitStatus('plugins', `${name} could not be installed. Harness will still start. ${error.message}`, 'warning')
    }
  }
  if (allOk) fs.writeFileSync(marker, new Date().toISOString() + '\n')
}

function stopHarness() {
  if (!harness || harness.exitCode !== null || harness.signalCode !== null) return
  try {
    if (process.platform !== 'win32' && harness.pid) process.kill(-harness.pid, 'SIGTERM')
    else harness.kill('SIGTERM')
  } catch {
    try { harness.kill('SIGTERM') } catch {}
  }
}

function startHarness(workspace) {
  return new Promise((resolve, reject) => {
    let output = ''
    harnessOrigin = null
    emitStatus('harness', 'Starting the bundled DeepSeek Harness…')
    harness = spawn(nodeRuntime(), [dshEntry(), 'web', '--port', '0', '--no-open'], {
      cwd: workspace,
      env: dshEnv(),
      detached: process.platform !== 'win32',
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let settled = false
    const fail = error => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(error)
    }
    const succeed = url => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve(url)
    }
    const timeout = setTimeout(() => {
      stopHarness()
      fail(new Error('DeepSeek Harness did not become ready within 120 seconds.'))
    }, 120000)
    const receive = chunk => {
      output = (output + String(chunk)).slice(-24000)
      const match = output.match(READY)
      if (match?.[1]) succeed(match[1])
    }
    harness.stdout?.on('data', receive)
    harness.stderr?.on('data', receive)
    harness.once('error', fail)
    harness.once('exit', (code, signal) => {
      if (!quitting && !harnessOrigin && !settled) {
        fail(new Error(`DeepSeek Harness exited before startup (code ${code}, signal ${signal}).\n${output.slice(-5000)}`))
      }
    })
  })
}

function secureHarnessNavigation(url) {
  let origin
  try { origin = new URL(url).origin } catch { return }
  harnessOrigin = origin
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    try {
      if (new URL(target).origin === origin) return { action: 'allow' }
    } catch {}
    shell.openExternal(target).catch(() => {})
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, target) => {
    try {
      if (new URL(target).origin === origin) return
    } catch {}
    event.preventDefault()
    shell.openExternal(target).catch(() => {})
  })
}

async function registerWorkspace(workspace) {
  // The DSH workspace registry is independent from the process cwd. Register
  // the directory through the supported Remote endpoint after the first page
  // load establishes Harness' local auth cookie. The HTTP carrier requires the
  // normal Typert client-request envelope, not a raw { args } object.
  const encodedPath = JSON.stringify(workspace)
  const result = await window.webContents.executeJavaScript(`
    (async () => {
      const method = 'workspace/create'
      const response = await fetch('/api/' + method, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: 'pavan-workspace-' + crypto.randomUUID(),
          method,
          payload: { args: { request: { path: ${encodedPath} } } },
        }),
      })
      const text = await response.text()
      return { ok: response.ok, status: response.status, text }
    })()
  `, true)

  if (!result?.ok) throw new Error(`workspace/create returned HTTP ${result?.status ?? 'unknown'}: ${result?.text ?? ''}`)
  let envelope
  try { envelope = JSON.parse(result.text) } catch { throw new Error(`workspace/create returned invalid JSON: ${result.text}`) }
  if (envelope?.result?.ok !== true) {
    throw new Error(`workspace/create failed: ${envelope?.result?.error?.message ?? JSON.stringify(envelope)}`)
  }
  const registered = envelope.result.value?.workspace
  if (!registered || typeof registered.path !== 'string') {
    throw new Error(`workspace/create returned no Workspace projection: ${JSON.stringify(envelope)}`)
  }
  const requestedPath = fs.realpathSync(workspace)
  const registeredPath = fs.realpathSync(registered.path)
  if (registeredPath !== requestedPath) {
    throw new Error(`Harness registered a different Workspace path: ${registered.path}`)
  }
  return envelope.result.value
}

function createWindow() {
  window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 650,
    title: 'Pavan Workflow',
    backgroundColor: '#0f1115',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.once('ready-to-show', () => window.show())
  window.loadFile(path.join(__dirname, 'setup.html'))
}

ipcMain.handle('desktop:get-state', () => ({ ...readState(), version: app.getVersion() }))
ipcMain.handle('desktop:pick-workspace', async () => {
  const result = await dialog.showOpenDialog(window, { properties: ['openDirectory', 'createDirectory'], title: 'Choose a project folder' })
  return result.canceled ? null : result.filePaths[0]
})
ipcMain.handle('desktop:launch', async (_event, options) => {
  const workspace = path.resolve(String(options?.workspace ?? ''))
  if (!workspace || !fs.existsSync(workspace)) throw new Error('Choose an existing project folder first.')

  emitStatus('workflow', 'Installing Pavan Workflow into the selected project…')
  const installed = installWorkflow(app.getAppPath(), workspace)
  writeState({ ...readState(), lastWorkspace: workspace })
  emitStatus('workflow', `Project prepared successfully: ${workspace}`)

  if (options?.installPlugins !== false) await ensureRecommendedPlugins(workspace)

  let url
  try {
    url = await startHarness(workspace)
  } catch (error) {
    throw new Error(
      `The project folder was prepared successfully, but the bundled DeepSeek Harness failed to start.\n\n${error.message}`
    )
  }

  emitStatus('ready', 'Harness is ready. Registering the selected workspace…')
  secureHarnessNavigation(url)
  await window.loadURL(url)
  try {
    await registerWorkspace(workspace)
  } catch (error) {
    await dialog.showMessageBox(window, {
      type: 'warning',
      title: 'Workspace registration failed',
      message: 'Harness started, but the selected folder could not be added to the Workspace list automatically.',
      detail: String(error?.message ?? error),
    })
  }
  return { workspace, roles: installed.roles, url }
})

const lock = app.requestSingleInstanceLock()
if (!lock) app.quit()
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus() } })
  app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  })
}

app.on('before-quit', () => { quitting = true; stopHarness() })
app.on('window-all-closed', () => app.quit())
