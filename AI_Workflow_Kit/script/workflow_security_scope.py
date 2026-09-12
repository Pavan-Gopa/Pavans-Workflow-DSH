#!/usr/bin/env python3
"""Detect credential/auth/trust-boundary and public-contract paths in a verified diff."""
from __future__ import annotations
import argparse, json, re, subprocess
from pathlib import Path

SECURITY_HINTS = (
    "auth", "credential", "secret", "token", "session", "password", "oauth", "jwt",
    "ipc", "download", "sql", "crypto", "cookie", "cors", "csrf", "permission",
    "vault", "rls", "sso", "saml", "oidc", "kms",
)
CONTRACT_HINTS = ("schema", "migration", "migrate", "openapi", "graphql", "protobuf", "grpc")
SECURITY_HINT = re.compile("|".join(re.escape(x) for x in SECURITY_HINTS), re.I)
CONTRACT_HINT = re.compile("|".join(re.escape(x) for x in CONTRACT_HINTS), re.I)
API_SEGMENT = re.compile(r"(^|/)api(/|$|\.)", re.I)
SKIP_PREFIXES = (
    "AI_Workflow_Kit/docs/", ".dsh/", ".omp/", "graphify-out/", "ponytail/", "ui-designer/", "grilling/",
)

def repo_root_from_here() -> Path:
    return Path(__file__).resolve().parents[2]

def git_paths(root: Path) -> list[str]:
    commands = (
        ["git", "-C", str(root), "diff", "--name-only"],
        ["git", "-C", str(root), "diff", "--cached", "--name-only"],
        ["git", "-C", str(root), "ls-files", "--others", "--exclude-standard"],
    )
    out, seen = [], set()
    for command in commands:
        try:
            cp = subprocess.run(command, check=False, capture_output=True, text=True)
        except OSError:
            continue
        if cp.returncode != 0:
            continue
        for line in cp.stdout.splitlines():
            path = line.strip().replace("\\", "/")
            if path and path not in seen:
                seen.add(path); out.append(path)
    return out

def is_product_path(path: str) -> bool:
    p = path.replace("\\", "/")
    return not any(p.startswith(prefix) for prefix in SKIP_PREFIXES)

def security_hit(path: str) -> bool:
    return bool(SECURITY_HINT.search(path.replace("\\", "/")))

def contract_hit(path: str) -> bool:
    p = path.replace("\\", "/")
    return bool(CONTRACT_HINT.search(p) or API_SEGMENT.search(p))

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--project", default=None)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)
    root = Path(args.project).resolve() if args.project else repo_root_from_here()
    paths = list(args.paths) if args.paths else git_paths(root)
    security = [p for p in paths if is_product_path(p) and security_hit(p)]
    forbid = [p for p in paths if is_product_path(p) and (security_hit(p) or contract_hit(p))]
    payload = {
        "offer_scoped": bool(security), "forbid_quick": bool(forbid),
        "hits": security, "forbid_hits": forbid, "checked": len(paths),
    }
    if args.json:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    elif forbid:
        print("offer_scoped" if security else "forbid_quick")
        for path in forbid: print(path)
    else:
        print("none")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
