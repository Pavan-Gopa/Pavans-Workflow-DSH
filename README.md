# Pavan Workflow — DeepSeek Harness Edition

A Human-supervised, multi-model software-development workflow for DeepSeek Harness, aligned with [Pavan's Workflow](https://github.com/Pavan-Gopa/Pavans-Workflow) v3.4.2.

## Download the desktop app

The preferred distribution is **Pavan Workflow Desktop**. It bundles the official DeepSeek Harness runtime, so normal users do **not** need Node.js, `npm`, `npx`, `git clone`, or a terminal just to launch the app.

Open this repository's **Releases** page and download the macOS build for your Mac:

- `Pavan-Workflow-0.3.0-alpha.2-macos-arm64.dmg` — Apple Silicon (M1/M2/M3/M4 and later)
- `Pavan-Workflow-0.3.0-alpha.2-macos-x64.dmg` — Intel Mac

Then open the DMG, drag **Pavan Workflow** to Applications, and launch it. On first launch:

1. choose the project folder you want to work on;
2. Pavan Workflow installs its project-local skills and workflow state without overwriting an existing `.dsh/roles.yaml`;
3. the bundled DeepSeek Harness starts locally inside the desktop app;
4. configure model providers in **Settings -> Models**;
5. authorize child routes in **Settings -> Plugins -> Subagent model selection**;
6. start a new session and use the `pavan-workflow` skill.

> **macOS alpha signing:** current public alpha builds are unsigned unless an Apple Developer ID certificate is configured for the repository. macOS may require **Open Anyway** in System Settings -> Privacy & Security. Proper Developer ID signing/notarization is the remaining step for a warning-free double-click install.

## What the desktop app actually contains

```text
Pavan Workflow.app
  -> Electron desktop shell
  -> bundled official @deepseek-ai/dsh runtime
  -> local DSH Web UI inside the native window
  -> Pavan Workflow project skills + state templates
  -> optional Codegraph + usage/quota plugin setup
```

DeepSeek Harness remains the engine. The desktop shell owns startup, project selection, workflow installation, local runtime lifecycle, and the native application window.

## Core workflow

```text
Human <-> Main
          |
          +-> fresh Coder
          |      |
          |      v
          |   Main verifies source + diff + Objective Gates
          |      |
          +-> fresh Reviewer
          |      |
          |      v
          |   Main verifies findings against real source
          |      |
          +-> fresh Tester
                 |
                 v
             Main verifies tests + acceptance -> next step
```

Main is the only router. Workers do not hand work directly to one another, mutate canonical workflow state, commit/push, or silently switch model routes. Every retry uses a fresh specialist session.

## Multi-model routing

The included recommended first-run preset uses three independent routes:

| Role | Primary route |
| --- | --- |
| Coder | `deepseek-official / deepseek-v4-pro` |
| Reviewer | `anthropic / claude-opus-4-8` |
| Tester | `openai / gpt-5.5` |
| Architect | `anthropic / claude-opus-4-8` |
| Security | `openai / gpt-5.5` |
| Design Advisor | `anthropic / claude-opus-4-8` |
| Designer | `openai / gpt-5.5` |

Backups are cross-provider and **Human-authorized only**. No automatic failover is allowed.

The exact routes are examples, not a requirement. If your configured provider exposes different model IDs, edit the project-local `.dsh/roles.yaml` to match the exact IDs DSH exposes.

## Pipeline profiles

- **standard** — Coder -> Reviewer -> Tester (default).
- **quick** — may close after green Objective Gates, but is forbidden for high-risk or auth/credential/API/schema/migration/trust-boundary diffs.
- **critical** — Reviewer and Tester remain on; Main offers a scoped Security pass when warranted.

See [`PIPELINE.md`](PIPELINE.md).

## OMP -> DSH mapping

| Original concept | DSH edition |
| --- | --- |
| Main session | DSH root session |
| Fresh task-agents | native model-selectable `subagent` children |
| Per-role aliases | `.dsh/roles.yaml` exact provider/model routes |
| Agent Hub | DSH child sessions / trajectory |
| Todo/dashboard | DSH `todo_write` + file-backed canonical state |
| Graphify | `dsh-plugin-codegraph` + native LSP/source verification |
| Ponytail | project-local DSH `ponytail` skill |
| Grilling | project-local DSH `grilling` skill |
| UI Designer | project-local DSH `ui-designer` skill + design roles |
| Context economy | DSH native compaction/token-pressure system |
| `omp usage` | `dsh-quota` Web plugin |

## Why the normal gate loop uses `subagent`

The normal pipeline deliberately dispatches specialists sequentially. Main must regain control after Coder, inspect the actual workspace/diff, rerun deterministic gates, and only then dispatch Reviewer. The same rule applies before Tester.

DSH `workflow` / `parallel()` remains useful for independent read-only research or adversarial analysis where children do not depend on prior mutations.

## Canonical state

The project overlay keeps durable state under:

```text
AI_Workflow_Kit/docs/AI/STATE.yaml
AI_Workflow_Kit/docs/STEPS.md
AI_Workflow_Kit/docs/DECISIONS.md
AI_Workflow_Kit/docs/AI/FEEDBACK.md
```

Only Main owns semantic workflow state.

## Developer / CLI installation

The desktop app is the preferred end-user path, but the overlay can still be installed manually:

```bash
git clone https://github.com/Pavan-Gopa/Pavans-Workflow-DSH.git
cd Pavans-Workflow-DSH
./install.sh --target /path/to/project --preset recommended
cd /path/to/project
npx @deepseek-ai/dsh web
```

See [`FIRST_RUN.md`](FIRST_RUN.md) and [`ROUTING_TEST.md`](ROUTING_TEST.md).

## Desktop development

```bash
npm install
npm test
npm run desktop:check
npm run desktop
```

Build macOS installers with:

```bash
npm run desktop:dist:mac -- --arm64
npm run desktop:dist:mac -- --x64
```

GitHub Actions builds both architectures and smoke-tests the **packaged** DSH runtime, not only the source tree.

## Safety invariants

1. Main is the only workflow-state writer and router.
2. Conversation history is not authoritative; canonical files and real repository state are.
3. Main verifies every worker result before routing.
4. Fresh workers receive bounded, self-contained assignments.
5. Backups are Human-authorized, never automatic.
6. Provider/model failures do not count as implementation failures.
7. Three materially identical no-progress failures stop automatic retrying.
8. `quick` never outranks security or public-contract risk.
9. Workers never commit/push unless a Human explicitly changes the contract.
10. Effective child route evidence is part of the gate.

## Status

Both this project and DeepSeek Harness are in developer preview. The desktop shell intentionally stays thin so upstream DSH can be upgraded without maintaining a permanent fork.

## License

MIT. See [`LICENSE`](LICENSE).
