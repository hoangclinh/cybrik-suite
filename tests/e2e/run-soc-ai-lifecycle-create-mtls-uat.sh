#!/usr/bin/env bash
# D2 UAT runner — AUTHORED, NOT RUN. Local synthetic-only exact-bit execution.

set -euo pipefail

suite_d1_base="a2ba11760919021158c3d48aeaa27645af3464da"
soc_commit="abfdfde96afc6daa2868694de993c623daa8862e"
soc_tree="241ef24a33246918ff5cf133e7d8d004823fdf06"
ai_commit="789614144686dab88500dd2bfecdd608ef0a8b8f"
ai_tree="244140e3aacd783b1bea7542f9f56ffc46cedc86"
fabric_commit="49583be00235a0f8ad7da8cb4ea99108ad201a69"
fabric_tree="ca8b4a03116bea979de89b92b2f8fef4fd31e001"
b1_sha256="d1237a5d42a8d0cc63c50dcf7836a09f566667129b689bbbff73b3045b0ef71c"

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
suite_root="$(cd -- "$script_dir/../.." && pwd -P)"
soc_repo="${SOC_REPO:-}"
ai_repo="${CYBER_AI_REPO:-${AI_REPO:-}}"
fabric_repo="${FABRIC_REPO:-}"
python_bin="${PYTHON:-}"
runtime_dir="${CYBRIK_UAT_D2_RUNTIME_DIR:-}"
evidence_dir="${CYBRIK_UAT_D2_EVIDENCE_DIR:-}"
b1_wheel="${CYBRIK_UAT_D2_B1_WHEEL:-}"
authorization_path="${CYBRIK_UAT_D2_AUTHORIZATION_PATH:-}"
authorization_sha="${CYBRIK_UAT_D2_AUTHORIZATION_SHA256:-}"
exact_head_grant="${CYBRIK_UAT_D2_EXACT_HEAD_GRANT:-}"
exact_head_grant_signature="${CYBRIK_UAT_D2_EXACT_HEAD_GRANT_SIGNATURE:-}"
exact_head_allowed_signers="${CYBRIK_UAT_D2_EXACT_HEAD_ALLOWED_SIGNERS:-}"

die() {
  echo "soc-ai lifecycle D2 runner: $*" >&2
  exit 2
}

is_hex() {
  [[ "$1" =~ ^[0-9a-f]+$ ]]
}

verify_exact_checkout() {
  local label="$1"
  local repo="$2"
  local expected_commit="$3"
  local expected_tree="$4"
  local actual_commit actual_tree

  [[ "$repo" == /* ]] || die "$label repository path must be absolute"
  git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
    || die "$label path is not a Git worktree"
  actual_commit="$(git -C "$repo" rev-parse HEAD)"
  actual_tree="$(git -C "$repo" rev-parse 'HEAD^{tree}')"
  [[ "$actual_commit" == "$expected_commit" ]] || die "$label commit mismatch"
  [[ "$actual_tree" == "$expected_tree" ]] || die "$label tree mismatch"
  if git -C "$repo" symbolic-ref -q HEAD >/dev/null; then
    die "$label checkout must be detached"
  fi
  [[ -z "$(git -C "$repo" status --porcelain --untracked-files=all --ignored)" ]] \
    || die "$label checkout is not clean"
}

verify_suite_unchanged() {
  [[ "$(git -C "$suite_root" rev-parse HEAD)" == "$exact_suite_head" ]] \
    || die "exact Suite HEAD mismatch"
  [[ -z "$(git -C "$suite_root" status --porcelain --untracked-files=all --ignored)" ]] \
    || die "Suite checkout changed during the exact attempt"
}

[[ "$python_bin" == /* && -x "$python_bin" ]] || die "PYTHON must be an absolute executable"
[[ "$soc_repo" == /* ]] || die "SOC repository path must be absolute"
[[ "$ai_repo" == /* ]] || die "Cyber AI repository path must be absolute"
[[ "$fabric_repo" == /* ]] || die "Tool Fabric repository path must be absolute"
for outside_dir in "$runtime_dir" "$evidence_dir"; do
  [[ "$outside_dir" == /* ]] || die "runtime and evidence directories must be absolute"
  case "$outside_dir/" in
    "$suite_root/"*|"$soc_repo/"*|"$ai_repo/"*|"$fabric_repo/"*)
      die "runtime and evidence directories must be outside repositories"
      ;;
  esac
done
[[ "${runtime_dir##*/}" =~ ^cybrik-uat-d2-runtime-[a-z0-9][a-z0-9._-]{0,63}$ ]] \
  || die "runtime directory name is not purpose-bound"
[[ "${evidence_dir##*/}" =~ ^cybrik-uat-d2-evidence-[a-z0-9][a-z0-9._-]{0,63}$ ]] \
  || die "evidence directory name is not purpose-bound"
[[ "$runtime_dir" != "$evidence_dir" ]] || die "runtime and evidence directories must differ"
case "$runtime_dir/" in "$evidence_dir/"*) die "runtime and evidence directories must be disjoint" ;; esac
case "$evidence_dir/" in "$runtime_dir/"*) die "runtime and evidence directories must be disjoint" ;; esac
for repo in "$suite_root" "$soc_repo" "$ai_repo" "$fabric_repo"; do
  case "$repo/" in
    "$runtime_dir/"*|"$evidence_dir/"*)
      die "runtime and evidence directories must not contain repositories"
      ;;
  esac
done
[[ "$b1_wheel" == /* && -f "$b1_wheel" ]] || die "B1 wheel path must be an absolute file"
[[ "$exact_head_grant" == /* && -f "$exact_head_grant" && ! -L "$exact_head_grant" ]] \
  || die "exact-head grant must be an external regular file"
[[ "${exact_head_grant##*/}" =~ ^cybrik-uat-d2-exact-head-grant-[a-z0-9][a-z0-9._-]{0,63}\.txt$ ]] \
  || die "exact-head grant name is not purpose-bound"
[[ "$exact_head_grant_signature" == /* && -f "$exact_head_grant_signature" && ! -L "$exact_head_grant_signature" ]] \
  || die "exact-head grant signature must be an external regular file"
[[ "${exact_head_grant_signature##*/}" =~ ^cybrik-uat-d2-exact-head-grant-[a-z0-9][a-z0-9._-]{0,63}\.txt\.sig$ ]] \
  || die "exact-head grant signature name is not purpose-bound"
[[ "$exact_head_allowed_signers" == /* && -f "$exact_head_allowed_signers" && ! -L "$exact_head_allowed_signers" ]] \
  || die "exact-head allowed signers must be an external regular file"
[[ "${exact_head_allowed_signers##*/}" =~ ^cybrik-uat-d2-exact-head-allowed-signers-[a-z0-9][a-z0-9._-]{0,63}\.txt$ ]] \
  || die "exact-head allowed signers name is not purpose-bound"
for repo in "$suite_root" "$soc_repo" "$ai_repo" "$fabric_repo"; do
  for artifact in "$exact_head_grant" "$exact_head_grant_signature" "$exact_head_allowed_signers"; do
    case "$artifact/" in "$repo/"*) die "exact-head grant material must be outside repositories" ;; esac
  done
done
[[ "$authorization_path" == "$suite_root/docs/uat/candidates/runtime-admission-soc-ai-lifecycle-mtls-r1/evidence/04-runtime-authorization.md" ]] \
  || die "authorization path is not canonical"
[[ ${#authorization_sha} -eq 64 ]] && is_hex "$authorization_sha" \
  || die "authorization digest must be exact lowercase SHA-256"
[[ "$(shasum -a 256 "$authorization_path" | awk '{print $1}')" == "$authorization_sha" ]] \
  || die "authorization artifact digest mismatch"
[[ "$(shasum -a 256 "$b1_wheel" | awk '{print $1}')" == "$b1_sha256" ]] \
  || die "B1 wheel digest mismatch"

git -C "$suite_root" merge-base --is-ancestor "$suite_d1_base" HEAD \
  || die "Suite candidate is not descended from integrated D1"
verify_exact_checkout "SOC" "$soc_repo" "$soc_commit" "$soc_tree"
verify_exact_checkout "Cyber AI" "$ai_repo" "$ai_commit" "$ai_tree"
verify_exact_checkout "Tool Fabric" "$fabric_repo" "$fabric_commit" "$fabric_tree"

suite_src="$suite_root/integration/compose/soc-ai-lifecycle-create-mtls/src"
soc_src="$soc_repo/services/api/src"
ai_core_src="$ai_repo/packages/ai-core/src"
ai_api_src="$ai_repo/services/ai-api/src"
for source_root in "$suite_src" "$soc_src" "$ai_core_src" "$ai_api_src"; do
  [[ -d "$source_root" ]] || die "required source root is absent"
done

export PYTHONPATH="$suite_src:$soc_src:$ai_core_src:$ai_api_src"
export PYTHONDONTWRITEBYTECODE=1
export PYTHONSAFEPATH=1
export PYTEST_DISABLE_PLUGIN_AUTOLOAD=1
export CYBRIK_UAT_D2_EXECUTION_AUTHORIZED=true
export CYBRIK_UAT_D2_SOC_REPO="$soc_repo"
export CYBRIK_UAT_D2_AI_REPO="$ai_repo"
export CYBRIK_UAT_D2_FABRIC_REPO="$fabric_repo"
export CYBRIK_UAT_D2_RUNTIME_DIR="$runtime_dir"
export CYBRIK_UAT_D2_EVIDENCE_DIR="$evidence_dir"
export CYBRIK_UAT_D2_B1_WHEEL="$b1_wheel"
export CYBRIK_UAT_D2_AUTHORIZATION_PATH="$authorization_path"
export CYBRIK_UAT_D2_AUTHORIZATION_SHA256="$authorization_sha"
export CYBRIK_UAT_D2_EXACT_HEAD_GRANT="$exact_head_grant"
export CYBRIK_UAT_D2_EXACT_HEAD_GRANT_SIGNATURE="$exact_head_grant_signature"
export CYBRIK_UAT_D2_EXACT_HEAD_ALLOWED_SIGNERS="$exact_head_allowed_signers"

# Discover only the selected interpreter's own dependency roots under isolated
# startup. Product/Suite imports remain the exact PYTHONPATH tuple checked by
# runtime_authorization; -I then ignores that environment until this bootstrap
# installs the admitted roots explicitly, after site customization is disabled.
python_purelib="$("$python_bin" -I -B -c 'import sysconfig; print(sysconfig.get_path("purelib"))')"
python_platlib="$("$python_bin" -I -B -c 'import sysconfig; print(sysconfig.get_path("platlib"))')"
[[ "$python_purelib" == /* && -d "$python_purelib" ]] \
  || die "Python purelib root is unavailable"
[[ "$python_platlib" == /* && -d "$python_platlib" ]] \
  || die "Python platlib root is unavailable"
python_import_roots="$PYTHONPATH:$python_purelib"
if [[ "$python_platlib" != "$python_purelib" ]]; then
  python_import_roots="$python_import_roots:$python_platlib"
fi
python_repository_roots="$suite_root:$soc_repo:$ai_repo:$fabric_repo"

run_python_module() {
  "$python_bin" -I -B -S -c '
import os
import runpy
import sys

roots = tuple(sys.argv[1].split(os.pathsep))
repositories = tuple(sys.argv[2].split(os.pathsep))
if not sys.flags.isolated or not sys.flags.no_site or not sys.flags.safe_path:
    raise SystemExit("unsafe Python startup flags")
if not sys.dont_write_bytecode:
    raise SystemExit("Python bytecode writes are enabled")
if (
    not roots
    or not repositories
    or len(set(roots)) != len(roots)
    or len(set(repositories)) != len(repositories)
    or any(not root or not os.path.isabs(root) for root in (*roots, *repositories))
):
    raise SystemExit("unsafe Python import roots")
if any(item in {"", ".", os.getcwd()} for item in sys.path):
    raise SystemExit("unsafe Python import path")
interpreter_roots = tuple(
    item for item in sys.path
    if item and os.path.isabs(item) and item not in roots
)
sys.path[:] = [*roots, *interpreter_roots]
if tuple(sys.path) != (*roots, *interpreter_roots):
    raise SystemExit("effective Python import path mismatch")
for item in sys.path[len(roots):]:
    resolved = os.path.realpath(item)
    if any(
        os.path.commonpath((resolved, os.path.realpath(repository)))
        == os.path.realpath(repository)
        for repository in repositories
    ):
        raise SystemExit("repository import path escaped admitted prefix")
module = sys.argv[3]
sys.argv = [module, *sys.argv[4:]]
runpy.run_module(module, run_name="__main__", alter_sys=True)
' "$python_import_roots" "$python_repository_roots" "$@"
}

# This single check observes the admitted Suite ancestor, versioned runtime
# aggregate, exact authorization/candidate digests, B1 wheel, clean detached
# product tuple, external roots and exact PYTHONPATH again.  It creates no
# process, listener, database, PKI or evidence root.
cd "$suite_src"
run_python_module cybrik_suite_uat_mtls.runtime_authorization --check-only
# Only consume fields from the external grant after the descriptor-bound Python
# admission check has verified its detached signature and signer-key digest.
exact_suite_head="$(awk -F= '$1 == "SUITE_HEAD" { print $2 }' "$exact_head_grant")"
[[ ${#exact_suite_head} -eq 40 ]] && is_hex "$exact_suite_head" \
  || die "exact-head grant Suite HEAD is invalid"
verify_suite_unchanged

cleanup_required=true
cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  if $cleanup_required; then
    if ! run_python_module cybrik_suite_uat_mtls.harness rollback; then
      echo "soc-ai lifecycle D2 runner: cleanup failed" >&2
      exit 3
    fi
    verify_suite_unchanged
  fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

run_python_module cybrik_suite_uat_mtls.harness start \
  --ai-bind 127.0.0.1:58443 \
  --postgres-bind 127.0.0.1:55432
verify_suite_unchanged
cd "$runtime_dir"
run_python_module cybrik_suite_uat_mtls.harness seed
verify_suite_unchanged
run_python_module cybrik_suite_uat_mtls.harness reset
verify_suite_unchanged
run_python_module pytest -q \
  -p no:cacheprovider \
  -o addopts= \
  --noconftest \
  --import-mode=importlib \
  -c /dev/null \
  "$suite_root/integration/compose/soc-ai-lifecycle-create-mtls/tests/test_lifecycle_runtime.py::test_authorized_runtime_attempt_executes_the_red_green_sequence"
verify_suite_unchanged
run_python_module cybrik_suite_uat_mtls.harness stop
verify_suite_unchanged
run_python_module cybrik_suite_uat_mtls.harness rollback
verify_suite_unchanged
cleanup_required=false
trap - EXIT INT TERM
