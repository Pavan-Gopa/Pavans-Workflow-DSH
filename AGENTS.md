# Pavan's Workflow DSH repository instructions

This repository contains the reusable DeepSeek Harness overlay, not a product being implemented by the workflow itself.

When modifying this repository:

- keep the normal product pipeline sequential: Main -> fresh worker -> Main verification;
- do not replace native DSH capabilities with custom code unless there is a demonstrated gap;
- preserve exact Human authorization for backup models;
- preserve `quick | standard | critical` semantics;
- keep community plugins optional except Codegraph and the Web quota dashboard installed by `install.sh`;
- never claim a child used a requested route without DSH route evidence;
- run `npm test`, `bash -n install.sh`, and Python compile checks before release.

DeepSeek Harness remains a developer-preview dependency. Prefer documented public DSH seams (`subagent`, project skills, todo, compaction, plugin CLI) over copying upstream internals.
