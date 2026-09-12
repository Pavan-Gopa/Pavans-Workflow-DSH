# Changelog

## 0.2.0 — 2026-09-12

First public DeepSeek Harness port aligned with Pavan's Workflow v3.4.2.

- Switch normal orchestration to sequential native DSH subagents so Main can verify between gates.
- Preserve `quick`, `standard`, and `critical` profiles.
- Add Coder, Reviewer, Tester, Architect, Security, Design Advisor, and Designer routing.
- Preserve Human-authorized primary/backup route policy.
- Use DSH's implemented model-selected subagent routes and exact Session allowlist.
- Replace Graphify as a required dependency with `dsh-plugin-codegraph` plus LSP/source verification.
- Port Ponytail, Grilling, and UI Designer as project-local DSH skills.
- Use native DSH `todo_write` and compaction instead of porting OMP dashboard/context-economy internals.
- Add `dsh-quota` v0.8.0 as the Web usage/quota layer.
- Port deterministic Objective Gate runner and security-scope detector.
- Add route smoke test, doctor, self-test, and CI.
