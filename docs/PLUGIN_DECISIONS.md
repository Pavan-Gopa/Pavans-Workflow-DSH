# Plugin decisions

## Core recommendation: `dsh-plugin-codegraph`

Chosen as the DSH-native replacement for required Graphify navigation. It exposes `codegraph` and `codegraph_index`, supports symbol/caller/callee/impact/trace/context queries, uses a local SQLite graph, and ships its own tree-sitter indexer across major languages.

Validated repository version when this port was prepared: **0.1.6**.

The workflow still requires source verification because a structural index can be incomplete or stale.

## Core Web recommendation: `dsh-quota`

Chosen as the closest DSH-native analogue to `omp usage` plus OMP Stats. Version **0.8.0** provides a Web quota/usage dashboard, Host-side ledger, route/model attribution, Token/cost estimates, and native account queries for several providers.

It never claims balances/limits for providers that do not expose them.

## Ponytail

Not replaced by an external plugin. It is retained as a project-local DSH skill because its semantics are assignment policy: reuse/native-first/minimum compliant diff with safety gates outranking brevity.

## DSH native features used instead of plugins

- `subagent` + exact child model selection for roles;
- `list_subagent_models` for authorized route discovery;
- `todo_write` for the live plan;
- built-in LSP;
- native compaction/token-pressure accounting;
- Web child sessions/trajectory for inspection.

## `dsh-review`

Not a core dependency. It can be evaluated as an optional, expensive pre-release adversarial review panel, but Pavan's canonical Reviewer remains the gate because it understands target files, stable IDs, Judgment Gates, retry memory, and Main verification.
