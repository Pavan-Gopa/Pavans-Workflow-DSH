# Isolated child runtime fallback

Current DeepSeek Harness supports model-selected routes for in-process and DSH SDK child providers. The normal Pavan workflow should use native model-selectable subagents.

An isolated DSH SDK child runtime remains a fallback for custom compositions where the selected subagent backend does not advertise `agentOptions`, or where an organization intentionally wants process-level isolation.

Do **not** use ACP/Codex/Claude Code subagent providers when you require the DSH model-selection contract unless those backends advertise route-selection capability in your installed DSH version; unsupported providers should fail rather than silently ignore route fields.

The fallback must preserve the same rules:

- exact provider/model fixed per role runtime;
- fresh child per attempt;
- child receives a self-contained assignment, not Main history;
- only Main writes canonical workflow state;
- no automatic primary->backup route switch;
- Main verifies the resulting workspace before the next gate.

Prefer the native in-process route when it passes `ROUTING_TEST.md`; it has less operational complexity and better Web integration.
