# Installation

## 1. Install DeepSeek Harness

Install a current DeepSeek Harness release and verify:

```bash
node --version   # 22+
dsh --version
```

This repository intentionally does not vendor or fork DeepSeek Harness.

## 2. Install the workflow into a product repository

From this checkout:

```bash
./install.sh --target /absolute/path/to/product
```

Options:

```text
--target PATH       product repository (default: current directory)
--profile NAME      DSH profile for plugins (default: web)
--skip-plugins      copy workflow files only
--skip-quota        install Codegraph but not the Web quota plugin
```

The installer refuses to overwrite workflow trees in a different target. Existing product source and an existing `AGENTS.md` are never replaced.

## 3. Configure role routes

Edit:

```text
<project>/.dsh/roles.yaml
```

Replace all `REPLACE_ME` values with exact DSH provider/model IDs. Prefer real provider diversity between Coder and Reviewer when possible.

## 4. Authorize child routes in DSH Web

Run:

```bash
dsh web
```

Open **Settings -> Plugins -> Subagent model selection**. Enable it and select every exact route used in `.dsh/roles.yaml`.

Important: DSH stores the authorization policy on creation of a new top-level Session. After editing the allowlist, start a new Session before running the workflow.

## 5. Verify routing

Follow [`ROUTING_TEST.md`](ROUTING_TEST.md). Do not assume the requested child model was used merely because it appears in `roles.yaml`.

## 6. Run

Open the target workspace in DSH Web and prompt:

```text
Use the pavan-workflow skill for this task: <task>
```

Main should initialize or reconcile file-backed state, mirror the active stable ID into native `todo_write`, then spawn one fresh child at a time.

## Plugins installed by default

### Codegraph

```bash
dsh plugin --profile web add dsh-plugin-codegraph
```

The port was validated against `dsh-plugin-codegraph` 0.1.6. The plugin provides `codegraph` + `codegraph_index`; queries never silently trigger a slow rebuild.

### dsh-quota

The installer uses the prebuilt v0.8.0 bundle documented by its maintainer:

```bash
dsh plugin --profile web add \
  "https://github.com/Lottle7/dsh-quota/releases/download/v0.8.0/dsh-quota.tgz"
```

Restart `dsh web` after plugin changes.

## Existing Pavan OMP projects

If a target already contains `AI_Workflow_Kit`, the installer stops rather than overwriting it. That is deliberate: your existing file-backed state may contain real project history.

For such a repository, install into a clean clone/worktree first or manually merge the DSH skills and the small deterministic scripts. The state schema is intentionally close to OMP v3.4.x so migration can be reviewed rather than destructively guessed.
