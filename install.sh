#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$PWD"
PROFILE="web"
SKIP_PLUGINS=0
SKIP_QUOTA=0

usage() {
  cat <<'EOF'
Usage: ./install.sh [--target PATH] [--profile NAME] [--skip-plugins] [--skip-quota]

Installs Pavan's Workflow DSH overlay into a product Git repository and installs
recommended DeepSeek Harness plugins. Existing workflow trees are never overwritten.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="${2:?--target requires a path}"; shift 2 ;;
    --profile) PROFILE="${2:?--profile requires a name}"; shift 2 ;;
    --skip-plugins) SKIP_PLUGINS=1; shift ;;
    --skip-quota) SKIP_QUOTA=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

command -v node >/dev/null || { echo "ERROR: Node.js 22+ is required" >&2; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$NODE_MAJOR" -ge 22 ]] || { echo "ERROR: Node.js 22+ required; found $(node --version)" >&2; exit 1; }
command -v python3 >/dev/null || { echo "ERROR: python3 is required for deterministic gate helpers" >&2; exit 1; }

TARGET="$(python3 - "$TARGET" <<'PY'
import os, sys
print(os.path.abspath(sys.argv[1]))
PY
)"
mkdir -p "$TARGET"

if [[ "$TARGET" != "$SOURCE_DIR" ]]; then
  [[ -d "$TARGET/.git" ]] || { echo "ERROR: target must be a Git repository: $TARGET" >&2; exit 1; }
  for rel in \
    ".dsh/roles.example.yaml" \
    ".dsh/skills/pavan-workflow" \
    ".dsh/skills/ponytail" \
    ".dsh/skills/grilling" \
    ".dsh/skills/ui-designer" \
    "AI_Workflow_Kit"; do
    if [[ -e "$TARGET/$rel" ]]; then
      echo "ERROR: refusing to overwrite existing $TARGET/$rel" >&2
      echo "Merge it manually or install into a clean worktree." >&2
      exit 1
    fi
  done

  mkdir -p "$TARGET/.dsh/skills"
  cp "$SOURCE_DIR/.dsh/roles.example.yaml" "$TARGET/.dsh/roles.example.yaml"
  cp -R "$SOURCE_DIR/.dsh/skills/pavan-workflow" "$TARGET/.dsh/skills/"
  cp -R "$SOURCE_DIR/.dsh/skills/ponytail" "$TARGET/.dsh/skills/"
  cp -R "$SOURCE_DIR/.dsh/skills/grilling" "$TARGET/.dsh/skills/"
  cp -R "$SOURCE_DIR/.dsh/skills/ui-designer" "$TARGET/.dsh/skills/"
  cp -R "$SOURCE_DIR/AI_Workflow_Kit" "$TARGET/AI_Workflow_Kit"
  echo "Installed workflow overlay into $TARGET"
else
  echo "Using this repository as the target."
fi

if [[ ! -e "$TARGET/.dsh/roles.yaml" ]]; then
  cp "$TARGET/.dsh/roles.example.yaml" "$TARGET/.dsh/roles.yaml"
  echo "Created $TARGET/.dsh/roles.yaml (edit every REPLACE_ME before use)."
else
  echo "Keeping existing $TARGET/.dsh/roles.yaml"
fi
mkdir -p "$TARGET/AI_Workflow_Kit/reports"

if [[ "$SKIP_PLUGINS" -eq 0 ]]; then
  command -v dsh >/dev/null || { echo "ERROR: dsh is not on PATH. Install DeepSeek Harness or rerun with --skip-plugins." >&2; exit 1; }
  echo "Installing Codegraph into DSH profile '$PROFILE'..."
  dsh plugin --profile "$PROFILE" add dsh-plugin-codegraph
  if [[ "$SKIP_QUOTA" -eq 0 ]]; then
    echo "Installing dsh-quota v0.8.0 into DSH profile '$PROFILE'..."
    dsh plugin --profile "$PROFILE" add "https://github.com/Lottle7/dsh-quota/releases/download/v0.8.0/dsh-quota.tgz"
  fi
  echo "Plugin changes complete. Restart 'dsh web'."
fi

node "$SOURCE_DIR/scripts/doctor.mjs" --project "$TARGET" || {
  echo
  echo "Doctor found expected setup blockers. Most commonly .dsh/roles.yaml still contains REPLACE_ME."
  echo "Configure exact provider/model routes, authorize them in DSH Web, then rerun:"
  echo "  node '$SOURCE_DIR/scripts/doctor.mjs' --project '$TARGET'"
  exit 0
}
