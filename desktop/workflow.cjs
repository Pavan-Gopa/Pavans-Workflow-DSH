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

function installWorkflow(bundleRoot, workspace) {
  const required = [
    path.join(bundleRoot, '.dsh', 'skills'),
    path.join(bundleRoot, 'AI_Workflow_Kit'),
    path.join(bundleRoot, '.dsh', 'roles.recommended.yaml'),
  ]
  for (const item of required) {
    if (!fs.existsSync(item)) throw new Error(`Bundled workflow asset is missing: ${item}`)
  }
  if (!fs.existsSync(workspace) || !fs.statSync(workspace).isDirectory()) {
    throw new Error('Selected project folder does not exist.')
  }

  copyMissing(path.join(bundleRoot, '.dsh', 'skills'), path.join(workspace, '.dsh', 'skills'))
  copyMissing(path.join(bundleRoot, 'AI_Workflow_Kit'), path.join(workspace, 'AI_Workflow_Kit'))
  copyMissing(path.join(bundleRoot, '.dsh', 'roles.example.yaml'), path.join(workspace, '.dsh', 'roles.example.yaml'))
  copyMissing(path.join(bundleRoot, '.dsh', 'roles.recommended.yaml'), path.join(workspace, '.dsh', 'roles.recommended.yaml'))

  const roles = path.join(workspace, '.dsh', 'roles.yaml')
  if (!fs.existsSync(roles)) {
    fs.mkdirSync(path.dirname(roles), { recursive: true })
    fs.copyFileSync(path.join(bundleRoot, '.dsh', 'roles.recommended.yaml'), roles)
  }

  const marker = path.join(workspace, '.dsh', 'pavan-workflow-desktop.json')
  fs.writeFileSync(marker, JSON.stringify({ installedAt: new Date().toISOString(), source: 'Pavan Workflow Desktop' }, null, 2) + '\n')

  return {
    roles,
    marker,
    usedExistingRoles: fs.readFileSync(roles, 'utf8') !== fs.readFileSync(path.join(bundleRoot, '.dsh', 'roles.recommended.yaml'), 'utf8'),
  }
}

module.exports = { copyMissing, installWorkflow }
