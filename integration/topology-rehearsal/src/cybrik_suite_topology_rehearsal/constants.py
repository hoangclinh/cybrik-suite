"""The single place a reviewed number, path or identifier may be typed.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

Every value below is copied from the committed diagnosis packet
`G-U2B-POSTGRES-RUNTIME-TOPOLOGY-DIAGNOSIS-R1.md` and the committed machine record
`topology-rehearsal.json`. No value here was invented, and no post-attempt observation
belonging to a record is re-typed as an executable constant.

Composite values are derived from their own parts rather than typed twice, so a reviewed
port or protocol cannot drift between the bind string, the container port key and the
expected publication. Every container constant is an immutable tuple or read-only mapping:
a list or a plain dict would let one caller mutate a reviewed value for every other caller
in the process.
"""

from __future__ import annotations

from types import MappingProxyType

__all__ = [
    "ATTEMPT_ORDINAL",
    "AUTHORIZATION_NAMESPACE",
    "CAPABILITY_ID",
    "CONTAINER_CREDENTIAL_PATH",
    "CONTAINER_PORT",
    "CONTAINER_PORT_KEY",
    "CONTROL_REPOSITORIES",
    "CREATION_KINDS",
    "CREDENTIAL_DIRECTORY",
    "DOCKER_EXECUTABLE_PATH",
    "EVIDENCE_KEYS",
    "EXPECTED_PUBLICATION",
    "EXTENSION_CYCLES",
    "FAIL_INTERNAL_INGRESS",
    "FAIL_PUBLICATION",
    "GRANT_KEYS",
    "GRANT_NO_AUTHORITY",
    "GRANT_PATH",
    "GRANT_SCHEMA",
    "HEALTH_HEALTHY",
    "HOST_IP",
    "HOST_PORT",
    "IMAGE_REFERENCE",
    "IMAGE_RESOLVED",
    "IMAGE_UNRESOLVED",
    "MAX_ATTEMPTS",
    "OBJECTIVE_ID",
    "OUTCOME_NOT_RUN",
    "OUTCOME_PRECEDENCE",
    "PHASE_AUTHORIZED",
    "PORT_PROTOCOL",
    "PRECHECK_ABORT",
    "PROBE_ARGV",
    "PROBE_EXECUTABLE_PATH",
    "PROBE_EXECUTABLE_SHA256",
    "PROBE_REACHABLE",
    "PUBLICATION_VIEWS",
    "PUBLISH_SPEC",
    "PULL_POLICY",
    "RECORD_DIR",
    "RECORD_ID",
    "RECORD_PATH",
    "RECORD_PRODUCTION_EXCLUSION",
    "RUNTIME_LIMIT_SECONDS",
    "SELECTED_IDENTITY_KEYS",
    "SERIES_ID",
    "SIGNER",
    "STOP_CONTROL",
    "TEARDOWN_KINDS",
    "TOPOLOGY_PASS",
]

# --------------------------------------------------------------------------------------
# Identity of the one authorized preflight record (diagnosis section 9 item 2).
# --------------------------------------------------------------------------------------
CAPABILITY_ID = "cybrik.suite.runtime-topology"
OBJECTIVE_ID = "postgres-loopback-internal-v1"
SERIES_ID = "postgres-loopback-internal-v1"
RECORD_ID = "postgres-loopback-internal-v1-r1"
RECORD_DIR = f"docs/uat/topology-rehearsals/{RECORD_ID}"
RECORD_PATH = f"{RECORD_DIR}/topology-rehearsal.json"
GRANT_PATH = f"{RECORD_DIR}/G-U2B-POSTGRES-TOPOLOGY-REHEARSAL-GRANT-R1.json"
GRANT_SCHEMA = "CYBRIK-TOPOLOGY-REHEARSAL-GRANT/v1"
AUTHORIZATION_NAMESPACE = "cybrik-uat-topology-rehearsal-v1"
SIGNER = "FOUNDER"

# --------------------------------------------------------------------------------------
# The single reviewed publication (diagnosis section 6). The bind string, the container
# port key and the expected publication are composed from these four parts so that no
# independently typed literal can drift away from the reviewed mapping.
# --------------------------------------------------------------------------------------
HOST_IP = "127.0.0.1"
HOST_PORT = 15433
CONTAINER_PORT = 5432
PORT_PROTOCOL = "tcp"
CONTAINER_PORT_KEY = f"{CONTAINER_PORT}/{PORT_PROTOCOL}"
PUBLISH_SPEC = f"{HOST_IP}:{HOST_PORT}:{CONTAINER_PORT}/{PORT_PROTOCOL}"
EXPECTED_PUBLICATION = f"{HOST_IP}:{HOST_PORT}"

# --------------------------------------------------------------------------------------
# The already-present image and its selection identity (diagnosis section 7 item 2).
# `SELECTED_IDENTITY_KEYS` carries no host-only observation: a selected registry identity
# may never claim a local image id, an observation time or its own resolution state.
# --------------------------------------------------------------------------------------
IMAGE_REFERENCE = "postgres:16-alpine"
PULL_POLICY = "never"
SELECTED_IDENTITY_KEYS = (
    "repository",
    "tag",
    "platform",
    "index_digest",
    "manifest_digest",
    "pull_policy",
)
IMAGE_RESOLVED = "RESOLVED"
IMAGE_UNRESOLVED = "UNRESOLVED"

# --------------------------------------------------------------------------------------
# The Docker client itself (diagnosis section 7 item 2). An absolute path is not a style
# preference: a bare name would resolve through `PATH`, so the reviewer could not pin which
# binary an attempt actually reached, and the tool identity recorded as evidence would name
# a file nobody selected.
# --------------------------------------------------------------------------------------
DOCKER_EXECUTABLE_PATH = "/usr/local/bin/docker"

# --------------------------------------------------------------------------------------
# The one-attempt credential material (diagnosis section 7 item 4). The host directory holds
# the ephemeral secret file; the container path is where that file is bind-mounted read-only.
# The database password is never an environment value or an argv token: only the path to the
# file is, so the secret itself is not readable in the host process table.
# --------------------------------------------------------------------------------------
CREDENTIAL_DIRECTORY = "/tmp/cybrik-topology-rehearsal"
CONTAINER_CREDENTIAL_PATH = "/run/secrets/cybrik-postgres-password"

# --------------------------------------------------------------------------------------
# The bounded host probe (diagnosis section 7 item 6). The literal IPv4 address forbids
# DNS and IPv6 fallback, `-z` forbids application data and `-w 5` bounds the connect.
# --------------------------------------------------------------------------------------
PROBE_EXECUTABLE_PATH = "/usr/bin/nc"
PROBE_EXECUTABLE_SHA256 = (
    "427423db6d5d5e9f720c5e110a2c9b3cba39ea089dafed4ab936d04dd218bdac"
)
PROBE_CONNECT_TIMEOUT = "5"
PROBE_ARGV = ("-z", "-w", PROBE_CONNECT_TIMEOUT, HOST_IP, str(HOST_PORT))
PROBE_REACHABLE = "reachable"
HEALTH_HEALTHY = "healthy"

# --------------------------------------------------------------------------------------
# The one bounded attempt (diagnosis section 7, runtime limit).
# --------------------------------------------------------------------------------------
RUNTIME_LIMIT_SECONDS = 180
EXTENSION_CYCLES = 0
ATTEMPT_ORDINAL = 1
MAX_ATTEMPTS = 1
OUTCOME_NOT_RUN = "not_run"
PHASE_AUTHORIZED = "authorized"

# --------------------------------------------------------------------------------------
# The five terminal classes and their exact fixed precedence (diagnosis section 8). A pass
# is the weakest class: it may only be reached when no failing class is a candidate.
# --------------------------------------------------------------------------------------
PRECHECK_ABORT = "PRECHECK_ABORT"
STOP_CONTROL = "STOP_CONTROL"
FAIL_PUBLICATION = "FAIL_PUBLICATION"
FAIL_INTERNAL_INGRESS = "FAIL_INTERNAL_INGRESS"
TOPOLOGY_PASS = "TOPOLOGY_PASS"
OUTCOME_PRECEDENCE = (
    PRECHECK_ABORT,
    STOP_CONTROL,
    FAIL_PUBLICATION,
    FAIL_INTERNAL_INGRESS,
    TOPOLOGY_PASS,
)

# The five projections that must all agree before a publication may be accepted
# (diagnosis section 7 item 6).
PUBLICATION_VIEWS = (
    "daemon_event",
    "host_config_port_bindings",
    "network_settings_ports",
    "docker_port",
    "host_listener",
)

# Creation order and the mandatory teardown inventory (diagnosis section 7 items 4 and 9).
# The credential material is created before the container that consumes it, the container
# is created last, and every created kind has a teardown target.
CREATION_KINDS = ("network", "volume", "credential", "container")
TEARDOWN_KINDS = ("container", "network", "volume", "credential")

# The control repositories whose identity and worktree cleanliness are re-observed before
# consumption (diagnosis section 7 item 1).
CONTROL_REPOSITORIES = (
    "cybrik-suite",
    "cybrik-soc-command-center",
    "cybrik-cyber-ai-platform",
    "cybrik-security-tool-fabric",
)

# The externally signed grant document and the two authority denials it carries. Both
# denials are read-only mappings: a plain dict would be mutable shared state, and a denial
# that one caller could flip is not a denial.
GRANT_KEYS = (
    "schema",
    "record",
    "runner",
    "topology",
    "selected_image_identity",
    "observed_image_identity",
    "repositories",
    "tools",
    "window",
    "attempt",
    "authorizes",
    "grants_no_authority",
)
GRANT_NO_AUTHORITY = MappingProxyType(
    {
        "demo": True,
        "merge": True,
        "product_runtime": True,
        "production": True,
        "release": True,
        "uat": True,
    }
)
RECORD_PRODUCTION_EXCLUSION = MappingProxyType(
    {
        "no_production_credentials": True,
        "no_production_configuration": True,
        "no_production_data": True,
        "no_production_traffic": True,
    }
)

# The complete evidence inventory a consumed attempt must record (diagnosis section 8).
EVIDENCE_KEYS = (
    "attempt_id",
    "platform",
    "control_identities",
    "image",
    "ephemeral_range",
    "pre_consumption_listeners",
    "publication_views",
    "network_attachment",
    "probe",
    "timings",
    "teardown",
)
