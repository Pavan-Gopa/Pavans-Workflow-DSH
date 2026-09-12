const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { installWorkflow } = require('./workflow.cjs')

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, contents)
}

test('desktop installer upgrades managed workflow files but preserves project state and roles', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pavan-desktop-test-'))
  const bundle = path.join(root, 'bundle')
  const project = path.join(root, 'project')

  write(path.join(bundle, 'package.json'), JSON.stringify({ version: '9.8.7-test' }))
  write(path.join(bundle, '.dsh', 'skills', 'pavan-workflow', 'SKILL.md'), 'new-skill')
  write(path.join(bundle, '.dsh', 'roles.example.yaml'), 'new-example')
  write(path.join(bundle, '.dsh', 'roles.recommended.yaml'), 'new-recommended')
  write(path.join(bundle, 'AI_Workflow_Kit', 'docs', 'STEPS.md'), 'template-steps')
  write(path.join(bundle, 'AI_Workflow_Kit', 'docs', 'DECISIONS.md'), 'template-decisions')
  write(path.join(bundle, 'AI_Workflow_Kit', 'docs', 'AI', 'STATE.yaml'), 'template-state')
  write(path.join(bundle, 'AI_Workflow_Kit', 'docs', 'AI', 'LEAN_PIPELINE.md'), 'new-lean')
  write(path.join(bundle, 'AI_Workflow_Kit', 'script', 'workflow_gates.py'), 'new-helper')

  write(path.join(project, '.dsh', 'roles.yaml'), 'custom-routes')
  write(path.join(project, '.dsh', 'roles.example.yaml'), 'old-example')
  write(path.join(project, '.dsh', 'roles.recommended.yaml'), 'old-recommended')
  write(path.join(project, '.dsh', 'skills', 'pavan-workflow', 'SKILL.md'), 'old-skill')
  write(path.join(project, 'AI_Workflow_Kit', 'docs', 'STEPS.md'), 'user-steps')
  write(path.join(project, 'AI_Workflow_Kit', 'docs', 'DECISIONS.md'), 'user-decisions')
  write(path.join(project, 'AI_Workflow_Kit', 'docs', 'AI', 'STATE.yaml'), 'user-state')
  write(path.join(project, 'AI_Workflow_Kit', 'docs', 'AI', 'LEAN_PIPELINE.md'), 'old-lean')
  write(path.join(project, 'AI_Workflow_Kit', 'script', 'workflow_gates.py'), 'old-helper')

  const result = installWorkflow(bundle, project)

  // Human/project-owned files survive upgrades.
  assert.equal(fs.readFileSync(path.join(project, '.dsh', 'roles.yaml'), 'utf8'), 'custom-routes')
  assert.equal(fs.readFileSync(path.join(project, 'AI_Workflow_Kit', 'docs', 'STEPS.md'), 'utf8'), 'user-steps')
  assert.equal(fs.readFileSync(path.join(project, 'AI_Workflow_Kit', 'docs', 'DECISIONS.md'), 'utf8'), 'user-decisions')
  assert.equal(fs.readFileSync(path.join(project, 'AI_Workflow_Kit', 'docs', 'AI', 'STATE.yaml'), 'utf8'), 'user-state')

  // Distribution-owned files are refreshed by a newer Desktop build.
  assert.equal(fs.readFileSync(path.join(project, '.dsh', 'skills', 'pavan-workflow', 'SKILL.md'), 'utf8'), 'new-skill')
  assert.equal(fs.readFileSync(path.join(project, '.dsh', 'roles.example.yaml'), 'utf8'), 'new-example')
  assert.equal(fs.readFileSync(path.join(project, '.dsh', 'roles.recommended.yaml'), 'utf8'), 'new-recommended')
  assert.equal(fs.readFileSync(path.join(project, 'AI_Workflow_Kit', 'docs', 'AI', 'LEAN_PIPELINE.md'), 'utf8'), 'new-lean')
  assert.equal(fs.readFileSync(path.join(project, 'AI_Workflow_Kit', 'script', 'workflow_gates.py'), 'utf8'), 'new-helper')

  assert.equal(result.usedExistingRoles, true)
  const marker = JSON.parse(fs.readFileSync(path.join(project, '.dsh', 'pavan-workflow-desktop.json'), 'utf8'))
  assert.equal(marker.schemaVersion, 1)
  assert.equal(marker.workflowVersion, '9.8.7-test')
  assert.ok(marker.firstInstalledAt)
  assert.ok(marker.installedAt)

  fs.rmSync(root, { recursive: true, force: true })
})

test('desktop installer seeds recommended roles and project state on first install', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pavan-desktop-test-'))
  const bundle = path.join(root, 'bundle')
  const project = path.join(root, 'project')
  fs.mkdirSync(project, { recursive: true })

  write(path.join(bundle, 'package.json'), JSON.stringify({ version: '1.2.3-test' }))
  write(path.join(bundle, '.dsh', 'skills', 'pavan-workflow', 'SKILL.md'), 'skill')
  write(path.join(bundle, '.dsh', 'roles.example.yaml'), 'example')
  write(path.join(bundle, '.dsh', 'roles.recommended.yaml'), 'recommended')
  write(path.join(bundle, 'AI_Workflow_Kit', 'docs', 'STEPS.md'), 'steps')

  const result = installWorkflow(bundle, project)

  assert.equal(fs.readFileSync(path.join(project, '.dsh', 'roles.yaml'), 'utf8'), 'recommended')
  assert.equal(fs.readFileSync(path.join(project, '.dsh', 'skills', 'pavan-workflow', 'SKILL.md'), 'utf8'), 'skill')
  assert.equal(fs.readFileSync(path.join(project, 'AI_Workflow_Kit', 'docs', 'STEPS.md'), 'utf8'), 'steps')
  assert.equal(result.usedExistingRoles, false)

  fs.rmSync(root, { recursive: true, force: true })
})
