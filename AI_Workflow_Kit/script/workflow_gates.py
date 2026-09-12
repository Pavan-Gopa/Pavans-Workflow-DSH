#!/usr/bin/env python3
"""Run backticked Objective Gate commands for the current (or named) step."""
from __future__ import annotations
import argparse, json, os, re, subprocess, sys
from pathlib import Path

STEP_HEADING = re.compile(r"^##[ \t]+([A-Za-z0-9][A-Za-z0-9._/-]*)[ \t]+(?:—|-)[ \t]+(.+?)\s*$", re.M)
OBJECTIVE_SECTION = re.compile(r"(?:^|\n)(?:#{3,}\s+Objective gates\s*|\*\*Objective gates:\*\*[^\n]*)\n(.*?)(?=\n(?:#{2,}\s+|\*\*[A-Za-z][^:\n]{0,40}:\*\*)|\Z)", re.I | re.S)
GATE_LINE = re.compile(r"^\s*[-*]\s*\[(?P<done>[ xX])\]\s*(?:\[(?P<id>[^\]]+)\]\s*)?(?P<body>.+?)\s*$")
COMMAND = re.compile(r"`([^`]+)`")
CURRENT_STEP = re.compile(r"^current_step:\s*(.+?)\s*$", re.M)

def repo_root_from_here() -> Path:
    return Path(__file__).resolve().parents[2]

def strip_scalar(value: str) -> str:
    text = value.strip()
    if (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
        text = text[1:-1]
    comment = re.search(r"\s+#", text)
    if comment: text = text[:comment.start()]
    return "" if text in {"null", "~", "-", ""} else text.strip()

def current_step_id(state_path: Path, explicit: str | None) -> str:
    if explicit: return explicit
    text = state_path.read_text(encoding="utf-8")
    match = CURRENT_STEP.search(text)
    if not match: raise SystemExit("ERROR: current_step missing from STATE.yaml")
    step = strip_scalar(match.group(1))
    if not step: raise SystemExit("ERROR: current_step is empty")
    return step

def parse_cards(text: str) -> dict[str, str]:
    matches = list(STEP_HEADING.finditer(text)); cards = {}
    for i, match in enumerate(matches):
        start = match.end(); end = matches[i+1].start() if i+1 < len(matches) else len(text)
        cards[match.group(1)] = text[start:end]
    return cards

def looks_like_command(command: str) -> bool:
    text = command.strip()
    if not text or ((" " not in text and "/" not in text) and text in {"true", "false"}): return False
    if re.match(r"^(npm|pnpm|yarn|bun|cargo|go|pytest|python3?|node|bash|make|uv|deno|git|dsh)\b", text): return True
    if text.startswith("./") or text.endswith(".sh"): return True
    if re.search(r"\b(test|lint|build|typecheck|vitest|jest|mocha)\b", text): return True
    return bool(re.match(r"^[A-Za-z0-9._/-]+(\s+.+)?$", text)) and not text.endswith(".")

def extract_gates(body: str) -> list[dict[str, object]]:
    section = OBJECTIVE_SECTION.search(body)
    if not section: return []
    gates = []
    for raw in section.group(1).splitlines():
        match = GATE_LINE.match(raw)
        if not match: continue
        body_text = match.group("body")
        cm = COMMAND.search(body_text); command = cm.group(1).strip() if cm else ""
        runnable = bool(command) and looks_like_command(command)
        gates.append({
            "id": (match.group("id") or "").strip() or None,
            "done": match.group("done").lower() == "x",
            "text": body_text.strip(), "command": command if runnable else None,
            "kind": "command" if runnable else "manual",
        })
    return gates

def run_command(command: str, cwd: Path, timeout: int) -> dict[str, object]:
    try:
        cp = subprocess.run(command, shell=True, cwd=cwd, check=False, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        return {"exit_code": 124, "timed_out": True, "stdout_tail": (exc.stdout or "")[-2000:] if isinstance(exc.stdout, str) else "", "stderr_tail": (exc.stderr or "")[-2000:] if isinstance(exc.stderr, str) else f"timed out after {timeout}s"}
    return {"exit_code": cp.returncode, "timed_out": False, "stdout_tail": (cp.stdout or "")[-2000:], "stderr_tail": (cp.stderr or "")[-2000:]}

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("action", nargs="?", default="run", choices=["run", "list"])
    ap.add_argument("--step", default=None); ap.add_argument("--project", default=None)
    ap.add_argument("--timeout", type=int, default=int(os.environ.get("WF_GATE_TIMEOUT", "120")))
    ap.add_argument("--json", action="store_true"); args = ap.parse_args(argv)
    root = Path(args.project).resolve() if args.project else repo_root_from_here()
    steps_path = root / "AI_Workflow_Kit/docs/STEPS.md"; state_path = root / "AI_Workflow_Kit/docs/AI/STATE.yaml"
    if not steps_path.is_file(): print(f"ERROR: missing {steps_path}", file=sys.stderr); return 2
    if not args.step and not state_path.is_file(): print("ERROR: STATE.yaml missing and --step not given", file=sys.stderr); return 2
    step_id = current_step_id(state_path, args.step) if (state_path.is_file() or args.step) else ""
    cards = parse_cards(steps_path.read_text(encoding="utf-8"))
    if step_id not in cards: print(f"ERROR: step {step_id} not found in STEPS.md", file=sys.stderr); return 2
    results, failed = [], 0
    for gate in extract_gates(cards[step_id]):
        item = dict(gate)
        if args.action == "run" and gate["kind"] == "command":
            outcome = run_command(str(gate["command"]), root, args.timeout); item.update(outcome)
            item["ok"] = outcome["exit_code"] == 0; failed += 0 if item["ok"] else 1
        else: item["ok"] = None
        results.append(item)
    payload = {"step": step_id, "gate_count": len(results), "command_gates": sum(x["kind"] == "command" for x in results), "failed_commands": failed, "status": "fail" if failed else "pass" if any(x["kind"] == "command" for x in results) else "no_commands", "gates": results}
    if args.json: print(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        print(f"step {payload['step']} · {payload['status']} · {payload['command_gates']} command / {payload['gate_count']} gates")
        for item in results:
            mark = "OK  " if item.get("ok") is True else "FAIL" if item.get("ok") is False else "SKIP"
            print(f"{mark} {item.get('id') or '(ungated)'} · {item.get('command') or item.get('text')}")
    return 1 if failed else 0

if __name__ == "__main__":
    raise SystemExit(main())
