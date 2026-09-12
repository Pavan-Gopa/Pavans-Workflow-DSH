# Lean Pipeline — DSH edition

Default is `standard`: Coder -> Main verification -> Reviewer -> Main verification -> Tester -> Main verification.

## Profiles

```yaml
pipeline:
  profile: standard   # quick | standard | critical
  authorized_by: null
  authorized_at: null
  quick_forbidden: false
  note: null
```

| Profile | Reviewer | Tester | Security |
| --- | --- | --- | --- |
| standard | on unless Human skipped | recommended/on by default | offer near release |
| quick | skip after Main reruns green Objective Gates | skip | no |
| critical | on | on unless Human skipped | offer scoped pass when blast radius hits |

Human authorization is required for `quick`. It is ignored for high-risk cards or when `workflow_security_scope.py` returns `forbid_quick`.

## Retry economy

- first Coder attempt: `ponytail_mode: full`
- retry after Reviewer/Tester: `lite`
- repeated failure count >= 2: `off`

Stop after three materially identical failures without a new approach/evidence.

## Objective Gates

Before Reviewer or a quick close, Main runs:

```bash
python3 AI_Workflow_Kit/script/workflow_gates.py run --json
```

A missing/failed command gate reopens implementation. Manual gates remain Judgment/artifact checks.

## Scoped security

After a verified Coder diff:

```bash
python3 AI_Workflow_Kit/script/workflow_security_scope.py --json
```

`offer_scoped` prompts Human for Security; `forbid_quick` keeps Reviewer/Tester even on a quick card.
