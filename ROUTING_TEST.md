# Multi-model routing smoke test

Run this before trusting expensive multi-model work and again after a major DSH upgrade.

## Preconditions

1. `.dsh/roles.yaml` contains real provider/model IDs.
2. DSH Web -> Settings -> Plugins -> **Subagent model selection** is enabled.
3. Every primary route used in this test is in the exact allowed-model list.
4. Start a **new top-level Session** after saving settings.

## Test A — discovery

Ask Main to call `list_subagent_models` and verify that the exact Coder and Reviewer routes are listed/resolvable.

If the tool is absent or either route is unauthorized, stop. Do not substitute another route.

## Test B — two fresh children

Pick Coder and Reviewer routes that differ by model, ideally by provider.

Start a tiny fresh Coder child on the exact Coder `{provider, model}`. Its prompt should be read-only and request one short response containing a nonce such as `CODER-ROUTE-OK`.

After it settles, inspect the child Session / trajectory in DSH Web and record the **effective provider/model** from the child request evidence.

Repeat with a fresh Reviewer child using the exact Reviewer route and nonce `REVIEWER-ROUTE-OK`.

Pass only when:

- both children complete;
- each child request evidence shows the requested exact provider/model;
- the two effective routes are actually different when independent-model review is expected.

## Failure handling

- **unauthorized route:** fix the Web allowlist and create a new top-level Session;
- **provider/model unavailable:** treat as infrastructure failure, not a product attempt;
- **route mismatch:** block the workflow and do not claim independent multi-model review;
- **persistent primary outage:** ask Human before using the configured backup.

Current DSH implements exact user-authorized model-selected subagent routes. This test is a release smoke test, not a workaround for a known mandatory bug.
