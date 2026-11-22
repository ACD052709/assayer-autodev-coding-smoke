#!/usr/bin/env bash
# One-time exact-source import. Requires GitHub CLI authenticated with repo-creation rights.
set -euo pipefail
if [[ $# -ne 2 ]]; then
  echo "Usage: bash scripts/create-dedicated-repo.sh ORIGINAL_SITE_SOURCE.zip ACD052709/minute-arcade" >&2
  exit 2
fi
ARCHIVE="$(realpath "$1")"
DEST="$2"
[[ "$DEST" == "ACD052709/minute-arcade" ]] || { echo "Refusing unexpected repository: $DEST" >&2; exit 2; }
command -v gh >/dev/null || { echo "GitHub CLI required" >&2; exit 2; }
command -v git >/dev/null || { echo "git required" >&2; exit 2; }
command -v python3 >/dev/null || { echo "Python 3 required" >&2; exit 2; }
gh auth status >/dev/null
BASE="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
python3 "$BASE/scripts/stage-site-export.py" "$ARCHIVE" "$WORK/source"
if find "$WORK/source" -type f \( -name '.env' -o -name '.env.local' -o -name '*.pem' -o -name '*.key' -o -name 'id_rsa' -o -name 'id_ed25519' \) | grep -q .; then
  echo "Possible live credential files in source ZIP. Re-export without secrets." >&2
  exit 2
fi
if gh repo view "$DEST" >/dev/null 2>&1; then
  echo "Repository already exists; refusing to overwrite or import over other work." >&2
  exit 2
fi
gh repo create "$DEST" --private
gh repo clone "$DEST" "$WORK/repo"
test -z "$(find "$WORK/repo" -mindepth 1 -maxdepth 1 ! -name .git -print -quit)" || {
  echo "New repository contains files; refusing overwrite." >&2; exit 2;
}
cp -a "$WORK/source/." "$WORK/repo/"
python3 "$BASE/scripts/verify-site-import.py" "$WORK/source-integrity.json" "$WORK/repo"
git -C "$WORK/repo" add -A
git -C "$WORK/repo" -c user.name=ACD052709 -c user.email=292529528+ACD052709@users.noreply.github.com commit -m "Import original Minute Arcade Site source"
git -C "$WORK/repo" branch -M main
git -C "$WORK/repo" push -u origin main
echo "Imported original Site source to https://github.com/$DEST"
echo "This script did not modify production hosting, accounts, or DNS."
