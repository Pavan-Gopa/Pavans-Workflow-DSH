# Pavan Workflow — DeepSeek Harness Edition

A Human-supervised, multi-model software-development workflow for DeepSeek Harness, aligned with [Pavan's Workflow](https://github.com/Pavan-Gopa/Pavans-Workflow) v3.4.2.

## Download the desktop app

The preferred distribution is **Pavan Workflow Desktop**. It bundles DeepSeek Harness, a regular Node 24 runtime, and pnpm, so normal users do **not** need Node.js, `npm`, `npx`, `git clone`, or a terminal just to launch the app.

Open this repository's **Releases** page and download the newest macOS build for your Mac. The next qualified build is `0.3.0-alpha.3`:

- `Pavan-Workflow-0.3.0-alpha.3-macos-arm64.dmg` — Apple Silicon (M1/M2/M3/M4 and later)
- `Pavan-Workflow-0.3.0-alpha.3-macos-x64.dmg` — Intel Mac

Then open the DMG, drag **Pavan Workflow** to Applications, and launch it. On first launch:

1. choose the project folder you want to work on;
2. Pavan Workflow installs/updates its managed project-local skills and helpers while preserving project state and an existing `.dsh/roles.yaml`;
3. the bundled DeepSeek Harness starts under the app's bundled regular Node runtime inside the desktop app;
4. the chosen directory is registered through Harness' persistent Workspace API, not merely used as the process working directory;
5. configure model providers in **Settings -> Models**;
6. authorize child routes in **Settings -> Plugins -> Subagent model selection**;
7. start a new session and use the `pavan-workflow` skill.

> **macOS alpha signing:** builds are ad-hoc signed, but they are not Apple Developer ID signed/notarized. macOS may therefore require **Open Anyway** in System Settings -> Privacy & Security. Proper Developer ID signing and notarization are the remaining steps for a warning-free double-click install.

## What the desktop app actually contains

```text
Pavan Workflow.app
  -> Electron shell for the native application window
  -> bundled regular Node 24 runtime for Harness, tools and plugins
  -> bundled @deepseek-ai/dsh runtime + required runtime peers
  -> bundled pnpm + app-owned node/pnpm shims
  -> local DSH Web UI inside the native window
  -> Pavan Workflow project skills + state templates
  -> optional Codegraph + usage/quota plugin setup
```

Electron is only the shell. The Harness process, pnpm, subprocess-facing Node shim, and coding runtime do not use Electron's patched Node mode. This mirrors the important runtime-isolation principle used by upstream DSH Desktop and avoids tying native coding tools to Electron's ABI/lifecycle.

### Desktop release qualification

A desktop release is not accepted merely because source tests pass. GitHub Actions must, on **both Apple Silicon and Intel**:

1. build the DMG/ZIP and generate the macOS whale icon;
2. copy the completed `.app` outside the repository checkout, so it cannot accidentally resolve dependencies from build-time `node_modules`;
3. verify the packaged regular Node runtime, DSH runtime, required Cordis runtime peer, bundled pnpm, workflow skills, generated `.icns`, and code signature;
4. run DSH and pnpm with the packaged regular Node runtime rather than Electron-as-Node;
5. invoke the workflow installer from the packaged app against a fresh temporary project;
6. verify project-local roles, skills, marker, and canonical state are actually written;
7. start the packaged Harness from that project and wait for its real ready signal;
8. authenticate through the same browser-token exchange used by DSH and require `workspace/create` to register the selected project successfully.

This gate exists specifically to catch failures that only appear after the app is moved to `/Applications`.

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

Only Main owns semantic workflow state. Desktop upgrades preserve these project-owned files and `.dsh/roles.yaml`; distribution-owned skills/helpers are refreshed to the app version.

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

GitHub Actions builds both architectures and tests the **isolated packaged application**, not only the source tree.

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

Both this project and DeepSeek Harness are in developer preview. The desktop shell intentionally stays thin enough to follow upstream DSH, but a release is only published after isolated packaged-runtime qualification on both supported macOS architectures. A successful Desktop boot is still not considered proof of multi-model orchestration: the final workflow gate is a real Coder -> Main verify -> Reviewer -> Main verify -> Tester -> Main verify run with the user's configured provider routes.

## License

MIT. See [`LICENSE`](LICENSE).
