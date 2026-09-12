const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { installWorkflow } = require('./workflow.cjs')

let window
let harness
let harnessOrigin
let quitting = false

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

function dshEntry() {
  const entry = path.join(app.getAppPath(), 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  if (!fs.existsSync(entry)) throw new Error(`Bundled DeepSeek Harness entrypoint is missing: ${entry}`)
  return entry
}

function dshEnv() {
  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    DSH_HOME: dshHome(),
    DSH_TELEMETRY_DISABLED: process.env.DSH_TELEMETRY_DISABLED ?? '1',
  }
}

function emitStatus(stage, message, kind = 'info') {
  if (window && !window.isDestroyed()) window.webContents.send('desktop:status', { stage, message, kind })
}

function runDshOnce(args, cwd, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [dshEntry(), ...args], {
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
    emitStatus('harness', 'Starting the bundled DeepSeek Harness…')
    harness = spawn(process.execPath, [dshEntry(), 'web', '--port', '0', '--no-open'], {
      cwd: workspace,
      env: dshEnv(),
      detached: process.platform !== 'win32',
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const timeout = setTimeout(() => reject(new Error('DeepSeek Harness did not become ready within 120 seconds.')), 120000)
    const receive = chunk => {
      output = (output + String(chunk)).slice(-24000)
      const match = output.match(READY)
      if (match?.[1]) {
        clearTimeout(timeout)
        resolve(match[1])
      }
    }
    harness.stdout?.on('data', receive)
    harness.stderr?.on('data', receive)
    harness.once('error', error => { clearTimeout(timeout); reject(error) })
    harness.once('exit', (code, signal) => {
      if (!quitting && !harnessOrigin) {
        clearTimeout(timeout)
        reject(new Error(`DeepSeek Harness exited before startup (code ${code}, signal ${signal}).\n${output.slice(-5000)}`))
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
  const state = { ...readState(), lastWorkspace: workspace }
  writeState(state)

  if (options?.installPlugins !== false) await ensureRecommendedPlugins(workspace)
  const url = await startHarness(workspace)
  emitStatus('ready', 'Harness is ready. Opening the workspace…')
  secureHarnessNavigation(url)
  await window.loadURL(url)
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
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); else app.quit() })
