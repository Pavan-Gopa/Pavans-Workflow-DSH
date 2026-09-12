#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const project = path.resolve(process.argv[2] || process.cwd())
const roles = path.join(project, '.dsh', 'roles.yaml')
const example = path.join(project, '.dsh', 'roles.example.yaml')
if (!fs.existsSync(example)) {
  console.error(`Missing ${example}`)
  process.exit(2)
}
if (!fs.existsSync(roles)) {
  fs.copyFileSync(example, roles)
  console.log(`Created ${roles}; replace every REPLACE_ME route before use.`)
} else {
  console.log(`Keeping existing ${roles}`)
}
fs.mkdirSync(path.join(project, 'AI_Workflow_Kit', 'reports'), { recursive: true })
console.log('Workflow state directories ready.')
