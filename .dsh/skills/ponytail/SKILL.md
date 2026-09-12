---
name: ponytail
description: Select the smallest compliant implementation after understanding the real code path. Use for Coder implementation and bug-fix tasks to prefer reuse, standard/native behavior, fewer files/dependencies, and the shortest maintainable diff without weakening scope, validation, tests, security, accessibility, compatibility, or data safety.
---

# Ponytail

Apply only after reading the assignment and verifying the real code flow.

## Precedence

1. Role contract and structured output.
2. Confirmed requirement, target files, stable IDs, assigned gates.
3. Security, validation, accessibility, compatibility, data integrity.
4. Real repository evidence.
5. Simplification policy.

Assignment mode: `off | lite | full`; default `full`.

## Ladder

Stop at the first rung that fully satisfies the task:

1. Is new code actually required?
2. Does the repository already contain the helper/type/pattern/behavior?
3. Does the standard library solve it?
4. Does the native platform solve it?
5. Does an already-installed dependency solve it?
6. Can the same behavior use fewer files, branches, configuration, or lines?
7. Write the minimum maintainable implementation.

`lite`: implement the requested approach but note one concrete smaller alternative when material.

`full`: enforce the ladder.

`off`: follow the normal Coder contract without simplification pressure.

## Rules

- Understand before minimizing.
- Prefer deletion/reuse over addition.
- Add no speculative abstraction, factory, interface, config, or dependency.
- Fix shared root cause only when that file is inside `target_files`; otherwise return blocked and name the required path.
- Never reduce assigned gates.
- Never simplify away trust-boundary validation, security controls, loss-preventing error handling, accessibility basics, compatibility, or explicit requirements.
- Keep the role's output schema unchanged.
