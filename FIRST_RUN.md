# First live multi-model run

This is the shortest path from a fresh DeepSeek Harness installation to a real Coder -> Reviewer -> Tester run with three independent model routes.

## 1. Install DSH and the workflow

DeepSeek Harness currently runs directly from npm:

```bash
npx @deepseek-ai/dsh web
```

Clone this workflow repository and install it into the product repository you want to work on:

```bash
git clone https://github.com/Pavan-Gopa/Pavans-Workflow-DSH.git
cd Pavans-Workflow-DSH
./install.sh --target /path/to/product --preset recommended
```

The recommended preset creates `.dsh/roles.yaml` with these primary routes:

| Role | Provider | Model |
| --- | --- | --- |
| Coder | `deepseek-official` | `deepseek-v4-pro` |
| Reviewer | `anthropic` | `claude-opus-4-8` |
| Tester | `openai` | `gpt-5.5` |
| Architect | `anthropic` | `claude-opus-4-8` |
| Security | `openai` | `gpt-5.5` |
| Design Advisor | `anthropic` | `claude-opus-4-8` |
| Designer | `openai` | `gpt-5.5` |

Backups are deliberately cross-provider and remain Human-authorized only.

## 2. Configure the three providers

Open DSH Web -> **Settings -> Models**.

Configure credentials for:

1. **DeepSeek** — the direct adapter route is `deepseek-official`.
2. **Anthropic** — add the built-in provider `anthropic`.
3. **OpenAI** — add the built-in provider `openai`.

The exact model IDs above are current upstream DSH routes: the DeepSeek adapter advertises `deepseek-v4-pro`, while upstream DSH's real-provider E2E defaults currently exercise `claude-opus-4-8` and `gpt-5.5`.

If your account does not expose one of those exact models, do not silently substitute it in the workflow. Pick the exact model in DSH's Models page, then change `.dsh/roles.yaml` to that exact ID.

## 3. Authorize child routes

Open **Settings -> Plugins -> Subagent model selection**.

Enable model selection and authorize every exact `{provider, model}` pair used by `.dsh/roles.yaml`.

For the recommended preset that means at least:

```text
deepseek-official / deepseek-v4-pro
anthropic         / claude-opus-4-8
openai            / gpt-5.5
```

The same route can serve multiple roles; it only needs to be authorized once.

**Important:** after saving this setting, create a **new top-level Session**. DSH snapshots child-route authorization into each new Session; an already-running Session does not gain newly authorized routes.

## 4. Open the product workspace

Start DSH Web from the product repository (or open that repository as the workspace):

```bash
cd /path/to/product
npx @deepseek-ai/dsh web
```

Run the local doctor if the workflow repository is available nearby:

```bash
node /path/to/Pavans-Workflow-DSH/scripts/doctor.mjs --project "$PWD"
```

Expected result: no `REPLACE_ME`, Node 22+, `dsh` available, and the workflow files present.

## 5. Route preflight before spending tokens

In the new Session, ask Main:

> Use the `pavan-workflow` skill. Do only route preflight. Call `list_subagent_models`, verify the primary routes for Coder, Reviewer, and Tester from `.dsh/roles.yaml`, and report whether all three exact routes are authorized. Do not edit files and do not start a specialist yet.

Do not continue until Main reports all three exact routes as available.

## 6. First live test task

Use a tiny disposable task in a throwaway branch/worktree. The purpose is to prove orchestration, not model quality.

A good first task is:

> Use the `pavan-workflow` skill. Standard profile. Add a tiny deterministic utility plus one unit test in an isolated test fixture or disposable sample area. The change must be small enough to inspect manually. Run the full Coder -> Main verification -> Reviewer -> Main verification -> Tester -> Main verification cycle. Record the effective provider/model route for every child and stop if any role runs on a different route than `.dsh/roles.yaml`.

Main should:

1. dispatch Coder on `deepseek-official/deepseek-v4-pro`;
2. regain control and inspect the real diff;
3. run Objective Gates;
4. dispatch Reviewer on `anthropic/claude-opus-4-8`;
5. verify each reviewer finding against the source;
6. dispatch Tester on `openai/gpt-5.5`;
7. verify test evidence and final state;
8. never auto-switch to a backup route.

## 7. What counts as success

The live test passes only if all of these are true:

- three child sessions were actually created on the intended exact routes;
- Main regained control between Coder, Reviewer, and Tester;
- Reviewer did not inherit authority to route Tester;
- actual source/diff was inspected by Main after Coder;
- Tester ran after review rather than concurrently with the mutating Coder;
- a route/provider error paused rather than silently switching to backup;
- canonical `STATE.yaml` / `STEPS.md` remained Main-owned;
- the final answer reports route evidence, gates, and test evidence.

## 8. After the routing test

Once the three-provider loop is proven, tune role choices based on your real work instead of changing the orchestration contract. The usual first optimization is cost/latency on Coder and Tester while keeping Reviewer meaningfully independent from Coder.
