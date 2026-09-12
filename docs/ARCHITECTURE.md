# Architecture decisions

## 1. Overlay, not a DeepSeek Harness fork

Pavan's Workflow is policy/orchestration, not a replacement runtime. Keeping DSH upstream intact makes upgrades, plugins, Web UI, model adapters, compaction, and subagent improvements available without maintaining a permanent fork.

## 2. Sequential model-selectable subagents are the primary loop

A tempting implementation is one DSH `workflow` script that starts Coder, then Reviewer, then Tester. That loses a core invariant: Main must verify the *real workspace* between gates.

The primary implementation therefore dispatches one native DSH `subagent` at a time. Each child gets an exact provider/model route. Main inspects source/diff/gates after the child settles and only then creates the next child.

`workflow` remains useful for independent read-only fan-out.

## 3. Model routes are user-authorized

Current DSH supports model-selected child routes, but authorization is explicit. The Web setting stores exact provider/model allowlists and snapshots them into a new top-level Session. The workflow treats missing authorization as a blocker rather than silently falling back.

## 4. File-backed canonical state + native Todo

DSH `todo_write` is ideal for a live plan panel, but runtime Todo is not durable semantic workflow memory. `STEPS.md` + `STATE.yaml` remain canonical and Main-owned. Stable IDs link the two layers.

## 5. DSH native compaction replaces OMP context-economy implementation

DSH already meters retained context and performs automatic compaction/overflow recovery. Reimplementing OMP's context-economy machinery would duplicate a runtime concern and become brittle as DSH changes.

The retained Pavan invariant is conceptual: Main reloads canonical files at startup/resume/interruption/drift; fresh workers receive compact self-contained assignments.

## 6. Codegraph replaces required Graphify integration

Codegraph is a DSH-native structural navigation plugin with explicit indexing and local graph storage. It becomes the preferred relationship/navigation layer. LSP and focused source search remain fallbacks. Real source is always authoritative.

## 7. Ponytail stays a skill

The useful Ponytail behavior is a coding policy, not an OMP runtime dependency. DSH project-local skills are the native home for it, including assignment-local `off|lite|full` modes.

## 8. Community review plugin is not a core dependency

The existing Reviewer role already supplies independent judgment and is integrated with stable IDs, Main verification, and retry logic. Community adversarial-review plugins may be useful as optional release experiments, but core behavior must not depend on them.
