#!/bin/sh
set -eu

SCRIPT_NAME=run-w0-t10-offline.sh

require_env() {
  case "$1" in
    W0T10_SUITE_ROOT) value=${W0T10_SUITE_ROOT-} ;;
    W0T10_SUITE_SHA) value=${W0T10_SUITE_SHA-} ;;
    W0T10_CYBER_AI_ROOT) value=${W0T10_CYBER_AI_ROOT-} ;;
    W0T10_CYBER_AI_SHA) value=${W0T10_CYBER_AI_SHA-} ;;
    W0T10_FABRIC_ROOT) value=${W0T10_FABRIC_ROOT-} ;;
    W0T10_FABRIC_SHA) value=${W0T10_FABRIC_SHA-} ;;
    W0T10_SOC_ROOT) value=${W0T10_SOC_ROOT-} ;;
    W0T10_SOC_SHA) value=${W0T10_SOC_SHA-} ;;
    *)
      printf 'ERROR=internal unknown environment variable: %s\n' "$1"
      finish BLOCKED governance 2
      ;;
  esac
  if [ -z "$value" ]; then
    printf 'ERROR=missing required environment variable: %s\n' "$1"
    finish BLOCKED governance 2
  fi
}

is_absolute_dir() {
  path=$1
  case "$path" in
    /*) ;;
    *)
      return 1
      ;;
  esac
  [ -d "$path" ]
}

print_footer() {
  printf 'SUITE_ROOT=%s\n' "${W0T10_SUITE_ROOT-}"
  printf 'SUITE_SHA=%s\n' "${W0T10_SUITE_SHA-}"
  printf 'CYBER_AI_ROOT=%s\n' "${W0T10_CYBER_AI_ROOT-}"
  printf 'CYBER_AI_SHA=%s\n' "${W0T10_CYBER_AI_SHA-}"
  printf 'FABRIC_ROOT=%s\n' "${W0T10_FABRIC_ROOT-}"
  printf 'FABRIC_SHA=%s\n' "${W0T10_FABRIC_SHA-}"
  printf 'SOC_ROOT=%s\n' "${W0T10_SOC_ROOT-}"
  printf 'SOC_SHA=%s\n' "${W0T10_SOC_SHA-}"
}

finish() {
  result=$1
  first_layer=$2
  exit_code=$3
  printf 'RESULT=%s\n' "$result"
  printf 'FIRST_FAILING_LAYER=%s\n' "$first_layer"
  print_footer
  exit "$exit_code"
}

section() {
  printf '=== %s ===\n' "$1"
}

check_root_head_clean() {
  layer=$1
  root=$2
  expected_sha=$3

  if ! is_absolute_dir "$root"; then
    printf 'ERROR=%s root must be an absolute existing directory: %s\n' "$layer" "$root"
    finish BLOCKED governance 2
  fi

  if ! git -C "$root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    printf 'ERROR=%s root is not a Git worktree: %s\n' "$layer" "$root"
    finish BLOCKED governance 2
  fi

  actual_sha=$(git -C "$root" rev-parse HEAD)
  if [ "$actual_sha" != "$expected_sha" ]; then
    printf 'ERROR=%s HEAD mismatch: expected %s got %s\n' "$layer" "$expected_sha" "$actual_sha"
    finish BLOCKED governance 2
  fi

  status_output=$(git -C "$root" status --porcelain=v1 --untracked-files=all)
  if [ -n "$status_output" ]; then
    printf 'ERROR=%s root is not clean\n' "$layer"
    printf '%s\n' "$status_output"
    finish BLOCKED governance 2
  fi
}

require_file_for_layer() {
  layer=$1
  path=$2
  exit_code=$3

  if [ ! -f "$path" ]; then
    printf 'ERROR=missing required file for %s: %s\n' "$layer" "$path"
    finish BLOCKED "$layer" "$exit_code"
  fi
}

require_executable_for_layer() {
  layer=$1
  path=$2
  exit_code=$3

  if [ ! -x "$path" ]; then
    printf 'ERROR=missing required executable for %s: %s\n' "$layer" "$path"
    finish BLOCKED "$layer" "$exit_code"
  fi
}

run_layer_cmd() {
  layer=$1
  root=$2
  exit_code=$3
  display=$4
  command=$5

  printf 'COMMAND=%s\n' "$display"
  if (
    cd "$root" &&
    /bin/sh -eu -c "$command"
  ) 2>&1; then
    printf 'LAYER_RESULT=PASS\n'
  else
    status=$?
    printf 'LAYER_RESULT=RED\n'
    printf 'COMMAND_EXIT=%s\n' "$status"
    finish RED "$layer" "$exit_code"
  fi
}

section "W0-T10 HARNESS START"
printf 'SCRIPT=%s\n' "$SCRIPT_NAME"

require_env W0T10_SUITE_ROOT
require_env W0T10_SUITE_SHA
require_env W0T10_CYBER_AI_ROOT
require_env W0T10_CYBER_AI_SHA
require_env W0T10_FABRIC_ROOT
require_env W0T10_FABRIC_SHA
require_env W0T10_SOC_ROOT
require_env W0T10_SOC_SHA

W0T10_SOC_INCLUDE_T02=${W0T10_SOC_INCLUDE_T02-0}
case "$W0T10_SOC_INCLUDE_T02" in
  0|1) ;;
  *)
    printf 'ERROR=W0T10_SOC_INCLUDE_T02 must be 0 or 1\n'
    finish BLOCKED governance 2
    ;;
esac

section "INPUTS"
printf 'SOC_INCLUDE_T02=%s\n' "$W0T10_SOC_INCLUDE_T02"
print_footer

section "GOVERNANCE CHECK"
check_root_head_clean suite "$W0T10_SUITE_ROOT" "$W0T10_SUITE_SHA"
check_root_head_clean cyber_ai "$W0T10_CYBER_AI_ROOT" "$W0T10_CYBER_AI_SHA"
check_root_head_clean fabric "$W0T10_FABRIC_ROOT" "$W0T10_FABRIC_SHA"
check_root_head_clean soc "$W0T10_SOC_ROOT" "$W0T10_SOC_SHA"
printf 'LAYER_RESULT=PASS\n'

section "LAYER suite"
require_file_for_layer suite \
  "$W0T10_SUITE_ROOT/tools/contract-validation/validate-investigation.mjs" \
  3
run_layer_cmd suite "$W0T10_SUITE_ROOT" 3 \
  "node tools/contract-validation/validate-schemas.mjs" \
  "node tools/contract-validation/validate-schemas.mjs"
run_layer_cmd suite "$W0T10_SUITE_ROOT" 3 \
  "node tools/contract-validation/validate-inference.mjs" \
  "node tools/contract-validation/validate-inference.mjs"
run_layer_cmd suite "$W0T10_SUITE_ROOT" 3 \
  "node tools/contract-validation/validate-svc.mjs" \
  "node tools/contract-validation/validate-svc.mjs"
run_layer_cmd suite "$W0T10_SUITE_ROOT" 3 \
  "node tools/contract-validation/validate-org.mjs" \
  "node tools/contract-validation/validate-org.mjs"
run_layer_cmd suite "$W0T10_SUITE_ROOT" 3 \
  "node tools/contract-validation/validate-investigation.mjs" \
  "node tools/contract-validation/validate-investigation.mjs"

section "LAYER cyber_ai"
require_executable_for_layer cyber_ai \
  "$W0T10_CYBER_AI_ROOT/.venv/bin/python" \
  4
run_layer_cmd cyber_ai "$W0T10_CYBER_AI_ROOT" 4 \
  "PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m pytest -q -p no:cacheprovider --no-cov tests/contract/test_wire_contracts.py tests/contract/test_svc_delegation.py tests/ai_core/test_policy.py tests/ai_core/test_delegation_verifier.py" \
  "PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m pytest -q -p no:cacheprovider --no-cov tests/contract/test_wire_contracts.py tests/contract/test_svc_delegation.py tests/ai_core/test_policy.py tests/ai_core/test_delegation_verifier.py"

section "LAYER fabric"
require_executable_for_layer fabric \
  "$W0T10_FABRIC_ROOT/src/control-plane/.venv/bin/python" \
  5
run_layer_cmd fabric "$W0T10_FABRIC_ROOT" 5 \
  "PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src/control-plane src/control-plane/.venv/bin/python -m pytest -q -p no:cacheprovider tests/control-plane/test_contract_provenance.py tests/conformance/test_capability_conformance.py tests/control-plane/test_offline_no_network.py tests/control-plane/test_liveness_property.py" \
  "PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src/control-plane src/control-plane/.venv/bin/python -m pytest -q -p no:cacheprovider tests/control-plane/test_contract_provenance.py tests/conformance/test_capability_conformance.py tests/control-plane/test_offline_no_network.py tests/control-plane/test_liveness_property.py"

section "LAYER soc"
require_executable_for_layer soc \
  "$W0T10_SOC_ROOT/services/api/.venv/bin/python" \
  6
require_file_for_layer soc \
  "$W0T10_SOC_ROOT/services/api/tests/contracts/test_investigation_contract.py" \
  6
if [ "$W0T10_SOC_INCLUDE_T02" = "1" ]; then
  require_file_for_layer soc \
    "$W0T10_SOC_ROOT/services/api/tests/unit/test_copilot_api.py" \
    6
  soc_display="PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src .venv/bin/python -m pytest -q -p no:cacheprovider tests/contracts/test_investigation_contract.py tests/unit/test_svc_delegation_no_go.py tests/unit/test_copilot_api.py"
  soc_command="PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src .venv/bin/python -m pytest -q -p no:cacheprovider tests/contracts/test_investigation_contract.py tests/unit/test_svc_delegation_no_go.py tests/unit/test_copilot_api.py"
else
  soc_display="PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src .venv/bin/python -m pytest -q -p no:cacheprovider tests/contracts/test_investigation_contract.py tests/unit/test_svc_delegation_no_go.py"
  soc_command="PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src .venv/bin/python -m pytest -q -p no:cacheprovider tests/contracts/test_investigation_contract.py tests/unit/test_svc_delegation_no_go.py"
fi
run_layer_cmd soc "$W0T10_SOC_ROOT/services/api" 6 "$soc_display" "$soc_command"

section "POST-RUN GOVERNANCE CHECK"
check_root_head_clean suite "$W0T10_SUITE_ROOT" "$W0T10_SUITE_SHA"
check_root_head_clean cyber_ai "$W0T10_CYBER_AI_ROOT" "$W0T10_CYBER_AI_SHA"
check_root_head_clean fabric "$W0T10_FABRIC_ROOT" "$W0T10_FABRIC_SHA"
check_root_head_clean soc "$W0T10_SOC_ROOT" "$W0T10_SOC_SHA"
printf 'LAYER_RESULT=PASS\n'

finish PASS none 0
