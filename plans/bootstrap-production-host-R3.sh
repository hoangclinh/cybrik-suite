#!/usr/bin/env bash
# ==============================================================================
# CYBRIK SOC — T0 PRODUCTION HOST BOOTSTRAP SCRIPT (REVISION 3)
# Version: 3.0.0
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
#   bootstrap-production-host-R3.sh --stage2
#   bootstrap-production-host-R3.sh --verify
# ==============================================================================

set -euo pipefail

CYBRIK_OPT_DIR="/opt/cybrik"
STAGE1_MARKER="${CYBRIK_OPT_DIR}/.bootstrap_stage1_complete"
STAGE2_MARKER="${CYBRIK_OPT_DIR}/.bootstrap_stage2_complete"

log_info() {
    echo "==> [CYBRIK-BOOTSTRAP-R3] $*"
}

log_error() {
    echo "[-] ERROR: $*" >&2
}

verify_root() {
    if [[ "${EUID}" -ne 0 ]]; then
        log_error "This bootstrap script must be run as root."
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

    # 1. System Updates & Core Packages
    log_info "[1/8] Updating package lists and installing core infrastructure packages..."
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
        openssh-server

    # 2. Time Synchronization
    log_info "[2/8] Configuring and starting Chrony NTP..."
    systemctl enable --now chrony || true

    # 3. Dedicated Operator Account
    log_info "[3/8] Creating and configuring operator account 'cybrik-admin'..."
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

    # 4. Scoped Sudoers Configuration
    log_info "[4/8] Installing scoped sudoers policy for cybrik-admin..."
    cat <<'EOF' > /etc/sudoers.d/99-cybrik-admin
# CYBRIK SOC — Scoped Operator Sudo Privileges
Cmnd_Alias CYBRIK_INFRA = /usr/bin/systemctl, /usr/sbin/service, /usr/sbin/ufw, /usr/bin/docker, /usr/bin/apt-get, /usr/bin/journalctl
cybrik-admin ALL=(ALL) NOPASSWD: CYBRIK_INFRA
EOF
    chmod 0440 /etc/sudoers.d/99-cybrik-admin

    if ! visudo -cf /etc/sudoers.d/99-cybrik-admin; then
        log_error "visudo syntax check failed on /etc/sudoers.d/99-cybrik-admin. Reverting."
        rm -f /etc/sudoers.d/99-cybrik-admin
        exit 1
    fi

    # 5. Docker CE Installation & Daemon Hardening
    log_info "[5/8] Installing Docker CE and applying hardened daemon configuration..."
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
    systemctl restart docker || true

    # 6. Fail2ban SSH Jail Configuration
    log_info "[6/8] Configuring fail2ban SSH jail..."
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
    systemctl enable --now fail2ban || true

    # 7. Host Firewall (UFW)
    log_info "[7/8] Configuring host firewall (UFW)..."
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw limit 22/tcp comment "SSH rate limited"
    ufw allow 80/tcp comment "HTTP redirect"
    ufw allow 443/tcp comment "HTTPS ingress"
    ufw --force enable || true

    # 8. Prepare Stage 2 Candidate SSH Config (Do NOT lockdown yet)
    log_info "[8/8] Preparing candidate SSH hardening configuration..."
    mkdir -p /etc/ssh/sshd_config.d
    cat <<'EOF' > /etc/ssh/sshd_config.d/50-cybrik-hardening.conf.candidate
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

    mkdir -p "${CYBRIK_OPT_DIR}"/{config,data,backup,logs}
    chown -R cybrik-admin:cybrik-admin "${CYBRIK_OPT_DIR}"
    chmod 0750 "${CYBRIK_OPT_DIR}"

    touch "${STAGE1_MARKER}"
    log_info "Stage 1 Complete. Ready for Operator SSH Login Proof before Stage 2 lockdown."
}

do_stage2() {
    verify_root
    verify_os

    if [[ ! -f "${STAGE1_MARKER}" ]]; then
        log_error "Stage 1 marker not found. Stage 1 must be completed and proven before Stage 2."
        exit 1
    fi

    log_info "Executing Stage 2: SSH Lockdown & Final Service Reload..."

    local candidate_cfg="/etc/ssh/sshd_config.d/50-cybrik-hardening.conf.candidate"
    local active_cfg="/etc/ssh/sshd_config.d/50-cybrik-hardening.conf"

    if [[ ! -f "${candidate_cfg}" ]]; then
        log_error "Candidate SSH config '${candidate_cfg}' not found."
        exit 1
    fi

    cp "${candidate_cfg}" "${active_cfg}"

    # Syntax verification before reload
    if sshd -t; then
        systemctl reload ssh || systemctl reload sshd || service ssh reload || true
        log_info "SSHD configuration verified and reloaded successfully."
    else
        log_error "sshd -t syntax test failed! Reverting drop-in."
        rm -f "${active_cfg}"
        exit 1
    fi

    touch "${STAGE2_MARKER}"
    log_info "Stage 2 Complete. Host is fully locked down and hardened."
}

do_verify() {
    verify_root
    verify_os

    log_info "Executing Post-Bootstrap Verification..."

    local err_count=0

    # 1. Check markers
    if [[ ! -f "${STAGE1_MARKER}" || ! -f "${STAGE2_MARKER}" ]]; then
        log_error "Stage markers missing (Stage1: $(test -f "${STAGE1_MARKER}" && echo YES || echo NO), Stage2: $(test -f "${STAGE2_MARKER}" && echo YES || echo NO))"
        err_count=$((err_count + 1))
    fi

    # 2. Check Sudoers
    if ! visudo -cf /etc/sudoers.d/99-cybrik-admin; then
        log_error "Sudoers validation failed."
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

    if [[ ${err_count} -gt 0 ]]; then
        log_error "Verification finished with ${err_count} errors."
        exit 1
    fi

    log_info "Verification PASS: All infrastructure controls verified healthy."
}

main() {
    if [[ $# -eq 0 ]]; then
        log_error "No command specified. Use --stage1, --stage2, or --verify."
        exit 1
    fi

    case "$1" in
        --stage1)
            shift
            do_stage1 "$@"
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
