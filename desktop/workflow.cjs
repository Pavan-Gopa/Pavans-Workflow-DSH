const fs = require('node:fs')
const path = require('node:path')

function copyMissing(source, destination) {
  const stat = fs.statSync(source)
  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true })
    for (const name of fs.readdirSync(source)) {
      copyMissing(path.join(source, name), path.join(destination, name))
    }
    return
  }
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(source, destination)
  }
}

function copyManaged(source, destination) {
  const stat = fs.statSync(source)
  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true })
    for (const name of fs.readdirSync(source)) {
      copyManaged(path.join(source, name), path.join(destination, name))
    }
    return
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.copyFileSync(source, destination)
}

function readBundleVersion(bundleRoot) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(bundleRoot, 'package.json'), 'utf8'))
    return typeof parsed.version === 'string' ? parsed.version : null
  } catch {
    return null
  }
}

function installWorkflow(bundleRoot, workspace) {
  const required = [
    path.join(bundleRoot, '.dsh', 'skills'),
    path.join(bundleRoot, 'AI_Workflow_Kit'),
    path.join(bundleRoot, '.dsh', 'roles.example.yaml'),
    path.join(bundleRoot, '.dsh', 'roles.recommended.yaml'),
  ]
  for (const item of required) {
    if (!fs.existsSync(item)) throw new Error(`Bundled workflow asset is missing: ${item}`)
  }
  if (!fs.existsSync(workspace) || !fs.statSync(workspace).isDirectory()) {
    throw new Error('Selected project folder does not exist.')
  }

  // Seed project state once. STEPS, DECISIONS, PROJECT_CONTEXT, STATE and
  // FEEDBACK are project-owned after creation and must survive app upgrades.
  copyMissing(path.join(bundleRoot, 'AI_Workflow_Kit'), path.join(workspace, 'AI_Workflow_Kit'))

  // Skills and deterministic helper/reference files are distribution-owned.
  // Refresh them on every launch so installing a newer Desktop actually
  // upgrades the workflow without touching the project's durable state.
  copyManaged(path.join(bundleRoot, '.dsh', 'skills'), path.join(workspace, '.dsh', 'skills'))
  copyManaged(path.join(bundleRoot, '.dsh', 'roles.example.yaml'), path.join(workspace, '.dsh', 'roles.example.yaml'))
  copyManaged(path.join(bundleRoot, '.dsh', 'roles.recommended.yaml'), path.join(workspace, '.dsh', 'roles.recommended.yaml'))

  const bundledScript = path.join(bundleRoot, 'AI_Workflow_Kit', 'script')
  if (fs.existsSync(bundledScript)) {
    copyManaged(bundledScript, path.join(workspace, 'AI_Workflow_Kit', 'script'))
  }
  const leanPipeline = path.join(bundleRoot, 'AI_Workflow_Kit', 'docs', 'AI', 'LEAN_PIPELINE.md')
  if (fs.existsSync(leanPipeline)) {
    copyManaged(leanPipeline, path.join(workspace, 'AI_Workflow_Kit', 'docs', 'AI', 'LEAN_PIPELINE.md'))
  }

  const roles = path.join(workspace, '.dsh', 'roles.yaml')
  if (!fs.existsSync(roles)) {
    fs.mkdirSync(path.dirname(roles), { recursive: true })
    fs.copyFileSync(path.join(bundleRoot, '.dsh', 'roles.recommended.yaml'), roles)
  }

  const marker = path.join(workspace, '.dsh', 'pavan-workflow-desktop.json')
  let previous = {}
  try { previous = JSON.parse(fs.readFileSync(marker, 'utf8')) } catch {}
  const now = new Date().toISOString()
  fs.writeFileSync(marker, JSON.stringify({
    schemaVersion: 1,
    firstInstalledAt: previous.firstInstalledAt || previous.installedAt || now,
    installedAt: now,
    workflowVersion: readBundleVersion(bundleRoot),
    source: 'Pavan Workflow Desktop',
  }, null, 2) + '\n')

  return {
    roles,
    marker,
    usedExistingRoles: fs.readFileSync(roles, 'utf8') !== fs.readFileSync(path.join(bundleRoot, '.dsh', 'roles.recommended.yaml'), 'utf8'),
  }
}

module.exports = { copyMissing, copyManaged, installWorkflow }
