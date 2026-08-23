#!/usr/bin/env bash
# ==============================================================================
# CYBRIK SOC — T0 PRODUCTION HOST BOOTSTRAP SCRIPT (REVISION 3.2)
# Version: 3.2.0
# Target OS: Ubuntu 24.04 LTS (Noble Numbat) ONLY
#
# GOVERNANCE NOTICE:
# This script configures INFRASTRUCTURE PREREQUISITES ONLY.
# It MUST NOT deploy CYBRIK application workloads (SOC API, SOC Portal, Cyber AI).
# It MUST NOT run Alembic database migrations.
# It MUST NOT enable Tool Fabric.
#
# USAGE:
#   bootstrap-production-host-R3.sh --stage1 --authorized-key-file <PATH_TO_PUBKEY>
#   bootstrap-production-host-R3.sh --get-challenge-nonce
#   bootstrap-production-host-R3.sh --record-operator-proof --challenge-nonce <NONCE>
#   bootstrap-production-host-R3.sh --stage2
#   bootstrap-production-host-R3.sh --verify
# ==============================================================================

set -euo pipefail

CYBRIK_OPT_DIR="/opt/cybrik"
STAGE1_MARKER="${CYBRIK_OPT_DIR}/.bootstrap_stage1_complete"
STAGE1_HEALTH_MARKER="${CYBRIK_OPT_DIR}/.bootstrap_stage1_healthy"
OPERATOR_CHALLENGE_FILE="${CYBRIK_OPT_DIR}/.operator_ssh_challenge"
OPERATOR_PROOF_FILE="${CYBRIK_OPT_DIR}/.operator_ssh_proof"
STAGE2_MARKER="${CYBRIK_OPT_DIR}/.bootstrap_stage2_complete"

log_info() {
    echo "==> [CYBRIK-BOOTSTRAP-R3.2] $*"
}

log_error() {
    echo "[-] ERROR: $*" >&2
}

verify_root() {
    if [[ "${EUID}" -ne 0 ]]; then
        log_error "This bootstrap command must be run as root (or via authorized sudo)."
        exit 1
    fi
}

verify_os() {
    if [[ ! -f /etc/os-release ]]; then
        log_error "/etc/os-release not found. Unsupported platform."
        exit 1
    fi
    # shellcheck source=/dev/null
    source /etc/os-release
    if [[ "${ID:-}" != "ubuntu" || "${VERSION_ID:-}" != "24.04" ]]; then
        log_error "Unsupported OS '${PRETTY_NAME:-Unknown}'. Only Ubuntu 24.04 LTS is supported."
        exit 1
    fi
}

do_stage1() {
    local key_file=""
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --authorized-key-file)
                key_file="$2"
                shift 2
                ;;
            *)
                log_error "Unknown stage1 argument: $1"
                exit 1
                ;;
        esac
    done

    if [[ -z "${key_file}" ]]; then
        log_error "Missing required argument --authorized-key-file <PATH>"
        exit 1
    fi

    if [[ ! -f "${key_file}" || ! -s "${key_file}" ]]; then
        log_error "Authorized key file '${key_file}' does not exist or is empty."
        exit 1
    fi

    # Validate SSH public key format
    if ! grep -qE "^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521|sk-ssh-ed25519@openssh.com) " "${key_file}"; then
        log_error "File '${key_file}' does not contain a valid OpenSSH public key."
        exit 1
    fi

    verify_root
    verify_os

    log_info "Executing Stage 1: Core System Hardening, Operator Setup, and Runtime Installation..."

    # Test Mode Injection: Docker Repository Failure
    if [[ "${CYBRIK_BOOTSTRAP_TEST_MODE:-0}" == "1" && "${CYBRIK_INJECT_FAIL_REPO:-0}" == "1" ]]; then
        log_error "TEST_MODE: Simulating Docker repository retrieval failure."
        exit 1
    fi

    # 1. System Updates & Core Packages
    log_info "[1/9] Updating package lists and installing core infrastructure packages..."
    apt-get update -y
    DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release \
        ufw \
        fail2ban \
        chrony \
        logrotate \
        age \
        jq \
        iptables \
        openssh-server

    # 2. Time Synchronization (No silent success)
    log_info "[2/9] Configuring and starting Chrony NTP..."
    systemctl enable --now chrony

    # 3. Dedicated Operator Account
    log_info "[3/9] Creating and configuring operator account 'cybrik-admin'..."
    if ! id -u cybrik-admin >/dev/null 2>&1; then
        useradd -m -s /bin/bash cybrik-admin
    fi

    # Install Operator Public Key
    local op_ssh_dir="/home/cybrik-admin/.ssh"
    mkdir -p "${op_ssh_dir}"
    cp "${key_file}" "${op_ssh_dir}/authorized_keys"
    chown -R cybrik-admin:cybrik-admin "${op_ssh_dir}"
    chmod 0700 "${op_ssh_dir}"
    chmod 0600 "${op_ssh_dir}/authorized_keys"

    # Compute key fingerprint directly from installed authorized_keys
    local auth_fp
    auth_fp=$(ssh-keygen -lf "${op_ssh_dir}/authorized_keys" | awk '{print $2}')
    if [[ -z "${auth_fp}" ]]; then
        log_error "Failed to compute fingerprint from ${op_ssh_dir}/authorized_keys."
        exit 1
    fi

    # 4. Scoped Sudoers Configuration
    log_info "[4/9] Installing scoped sudoers policy for cybrik-admin..."
    
    # Test Mode Injection: Sudoers Failure
    if [[ "${CYBRIK_BOOTSTRAP_TEST_MODE:-0}" == "1" && "${CYBRIK_INJECT_FAIL_SUDOERS:-0}" == "1" ]]; then
        cat <<'EOF' > /etc/sudoers.d/99-cybrik-admin
INVALID_SUDOERS_SYNTAX !!!
EOF
    else
        cat <<'EOF' > /etc/sudoers.d/99-cybrik-admin
# CYBRIK SOC — Scoped Operator Sudo Privileges
Defaults env_keep += "SSH_CONNECTION SSH_CLIENT SSH_TTY"
Cmnd_Alias CYBRIK_INFRA = /usr/bin/systemctl, /usr/sbin/service, /usr/sbin/ufw, /usr/bin/docker, /usr/bin/apt-get, /usr/bin/journalctl, /usr/sbin/iptables, /opt/cybrik/bin/*
cybrik-admin ALL=(ALL) NOPASSWD: CYBRIK_INFRA
EOF
    fi
    chmod 0440 /etc/sudoers.d/99-cybrik-admin

    if ! visudo -cf /etc/sudoers.d/99-cybrik-admin; then
        log_error "visudo syntax check failed on /etc/sudoers.d/99-cybrik-admin. Reverting."
        rm -f /etc/sudoers.d/99-cybrik-admin
        exit 1
    fi

    # 5. Docker CE Installation & Daemon Hardening
    log_info "[5/9] Installing Docker CE and applying hardened daemon configuration..."
    install -m 0755 -d /etc/apt/keyrings
    if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
        chmod a+r /etc/apt/keyrings/docker.asc
    fi

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      noble stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin

    usermod -aG docker cybrik-admin

    mkdir -p /etc/docker
    if [[ "${CYBRIK_BOOTSTRAP_TEST_MODE:-0}" == "1" && "${CYBRIK_INJECT_FAIL_DOCKER_DAEMON:-0}" == "1" ]]; then
        cat <<'EOF' > /etc/docker/daemon.json
{ invalid json }
EOF
        if ! systemctl restart docker; then
            rm -f /etc/docker/daemon.json
            log_error "Docker daemon failed to start/restart with invalid daemon.json (syntax validation failed)."
            exit 1
        fi
    else
        cat <<'EOF' > /etc/docker/daemon.json
{
  "live-restore": true,
  "no-new-privileges": true,
  "icc": false,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  }
}
EOF
        # Restart Docker and verify healthy
        if ! systemctl restart docker; then
            log_error "Docker daemon failed to start/restart."
            exit 1
        fi
    fi

    # 6. Fail2ban SSH Jail Configuration
    log_info "[6/9] Configuring fail2ban SSH jail..."
    mkdir -p /etc/fail2ban/jail.d
    cat <<'EOF' > /etc/fail2ban/jail.d/cybrik-sshd.conf
[sshd]
enabled = true
port = ssh
filter = sshd
maxretry = 3
bantime = 3600
findtime = 600
EOF
    systemctl enable --now fail2ban

    # 7. Host Firewall (UFW) & DOCKER-USER Chain Protection
    log_info "[7/9] Configuring host firewall (UFW) and DOCKER-USER chain..."
    if [[ "${CYBRIK_BOOTSTRAP_TEST_MODE:-0}" == "1" && "${CYBRIK_INJECT_FAIL_FIREWALL:-0}" == "1" ]]; then
        log_error "TEST_MODE: Simulating firewall configuration failure."
        exit 1
    fi

    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw limit 22/tcp comment "SSH rate limited"
    ufw allow 80/tcp comment "HTTP redirect"
    ufw allow 443/tcp comment "HTTPS ingress"
    ufw --force enable

    # Configure DOCKER-USER chain in iptables to block direct Docker publication bypass for forbidden ports
    iptables -N DOCKER-USER 2>/dev/null || true
    iptables -C DOCKER-USER -p tcp -m multiport --dports 5432,6379,8000,8600,9000 -j DROP 2>/dev/null || \
    iptables -I DOCKER-USER 1 -p tcp -m multiport --dports 5432,6379,8000,8600,9000 -j DROP

    # 8. Prepare Stage 2 Candidate SSH Config (01-cybrik-hardening.conf)
    log_info "[8/9] Preparing candidate SSH hardening configuration..."
    mkdir -p /etc/ssh/sshd_config.d
    cat <<'EOF' > /etc/ssh/sshd_config.d/01-cybrik-hardening.conf.candidate
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

    # 9. Initialize Directory Layout & Generate Cryptographic Root Challenge
    log_info "[9/9] Generating root-owned cryptographic operator challenge..."
    mkdir -p "${CYBRIK_OPT_DIR}"/{bin,config,data,backup,logs}
    chown -R cybrik-admin:cybrik-admin "${CYBRIK_OPT_DIR}"
    chmod 0750 "${CYBRIK_OPT_DIR}"

    # Generate random challenge nonce
    local challenge_nonce
    challenge_nonce=$(head -c 32 /dev/urandom | sha256sum | awk '{print $1}')
    local now_iso
    now_iso=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local epoch_now
    epoch_now=$(date +%s)
    local host_id
    host_id=$(uname -n)

    cat <<EOF > "${OPERATOR_CHALLENGE_FILE}"
{
  "schema_version": "3.2.0",
  "challenge_nonce": "${challenge_nonce}",
  "authorized_key_fingerprint": "${auth_fp}",
  "host_identity": "${host_id}",
  "created_at_utc": "${now_iso}",
  "created_timestamp_epoch": ${epoch_now},
  "status": "PENDING_OPERATOR_AUTHENTICATION"
}
EOF
    chmod 0600 "${OPERATOR_CHALLENGE_FILE}"
    chown root:root "${OPERATOR_CHALLENGE_FILE}"

    # Clean up any stale proof or stage2 marker on fresh stage1 run
    rm -f "${OPERATOR_PROOF_FILE}" "${STAGE2_MARKER}" "${STAGE1_HEALTH_MARKER}"
    touch "${STAGE1_MARKER}"

    # Mandatory Stage 1 Health Gate Verification
    log_info "Verifying Stage 1 health preconditions before creating health marker..."
    if ! systemctl is-active --quiet chrony; then
        log_error "Chrony health check failed."
        exit 1
    fi
    if ! systemctl is-active --quiet docker; then
        log_error "Docker health check failed."
        exit 1
    fi
    if ! systemctl is-active --quiet fail2ban; then
        log_error "Fail2ban health check failed."
        exit 1
    fi
    if ! ufw status | grep -q "Status: active"; then
        log_error "UFW firewall health check failed."
        exit 1
    fi
    if ! iptables -S DOCKER-USER | grep -q -- "-j DROP"; then
        log_error "DOCKER-USER firewall rule verification failed."
        exit 1
    fi

    touch "${STAGE1_HEALTH_MARKER}"
    log_info "Stage 1 Complete and Healthy (Health marker created). Cryptographic operator challenge generated."
}

do_get_challenge_nonce() {
    verify_root
    if [[ ! -f "${OPERATOR_CHALLENGE_FILE}" ]]; then
        log_error "Challenge file ${OPERATOR_CHALLENGE_FILE} not found."
        exit 1
    fi
    jq -r .challenge_nonce "${OPERATOR_CHALLENGE_FILE}"
}

do_record_operator_proof() {
    verify_root
    verify_os

    local nonce_arg=""
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --challenge-nonce)
                nonce_arg="$2"
                shift 2
                ;;
            *)
                log_error "Unknown argument for record-operator-proof: $1"
                exit 1
                ;;
        esac
    done

    if [[ -z "${nonce_arg}" ]]; then
        log_error "Missing required argument --challenge-nonce <NONCE>"
        exit 1
    fi

    # Check 1: Invocation MUST originate via sudo as cybrik-admin
    if [[ "${SUDO_USER:-}" != "cybrik-admin" ]]; then
        log_error "AUTHORIZATION DENIED: Proof recording MUST be invoked via sudo by operator 'cybrik-admin' (Observed SUDO_USER='${SUDO_USER:-NONE}')."
        exit 1
    fi

    # Check 2: Invocation MUST originate from an active SSH session
    if [[ -z "${SSH_CONNECTION:-}" && -z "${SSH_CLIENT:-}" && -z "${SSH_TTY:-}" ]]; then
        log_error "SESSION DENIED: Proof recording MUST originate from an active SSH session (SSH_CONNECTION / SSH_CLIENT / SSH_TTY is empty)."
        exit 1
    fi

    # Check 3: Stage 1 markers must exist
    if [[ ! -f "${STAGE1_MARKER}" || ! -f "${STAGE1_HEALTH_MARKER}" ]]; then
        log_error "Stage 1 markers missing. Cannot record operator proof on degraded or uninitialized host."
        exit 1
    fi

    # Check 4: Challenge file must exist and be valid JSON
    if [[ ! -f "${OPERATOR_CHALLENGE_FILE}" ]]; then
        log_error "Challenge file ${OPERATOR_CHALLENGE_FILE} not found or already consumed."
        exit 1
    fi

    local exp_nonce exp_fp exp_status exp_epoch host_id
    exp_nonce=$(jq -r .challenge_nonce "${OPERATOR_CHALLENGE_FILE}")
    exp_fp=$(jq -r .authorized_key_fingerprint "${OPERATOR_CHALLENGE_FILE}")
    exp_status=$(jq -r .status "${OPERATOR_CHALLENGE_FILE}")
    exp_epoch=$(jq -r .created_timestamp_epoch "${OPERATOR_CHALLENGE_FILE}")
    host_id=$(jq -r .host_identity "${OPERATOR_CHALLENGE_FILE}")

    if [[ "${exp_status}" != "PENDING_OPERATOR_AUTHENTICATION" ]]; then
        log_error "Challenge status '${exp_status}' is invalid."
        exit 1
    fi

    # Freshness check: challenge must be < 300 seconds old
    local now_epoch
    now_epoch=$(date +%s)
    local age=$((now_epoch - exp_epoch))
    if [[ ${age} -gt 300 ]]; then
        log_error "Challenge expired (age: ${age}s > 300s). Re-run Stage 1 to generate a fresh challenge."
        rm -f "${OPERATOR_CHALLENGE_FILE}"
        exit 1
    fi

    # Nonce matching check
    if [[ "${nonce_arg}" != "${exp_nonce}" ]]; then
        log_error "Challenge nonce mismatch (Supplied: '${nonce_arg}' != Expected: '${exp_nonce}')."
        exit 1
    fi

    # Host identity check
    if [[ "${host_id}" != "$(uname -n)" ]]; then
        log_error "Host identity mismatch (Challenge: '${host_id}' != Host: '$(uname -n)')."
        exit 1
    fi

    # Compute CURRENT authorized_keys fingerprint to detect post-Stage1 modification
    local curr_fp
    if [[ ! -f /home/cybrik-admin/.ssh/authorized_keys ]]; then
        log_error "/home/cybrik-admin/.ssh/authorized_keys missing."
        exit 1
    fi
    curr_fp=$(ssh-keygen -lf /home/cybrik-admin/.ssh/authorized_keys | awk '{print $2}')
    if [[ "${curr_fp}" != "${exp_fp}" ]]; then
        log_error "Authorized key modification detected (Current: '${curr_fp}' != Challenge: '${exp_fp}')."
        exit 1
    fi

    # Compute SSH connection hash
    local raw_conn="${SSH_CONNECTION:-${SSH_CLIENT:-${SSH_TTY:-authenticated_session}}}"
    local conn_hash
    conn_hash=$(echo -n "${raw_conn}" | sha256sum | awk '{print $1}')

    log_info "Recording Machine-Enforced Operator SSH Authentication Proof..."

    local now_iso
    now_iso=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    cat <<EOF > "${OPERATOR_PROOF_FILE}"
{
  "schema_version": "3.2.0",
  "proof_type": "OPERATOR_SSH_AUTHENTICATION_PROVEN",
  "operator": "cybrik-admin",
  "key_fingerprint": "${curr_fp}",
  "challenge_nonce": "${exp_nonce}",
  "ssh_connection_hash": "${conn_hash}",
  "host_identity": "$(uname -n)",
  "recorded_at_utc": "${now_iso}",
  "status": "OPERATOR_SSH_AUTHENTICATION_PROVEN"
}
EOF

    chmod 0600 "${OPERATOR_PROOF_FILE}"
    chown root:root "${OPERATOR_PROOF_FILE}"

    # Invalidate / consume challenge
    rm -f "${OPERATOR_CHALLENGE_FILE}"

    log_info "Operator SSH Authentication Proof successfully recorded in ${OPERATOR_PROOF_FILE}. Challenge consumed."
}

do_stage2() {
    verify_root
    verify_os

    if [[ ! -f "${STAGE1_MARKER}" || ! -f "${STAGE1_HEALTH_MARKER}" ]]; then
        log_error "Stage 1 health marker missing. Stage 1 must be completed and healthy before Stage 2."
        exit 1
    fi

    if [[ ! -f "${OPERATOR_PROOF_FILE}" ]]; then
        log_error "MANDATORY OPERATOR PROOF MISSING: Cannot proceed to Stage 2 root lockdown without verified operator SSH proof in ${OPERATOR_PROOF_FILE}."
        exit 1
    fi

    # Structural parsing of proof file using jq
    local proof_status proof_op proof_fp proof_nonce proof_conn_hash
    proof_status=$(jq -r .status "${OPERATOR_PROOF_FILE}" 2>/dev/null || echo "INVALID")
    proof_op=$(jq -r .operator "${OPERATOR_PROOF_FILE}" 2>/dev/null || echo "INVALID")
    proof_fp=$(jq -r .key_fingerprint "${OPERATOR_PROOF_FILE}" 2>/dev/null || echo "INVALID")
    proof_nonce=$(jq -r .challenge_nonce "${OPERATOR_PROOF_FILE}" 2>/dev/null || echo "INVALID")
    proof_conn_hash=$(jq -r .ssh_connection_hash "${OPERATOR_PROOF_FILE}" 2>/dev/null || echo "INVALID")

    if [[ "${proof_status}" != "OPERATOR_SSH_AUTHENTICATION_PROVEN" || "${proof_op}" != "cybrik-admin" || "${proof_nonce}" == "INVALID" || -z "${proof_conn_hash}" ]]; then
        log_error "INVALID OPERATOR PROOF: Structural validation failed on ${OPERATOR_PROOF_FILE}."
        exit 1
    fi

    # Verify proof fingerprint matches current authorized_keys
    local curr_fp
    curr_fp=$(ssh-keygen -lf /home/cybrik-admin/.ssh/authorized_keys | awk '{print $2}')
    if [[ "${proof_fp}" != "${curr_fp}" ]]; then
        log_error "PROOF MISMATCH: Proof fingerprint '${proof_fp}' != Current authorized_keys '${curr_fp}'."
        exit 1
    fi

    log_info "Operator authentication proof structurally verified. Executing Stage 2: SSH Lockdown & Final Service Reload..."

    local candidate_cfg="/etc/ssh/sshd_config.d/01-cybrik-hardening.conf.candidate"
    local active_cfg="/etc/ssh/sshd_config.d/01-cybrik-hardening.conf"

    # Test Mode Injection: SSHD Failure
    if [[ "${CYBRIK_BOOTSTRAP_TEST_MODE:-0}" == "1" && "${CYBRIK_INJECT_FAIL_SSHD:-0}" == "1" ]]; then
        cat <<'EOF' > "${candidate_cfg}"
InvalidSshdOption yes
EOF
    fi

    if [[ ! -f "${candidate_cfg}" ]]; then
        log_error "Candidate SSH config '${candidate_cfg}' not found."
        exit 1
    fi

    # Remove conflicting drop-ins
    rm -f /etc/ssh/sshd_config.d/50-cybrik-hardening.conf /etc/ssh/sshd_config.d/50-cloud-init.conf 2>/dev/null || true

    cp "${candidate_cfg}" "${active_cfg}"

    # Syntax verification before reload
    if sshd -t; then
        systemctl reload ssh || systemctl reload sshd || service ssh reload
        log_info "SSHD configuration verified and reloaded successfully."
    else
        log_error "sshd -t syntax test failed! Reverting drop-in."
        rm -f "${active_cfg}"
        exit 1
    fi

    touch "${STAGE2_MARKER}"
    log_info "Stage 2 Complete. Host root access is locked down and hardened."
}

do_verify() {
    verify_root
    verify_os

    log_info "Executing Post-Bootstrap Verification..."

    local err_count=0

    # 1. Check markers and operator proof
    if [[ ! -f "${STAGE1_MARKER}" || ! -f "${STAGE1_HEALTH_MARKER}" ]]; then
        log_error "Stage 1 markers missing."
        err_count=$((err_count + 1))
    fi

    if [[ ! -f "${OPERATOR_PROOF_FILE}" ]]; then
        log_error "Operator SSH proof file missing."
        err_count=$((err_count + 1))
    fi

    if [[ ! -f "${STAGE2_MARKER}" ]]; then
        log_error "Stage 2 marker missing."
        err_count=$((err_count + 1))
    fi

    # 2. Check Sudoers
    if ! visudo -cf /etc/sudoers.d/99-cybrik-admin; then
        log_error "Sudoers validation failed on /etc/sudoers.d/99-cybrik-admin."
        err_count=$((err_count + 1))
    fi

    # 3. Check SSH Config
    if ! sshd -t; then
        log_error "sshd configuration validation failed."
        err_count=$((err_count + 1))
    fi

    # 4. Check Docker daemon json
    if [[ ! -f /etc/docker/daemon.json ]] || ! jq . /etc/docker/daemon.json >/dev/null 2>&1; then
        log_error "Docker daemon.json missing or invalid JSON."
        err_count=$((err_count + 1))
    fi

    # 5. Check Fail2ban
    if systemctl is-active --quiet fail2ban; then
        log_info "Fail2ban is active."
    else
        log_error "Fail2ban is not active."
        err_count=$((err_count + 1))
    fi

    # 6. Check Chrony
    if systemctl is-active --quiet chrony; then
        log_info "Chrony is active."
    else
        log_error "Chrony is not active."
        err_count=$((err_count + 1))
    fi

    # 7. Check Docker
    if systemctl is-active --quiet docker; then
        log_info "Docker is active."
    else
        log_error "Docker is not active."
        err_count=$((err_count + 1))
    fi

    # 8. Check UFW
    if ufw status | grep -q "Status: active"; then
        log_info "UFW firewall is active."
    else
        log_error "UFW is not active."
        err_count=$((err_count + 1))
    fi

    # 9. Check DOCKER-USER
    if iptables -S DOCKER-USER | grep -q -- "-j DROP"; then
        log_info "DOCKER-USER firewall protection rule is active."
    else
        log_error "DOCKER-USER firewall rule missing."
        err_count=$((err_count + 1))
    fi

    if [[ ${err_count} -gt 0 ]]; then
        log_error "Verification finished with ${err_count} errors."
        exit 1
    fi

    log_info "Verification PASS: All infrastructure controls verified healthy."
}

main() {
    if [[ $# -eq 0 ]]; then
        log_error "No command specified. Use --stage1, --get-challenge-nonce, --record-operator-proof, --stage2, or --verify."
        exit 1
    fi

    case "$1" in
        --stage1)
            shift
            do_stage1 "$@"
            ;;
        --get-challenge-nonce)
            do_get_challenge_nonce
            ;;
        --record-operator-proof)
            shift
            do_record_operator_proof "$@"
            ;;
        --stage2)
            do_stage2
            ;;
        --verify)
            do_verify
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
}

main "$@"
