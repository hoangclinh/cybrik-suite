#!/usr/bin/env bash
# SCAFFOLD / TEST-ONLY / SOSIM / NOT UAT / NOT mTLS / NOT deployment / NOT release proof.

set -euo pipefail

suite_base_commit="ae0998ea7661fd47bb33d7328c4f811671429a72"
suite_base_tree="3e6a02b12892c25c73bd0d392de0f0c6b6665e10"
soc_commit="abfdfde96afc6daa2868694de993c623daa8862e"
soc_tree="241ef24a33246918ff5cf133e7d8d004823fdf06"
ai_commit="a7defd3a7b41faa8e654d6d7567cb2e59b9363fb"
ai_tree="81e58824d95f800d8e6d424c25207901aceaccfa"

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
suite_root="$(cd -- "$script_dir/../.." && pwd -P)"
soc_repo="${SOC_REPO:-}"
ai_repo="${CYBER_AI_REPO:-${AI_REPO:-}}"
python_bin="${PYTHON:-python3}"
pytest_args=()
has_pytest_args=false

usage() {
  echo "usage: $0 --soc-repo /absolute/path --ai-repo /absolute/path [-- pytest-args...]" >&2
  echo "or set SOC_REPO, CYBER_AI_REPO (or AI_REPO), and optionally PYTHON" >&2
}

die() {
  echo "soc-ai lifecycle SOSIM runner: $*" >&2
  exit 2
}

while (($#)); do
  case "$1" in
    --soc-repo)
      (($# >= 2)) || die "--soc-repo requires a path"
      soc_repo="$2"
      shift 2
      ;;
    --ai-repo)
      (($# >= 2)) || die "--ai-repo requires a path"
      ai_repo="$2"
      shift 2
      ;;
    --)
      shift
      pytest_args=("$@")
      has_pytest_args=true
      break
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      die "unknown argument: $1"
      ;;
  esac
done

[[ "$soc_repo" == /* ]] || die "SOC repo path must be absolute"
[[ "$ai_repo" == /* ]] || die "Cyber AI repo path must be absolute"

verify_exact_checkout() {
  local label="$1"
  local repo="$2"
  local expected_commit="$3"
  local expected_tree="$4"
  local actual_commit actual_tree

  git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
    || die "$label path is not a Git worktree: $repo"
  actual_commit="$(git -C "$repo" rev-parse HEAD)"
  actual_tree="$(git -C "$repo" rev-parse 'HEAD^{tree}')"
  [[ "$actual_commit" == "$expected_commit" ]] \
    || die "$label commit mismatch: expected $expected_commit, got $actual_commit"
  [[ "$actual_tree" == "$expected_tree" ]] \
    || die "$label tree mismatch: expected $expected_tree, got $actual_tree"
  [[ -z "$(git -C "$repo" status --porcelain --untracked-files=all)" ]] \
    || die "$label checkout is not clean: $repo"
}

git -C "$suite_root" cat-file -e "${suite_base_commit}^{commit}" 2>/dev/null \
  || die "Suite base commit is unavailable"
[[ "$(git -C "$suite_root" show -s --format=%T "$suite_base_commit")" == "$suite_base_tree" ]] \
  || die "Suite base tree mismatch"
git -C "$suite_root" merge-base --is-ancestor "$suite_base_commit" HEAD \
  || die "Suite checkout is not descended from the pinned Suite base"
[[ -z "$(git -C "$suite_root" status --porcelain --untracked-files=all)" ]] \
  || die "Suite checkout is not clean: $suite_root"

verify_exact_checkout "SOC" "$soc_repo" "$soc_commit" "$soc_tree"
verify_exact_checkout "Cyber AI" "$ai_repo" "$ai_commit" "$ai_tree"

soc_src="$soc_repo/services/api/src"
ai_core_src="$ai_repo/packages/ai-core/src"
ai_api_src="$ai_repo/services/ai-api/src"
[[ -d "$soc_src" ]] || die "SOC package source is missing: $soc_src"
[[ -d "$ai_core_src" ]] || die "Cyber AI core package source is missing: $ai_core_src"
[[ -d "$ai_api_src" ]] || die "Cyber AI API package source is missing: $ai_api_src"

export PYTHONPATH="$soc_src:$ai_core_src:$ai_api_src"
export PYTHONDONTWRITEBYTECODE=1
if $has_pytest_args; then
  exec "$python_bin" -m pytest -q \
    "$suite_root/tests/e2e/test_soc_ai_lifecycle_create.py" \
    "${pytest_args[@]}"
fi
exec "$python_bin" -m pytest -q \
  "$suite_root/tests/e2e/test_soc_ai_lifecycle_create.py"
