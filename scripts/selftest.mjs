#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
let failed = 0
function assert(cond, msg) { if (!cond) { console.error(`FAIL ${msg}`); failed++ } else console.log(`OK   ${msg}`) }

const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
assert(read('README.md').includes('v3.4.2'), 'README declares source workflow v3.4.2')
assert(read('.dsh/skills/pavan-workflow/SKILL.md').includes('model-selectable `subagent`'), 'main skill uses sequential native subagents')
assert(read('.dsh/skills/pavan-workflow/SKILL.md').includes('Automatic backup is forbidden'), 'backup policy is explicit')
assert(read('PIPELINE.md').includes('quick') && read('PIPELINE.md').includes('critical'), 'lean profiles preserved')
assert(read('install.sh').includes('dsh-plugin-codegraph'), 'installer adds Codegraph')
assert(read('install.sh').includes('dsh-quota/releases/download/v0.8.0/dsh-quota.tgz'), 'installer pins quota bundle')

for (const rel of ['pavan-workflow', 'ponytail', 'grilling', 'ui-designer']) {
  const text = read(`.dsh/skills/${rel}/SKILL.md`)
  assert(text.startsWith('---\n') && text.includes('\nname:'), `skill frontmatter: ${rel}`)
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pavan-dsh-'))
fs.mkdirSync(path.join(tmp, 'AI_Workflow_Kit/docs/AI'), { recursive: true })
fs.writeFileSync(path.join(tmp, 'AI_Workflow_Kit/docs/AI/STATE.yaml'), 'current_step: T1\n')
fs.writeFileSync(path.join(tmp, 'AI_Workflow_Kit/docs/STEPS.md'), '# Steps\n\n## T1 — Test\n\n### Objective gates\n\n- [ ] [T1.O1] `node -e "process.exit(0)"`\n')
const gate = spawnSync('python3', [path.join(root, 'AI_Workflow_Kit/script/workflow_gates.py'), 'run', '--project', tmp, '--json'], { encoding: 'utf8' })
assert(gate.status === 0 && gate.stdout.includes('"status": "pass"'), 'Objective Gate runner executes current step command')
const sec = spawnSync('python3', [path.join(root, 'AI_Workflow_Kit/script/workflow_security_scope.py'), '--json', 'src/auth/login.ts', 'src/ui/button.ts'], { encoding: 'utf8' })
assert(sec.status === 0 && sec.stdout.includes('"forbid_quick": true') && sec.stdout.includes('"offer_scoped": true'), 'security scope detects auth path')
fs.rmSync(tmp, { recursive: true, force: true })
process.exit(failed ? 1 : 0)
