---
name: grilling
description: Human-in-the-loop discovery that turns ambiguous work into explicit decisions and an execution-ready plan before implementation. Use for architecture, feature design, refactors, bug-fix planning, requirement clarification, or when the Human asks to grill/stress-test a plan.
---

# Grilling

Grilling is discovery, not implementation. It ends only when blocking uncertainty is resolved and the Human explicitly confirms the agreed understanding.

## Modes

- `quick`: Main conducts a compact interview for bounded local work.
- `deep`: Main dispatches a fresh read-only Architect; Architect researches and returns the current question frontier/checkpoint; Main relays exact Human answers into fresh Architect iterations until confirmation.

## Method

1. Load governing project constraints and relevant repository evidence.
2. Use Codegraph first for non-trivial relationships when available, then verify high-impact claims in real source/docs.
3. Build a decision tree of material choices only.
4. Maintain an Unknowns Tracker: `EXPLORED`, `ANSWERED`, `ASSUMPTION`, `PENDING`, `IMMATERIAL`.
5. Ask only frontier questions whose prerequisites are settled. Normally batch 2-4 independent low-coupling questions; ask one when it can reshape the rest.
6. Give 2-4 actionable options plus free-form. Mark a recommendation only when evidence supports one.
7. Record material Human decisions, rationale, rejected alternatives, and consequences.
8. Before confirmation, check contradictions, scope boundaries, success criteria, failure/migration/security/data/compatibility/rollback concerns when relevant.
9. Do not produce a final plan while any blocking `PENDING` item remains.
10. Obtain explicit Human confirmation of the agreed-understanding summary.

## Outputs

Quick mode returns an Execution Plan: scope, decisions, steps, dependencies, verification/done-when, risks, accepted assumptions.

Deep mode returns an Architecture Package to Main: agreed scope/success, evidence, decisions, solution structure, phases, risks, assumptions, and deferred non-blockers.

If interrupted before confirmation, return a checkpoint instead of fabricating a final plan.
