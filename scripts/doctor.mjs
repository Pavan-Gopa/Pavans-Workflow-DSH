#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const repoOnly = args.includes('--repo-only')
const pIndex = args.indexOf('--project')
const project = path.resolve(pIndex >= 0 ? args[pIndex + 1] : process.cwd())
let failures = 0
const ok = msg => console.log(`OK   ${msg}`)
const bad = msg => { console.error(`FAIL ${msg}`); failures++ }
const warn = msg => console.warn(`WARN ${msg}`)

const required = [
  '.dsh/roles.example.yaml', '.dsh/skills/pavan-workflow/SKILL.md', '.dsh/skills/ponytail/SKILL.md',
  '.dsh/skills/grilling/SKILL.md', '.dsh/skills/ui-designer/SKILL.md',
  'AI_Workflow_Kit/docs/AI/STATE.yaml', 'AI_Workflow_Kit/docs/STEPS.md', 'AI_Workflow_Kit/docs/DECISIONS.md',
  'AI_Workflow_Kit/script/workflow_gates.py', 'AI_Workflow_Kit/script/workflow_security_scope.py',
]
for (const rel of required) {
  fs.existsSync(path.join(project, rel)) ? ok(rel) : bad(`missing ${rel}`)
}
const nodeMajor = Number(process.versions.node.split('.')[0])
nodeMajor >= 22 ? ok(`Node ${process.versions.node}`) : bad(`Node 22+ required, found ${process.versions.node}`)

const statePath = path.join(project, 'AI_Workflow_Kit/docs/AI/STATE.yaml')
const stepsPath = path.join(project, 'AI_Workflow_Kit/docs/STEPS.md')
if (fs.existsSync(statePath) && fs.existsSync(stepsPath)) {
  const state = fs.readFileSync(statePath, 'utf8')
  const steps = fs.readFileSync(stepsPath, 'utf8')
  const match = state.match(/^current_step:\s*([^#\n]+)/m)
  const current = match?.[1]?.trim().replace(/^['"]|['"]$/g, '')
  if (current && !['null', '~'].includes(current)) {
    const escaped = current.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    new RegExp(`^##\\s+${escaped}\\s+(?:—|-)`, 'm').test(steps) ? ok(`current_step ${current} exists`) : bad(`current_step ${current} missing from STEPS.md`)
  }
}

if (!repoOnly) {
  const rolesPath = path.join(project, '.dsh/roles.yaml')
  if (!fs.existsSync(rolesPath)) bad('missing .dsh/roles.yaml; run scripts/init-state.mjs or install.sh')
  else {
    const text = fs.readFileSync(rolesPath, 'utf8')
    text.includes('REPLACE_ME') ? bad('.dsh/roles.yaml still contains REPLACE_ME') : ok('role routes configured')
  }
  const dsh = spawnSync('dsh', ['--version'], { encoding: 'utf8' })
  if (dsh.status === 0) ok(`dsh available: ${(dsh.stdout || dsh.stderr).trim()}`)
  else bad('dsh not available on PATH')
  const git = spawnSync('git', ['-C', project, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' })
  git.status === 0 ? ok(`git root: ${git.stdout.trim()}`) : warn('project is not a Git repository; diff gates will be limited')
}
process.exit(failures ? 1 : 0)
