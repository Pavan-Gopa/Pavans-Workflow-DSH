# Pipeline — DSH edition

This document is the DSH translation of Pavan's Workflow v3.4.x routing contract.

## Authority

Main is the sole Orchestrator. Only Main advances `STATE.yaml`, checks/reopens stable IDs in `STEPS.md`, writes canonical feedback/decisions, chooses the next worker, and authorizes a completed gate after evidence inspection.

A child returning `done`, `approved`, or `qa_green` is evidence to verify, not a state transition by itself.

## Canonical transition transaction

Before dispatching any worker:

1. Read `STEPS.md` and select the exact step card.
2. Set `STATE.yaml.current_step` to that exact ID.
3. Set `current_work_item_id` to a real stable ID from the card when one item is active.
4. Persist state and reread `STATE.yaml` + `STEPS.md`.
5. Update DSH `todo_write` with the same stable-ID prefix for the runtime task.
6. Only then dispatch a fresh child.

After a worker returns, Main performs the reverse transaction: verify evidence first, update semantic checklist/gates, update completed steps, clear/advance active item, persist/re-read, then route again.

`todo_write` is a live runtime plan. It does not replace `STEPS.md`.

## Standard profile

```text
Coder
  -> Main verifies actual diff + Objective Gates + route
  -> Reviewer
  -> Main verifies findings against actual source
  -> if changes: new Coder, then review again
  -> Tester
  -> Main verifies runtime/QA evidence
  -> close step
```

Reviewer is on unless the Human explicitly skipped it. Tester is recommended and stays on by default.

## Quick profile

Human must explicitly label/authorize `quick`; Main does not invent it.

Quick may skip Reviewer and Tester only after Main reruns all command Objective Gates and verifies the real diff.

Quick is automatically forbidden if either is true:

- the step risk is `high`;
- `workflow_security_scope.py` reports `forbid_quick` because the diff touches auth, credentials, secrets, trust boundaries, `/api/`, schemas, OpenAPI/GraphQL/protobuf/gRPC, or migrations.

When forbidden, set `pipeline.quick_forbidden: true` and route as `standard` or `critical`.

## Critical profile

Reviewer and Tester stay enabled. If the verified diff hits a security-sensitive surface, set `security.next_run: offer_scoped` and ask the Human whether to run Security. Security remains a read-only finder; Coder applies fixes.

## Retry economy

| Situation | `ponytail_mode` |
| --- | --- |
| first Coder attempt | `full` |
| retry after Reviewer/Tester finding | `lite` |
| repeated failure count >= 2 | `off` |

A Tester product-bug handoff should include a deterministic failing test when writing an approved test path is possible. That test becomes an Objective Gate for the Coder retry.

After three materially identical failures with no new evidence or approach, stop automatic retries. Use Architect for a bounded reframe or ask the Human.

Provider/model/auth/rate-limit failures are infrastructure failures and do **not** increment the product retry count.

## Design path

Designer roles are never inserted automatically.

- **Design Advisor:** read-only, lower-cost, implementation-ready UI/UX brief. Ordinary Coder implements it.
- **Designer:** edit-capable only when explicitly requested; edits presentation/UI/approved UI-test paths, then Main -> Reviewer -> Tester -> Human visual acceptance.

Neither design role uses Ponytail to shrink meaningful visual, responsive, interaction, or accessibility behavior.

## Architect

Use Architect when:

- a system-design choice cannot be safely derived from confirmed context;
- plan and code materially conflict;
- deep Grilling is requested;
- repeated implementation attempts demonstrate architecture uncertainty.

Architect is read-only and returns advice/design/questions to Main.

## Security

Security is optional near release and scoped when risk warrants it. It reports stable findings with severity, evidence, suspect files, and fix direction. It does not patch product source.

## Parallelism

The default mutation pipeline is sequential. Do not parallelize Coder/Reviewer/Tester against the same live workspace.

DSH `workflow`/`parallel()` is appropriate for independent read-only investigations or review panels where results can be merged by Main afterward.
