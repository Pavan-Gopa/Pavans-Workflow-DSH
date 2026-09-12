# Pavan's Workflow — DeepSeek Harness Edition

A DeepSeek Harness (`dsh`) port of [Pavan's Workflow](https://github.com/Pavan-Gopa/Pavans-Workflow), aligned with the OMP workflow's **v3.4.2** behavior: one Human-supervised Main agent owns routing and durable state, while fresh specialist agents implement, review, test, design, architect, and audit the same project on deliberately different model routes.

> **Status:** developer preview. DeepSeek Harness is still evolving quickly. This repository keeps the workflow as a small overlay on top of upstream DSH instead of forking the Harness itself.

## What this preserves

The default loop remains:

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

Main is the only router. Workers do not hand work to each other, mutate workflow state, commit, push, or silently switch model routes. Every retry is a fresh worker session.

## The important DSH adaptation

The normal gate loop uses DSH's **native model-selectable `subagent` tool sequentially**, not one monolithic `workflow` script. This is intentional: Main must regain control after each worker so it can inspect the actual workspace before routing the next gate.

DSH's `workflow` tool is still useful, but only for independent fan-out work such as parallel research or adversarial read-only analysis where no child depends on Main verifying another child's modifications first.

## OMP -> DSH mapping

| OMP concept | DSH edition |
| --- | --- |
| Main session | DSH root Web session |
| Fresh task-agents | Native DSH `subagent` children |
| Per-role model aliases | `.dsh/roles.yaml` exact provider/model routes |
| Agent Hub | DSH Web child sessions / trajectory |
| Native Todo + Alt+W dashboard | DSH `todo_write` plan UI + file-backed canonical state |
| Graphify | `dsh-plugin-codegraph` + native LSP/source verification |
| Ponytail | Project-local DSH `ponytail` skill |
| Grilling | Project-local DSH `grilling` skill |
| UI Designer | Project-local DSH `ui-designer` skill + Design Advisor/Designer roles |
| Context Economy plumbing | DSH native compaction + token pressure accounting |
| `omp usage` / Stats | `dsh-quota` in DSH Web |
| OMP role backups | Explicit Human-authorized backup route per role |

## Why Codegraph instead of Graphify

`dsh-plugin-codegraph` is native to DSH and exposes structural operations such as symbol search, callers/callees, impact, trace, exploration, and context from a local tree-sitter index. It is the preferred navigation layer when installed; LSP/text search remain fallbacks, and real source is always the source of truth.

The workflow never treats a graph result as proof that code is correct.

## Usage and subscription limits

The installer adds the pinned `dsh-quota` Web plugin. It follows the active DSH route/model and can show:

- session, daily, and rolling Token usage;
- estimated cost by billing route/model;
- provider balance, spending limits, or quota windows where the provider exposes an API for them;
- OpenRouter, DeepSeek Official, MiniMax, SiliconFlow native account data;
- local Token/cost accounting for several additional routes.

No plugin can invent a provider subscription limit that the provider does not expose.

## Pipeline profiles

The port preserves OMP v3.4.x profiles:

- **standard** — Coder -> Reviewer -> Tester (default).
- **quick** — may close after Main reruns Objective Gates, but is forbidden for high-risk or auth/credential/API/schema/migration/trust-boundary diffs.
- **critical** — Reviewer and Tester stay on; Main offers a scoped Security pass when the blast radius warrants it.

See [`PIPELINE.md`](PIPELINE.md).

## Optional design path

Designer is never automatic.

```text
Human visual feedback
  -> Design Advisor (read-only brief) -> Coder -> Reviewer -> Tester -> Human acceptance

or, when explicitly requested:

Human visual feedback
  -> Designer (bounded UI edits) -> Main verify -> Reviewer -> Tester -> Human acceptance
```

## Native DSH features this port deliberately reuses

- **Model-selected subagent routes** with exact user-authorized `{provider, model}` allowlists.
- **`list_subagent_models`** to discover/verify routes available to the current Session.
- **`todo_write`** for the live Web plan; canonical semantic completion remains in `STEPS.md`.
- **Built-in compaction and token-pressure handling** rather than copying OMP context-economy machinery.
- **Project-local skills** under `.dsh/skills/`.
- **LSP, Web trajectory, and child sessions** for inspection.

## Requirements

- Node.js 22+
- DeepSeek Harness CLI (`dsh`) installed
- DSH Web, strongly recommended for this edition
- At least two authorized model routes if you want genuine cross-model review

## Install into a project

Clone this repository somewhere, then point the installer at the product repository:

```bash
git clone https://github.com/Pavan-Gopa/Pavans-Workflow-DSH.git
cd Pavans-Workflow-DSH
./install.sh --target /path/to/your/project
```

The installer is collision-safe: it will not overwrite an existing `.dsh/roles.yaml`, skills, or `AI_Workflow_Kit` tree in another project.

Then:

```bash
dsh web
```

In **Settings -> Plugins -> Subagent model selection**:

1. enable model selection;
2. authorize every exact provider/model route that appears in `.dsh/roles.yaml`;
3. start a **new top-level Session** after saving. DSH snapshots the allowlist into new Sessions, so changing the setting does not retroactively expand an already-running Session.

Open the product workspace and tell Main:

> Use the `pavan-workflow` skill for this task: <your task>.

Before expensive work, run [`ROUTING_TEST.md`](ROUTING_TEST.md).

## Role configuration

`install.sh` creates `.dsh/roles.yaml` from `.dsh/roles.example.yaml` if needed. Replace every `REPLACE_ME` value with exact provider/model IDs from your DSH installation.

Main's own route is selected by the root DSH Session. Child roles have independent routes:

- Coder
- Reviewer
- Tester
- Architect
- Security
- Design Advisor
- Designer

Every role may define a backup, but automatic backup use is forbidden. A provider failure pauses the workflow until the Human explicitly authorizes that role's backup.

## Repository layout

```text
.dsh/
  roles.example.yaml
  skills/
    pavan-workflow/SKILL.md
    ponytail/SKILL.md
    grilling/SKILL.md
    ui-designer/
AI_Workflow_Kit/
  docs/
    PROJECT_CONTEXT.md
    STEPS.md
    DECISIONS.md
    AI/
      STATE.yaml
      FEEDBACK.md
      LEAN_PIPELINE.md
  script/
    workflow_gates.py
    workflow_security_scope.py
scripts/
  doctor.mjs
  init-state.mjs
  selftest.mjs
docs/
  ARCHITECTURE.md
  PLUGIN_DECISIONS.md
```

## Safety invariants

1. Main is the only workflow-state writer and router.
2. Conversation history is not authoritative; canonical files and the real repository are.
3. Main verifies every worker result before routing.
4. Fresh workers receive a compact self-contained assignment, not the entire Main transcript.
5. Backups are Human-authorized, never automatic.
6. Provider/model failures do not count as product implementation failures.
7. Three materially identical no-progress failures stop automatic retrying.
8. `quick` never outranks security or public-contract risk.
9. Workers never commit/push unless a Human changes the contract explicitly for that task.
10. Model-route evidence is part of the gate: a mismatched child route blocks the claim of independent multi-model review.

## Versioning note

This project tracks the **behavioral contract** of Pavan's Workflow, not its implementation internals. OMP-specific dashboard/extensions are intentionally replaced with native DSH services where DSH already solves the same problem.

## License

MIT. See [`LICENSE`](LICENSE).
