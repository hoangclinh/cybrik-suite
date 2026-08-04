"""Pure construction of the exact one-attempt Docker and probe command plan.

Status: `SCAFFOLD — LIBRARY ONLY — NO RUNTIME AUTHORITY`.

Building a plan performs no I/O and reaches nothing: it is a total function of the attempt
id, the digest-pinned image reference and the injected control-repository roots. Every argv
the rehearsal can ever hand to an executor is a named entry in `TopologyPlan.commands`, and
the create, observe and teardown sequences are assembled from those same entries rather than
rebuilt. A second, differently shaped argv for the same effect is exactly the drift risk this
module exists to remove, so the four command groups can only ever be views onto one table.

Every argument is an exact token. No entry carries a glob, a separator or an interpolation an
executor would have to re-parse, so there is no argv here that a host shell could widen. The
single argument that is re-parsed at all is the container healthcheck, which the *container*
runs through its own shell: it is a fixed string containing no host path, no credential and
no interpolated value, and it reaches nothing outside the container.

No entry names a non-loopback address, a host network, an image pull, a database client or a
test runner: the reviewed publication is the single loopback binding frozen in `constants`,
and the network is created `--internal`. No entry carries a secret value either — the
credential reaches the container as a read-only bind mount, and only its path is named.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType

from .constants import (
    AUTHORIZATION_NAMESPACE,
    CONTAINER_CREDENTIAL_PATH,
    CONTAINER_PORT,
    CONTAINER_PORT_KEY,
    CONTROL_REPOSITORIES,
    CREDENTIAL_DIRECTORY,
    DOCKER_EXECUTABLE_PATH,
    GRANT_PATH,
    HOST_IP,
    HOST_PORT,
    PROBE_ARGV,
    PROBE_EXECUTABLE_PATH,
    PUBLISH_SPEC,
    PULL_POLICY,
    RUNTIME_LIMIT_SECONDS,
    SIGNER,
)

__all__ = ["TopologyPlan", "build_plan"]

# Absolute executables. An absolute path is not a style preference here: a bare name would
# resolve through `PATH`, which the reviewer cannot pin.
DOCKER_EXECUTABLE = DOCKER_EXECUTABLE_PATH
GIT_EXECUTABLE = "/usr/bin/git"
LISTENER_EXECUTABLE = "/usr/sbin/lsof"
RANGE_EXECUTABLE = "/usr/sbin/sysctl"
DIGEST_EXECUTABLE = "/usr/bin/shasum"
SIGNATURE_EXECUTABLE = "/usr/bin/ssh-keygen"

# Resource naming. Every created resource name is derived from the one attempt id, so an
# attempt can never adopt or tear down a resource belonging to another attempt.
RESOURCE_PREFIX = "cybrik-topology"
NETWORK_INFIX = "net"
VOLUME_INFIX = "vol"
CREDENTIAL_INFIX = "credential"
CREDENTIAL_SUFFIX = ".secret"
ATTEMPT_LABEL_KEY = "cybrik.attempt_id"

# Read-only projections. `--format` keeps each observation machine-readable without a second
# parsing dialect, and every projection is a whole-object dump or one named field.
JSON_PROJECTION = "{{json .}}"
HEALTH_PROJECTION = "{{json .State.Health.Status}}"
NAME_PROJECTION = "{{json .Names}}"

# The daemon's own publication claim for the one reviewed container port. Dumping the whole
# attribute map would make the publication view depend on which other attributes the daemon
# happened to attach; indexing the exact reviewed key projects the one value being compared,
# and the key is composed from the reviewed container port rather than typed a second time.
EVENT_PUBLICATION_ATTRIBUTE = f"desktop.docker.io/ports/{CONTAINER_PORT_KEY}"
EVENT_PROJECTION = (
    f'{{{{json (index .Actor.Attributes "{EVENT_PUBLICATION_ATTRIBUTE}")}}}}'
)

# `-F` makes `lsof` emit one field per line with a leading field character instead of a
# column layout that varies by platform and by name width. `p` and `n` are the only two
# fields the publication view needs: the owning process and the listening address.
LISTENER_FIELDS = "-Fpn"

# The container healthcheck. `pg_isready` is the server's own readiness client, addressed
# over the container's local socket: it opens no host port, sends no query and needs no
# credential, so a readiness check cannot become an ingress path of its own.
HEALTH_COMMAND = "/usr/local/bin/pg_isready -U postgres"
CREDENTIAL_ENVIRONMENT_KEY = "POSTGRES_PASSWORD_FILE"

# The daemon event window is the runtime envelope itself, derived rather than re-typed, so a
# change to the reviewed limit cannot leave the event query looking at a different span.
EVENT_WINDOW = f"{RUNTIME_LIMIT_SECONDS}s"
EVENT_UNTIL = "0s"

CONTROL_OBSERVATIONS = ("commit", "tree", "status")
DATA_DIRECTORY = "/var/lib/postgresql/data"
EPHEMERAL_RANGE_KEYS = (
    "net.inet.ip.portrange.first",
    "net.inet.ip.portrange.last",
)
DIGEST_ALGORITHM = "256"
# Both authorization documents live in the Suite control worktree, and both are named from
# that injected root rather than from the process working directory: a relative path would
# make the verified signer list depend on where the runner happened to be started.
SUITE_REPOSITORY = CONTROL_REPOSITORIES[0]
ALLOWED_SIGNERS_PATH = "docs/uat/topology-rehearsal-allowed-signers"
SIGNATURE_PATH = f"{GRANT_PATH}.sig"
DIGEST_MARKER = "@"

# Characters an executor or a shell would have to re-interpret. None may appear in any token.
FORBIDDEN_TOKEN_CHARACTERS = frozenset(";|&`$\n\t*?")


@dataclass(frozen=True)
class TopologyPlan:
    """The complete, immutable command plan for exactly one bounded attempt."""

    attempt_id: str
    image_reference: str
    container_name: str
    network_name: str
    volume_name: str
    credential_name: str
    credential_path: str
    host_ip: str
    host_port: int
    container_port: int
    container_port_key: str
    publish_spec: str
    probe_executable_path: str
    commands: Mapping[str, tuple[str, ...]]
    create_commands: tuple[tuple[str, ...], ...]
    observe_commands: tuple[tuple[str, ...], ...]
    teardown_commands: tuple[tuple[str, ...], ...]
    host_probe: tuple[str, ...]


def exact_token(value: object, *, label: str) -> str:
    """One argv argument, or a refusal.

    An empty argument, a non-string or a token carrying a separator would let a reviewed
    command mean something the reviewer never read.
    """
    if not isinstance(value, str) or not value:
        raise ValueError(f"{label}: an argv token must be a non-empty string")
    offending = sorted(set(value) & FORBIDDEN_TOKEN_CHARACTERS)
    if offending:
        raise ValueError(f"{label}: argv token carries separators {offending}")
    return value


def control_commands(
    repository_roots: Mapping[str, str],
) -> dict[str, tuple[str, ...]]:
    """The three read-only identity observations for each control repository.

    `-C <root>` binds each observation to exactly the injected worktree, and the commit,
    the tree and the porcelain status are separate observations: a repository that reports
    only a commit cannot distinguish two worktrees that share it but differ in content.
    """
    missing = sorted(set(CONTROL_REPOSITORIES) - set(repository_roots))
    unexpected = sorted(set(repository_roots) - set(CONTROL_REPOSITORIES))
    if missing or unexpected:
        raise ValueError(
            f"repository_roots must be exactly the reviewed control repositories: "
            f"missing {missing}, unexpected {unexpected}"
        )
    commands: dict[str, tuple[str, ...]] = {}
    for repository in CONTROL_REPOSITORIES:
        root = exact_token(repository_roots[repository], label=f"root:{repository}")
        if not root.startswith("/"):
            raise ValueError(f"root:{repository}: a control root must be absolute")
        commands[f"control:{repository}:commit"] = (
            GIT_EXECUTABLE,
            "-C",
            root,
            "rev-parse",
            "HEAD",
        )
        commands[f"control:{repository}:tree"] = (
            GIT_EXECUTABLE,
            "-C",
            root,
            "rev-parse",
            "HEAD^{tree}",
        )
        commands[f"control:{repository}:status"] = (
            GIT_EXECUTABLE,
            "-C",
            root,
            "status",
            "--porcelain=v1",
            "--untracked-files=all",
        )
    return commands


def precondition_commands(
    *, image_reference: str, suite_root: str
) -> dict[str, tuple[str, ...]]:
    """The item 1-3 observations taken before anything is created."""
    return {
        "host:ephemeral_range": (RANGE_EXECUTABLE, "-n", *EPHEMERAL_RANGE_KEYS),
        "host:listeners": (
            LISTENER_EXECUTABLE,
            "-nP",
            "-sTCP:LISTEN",
            f"-iTCP:{HOST_PORT}",
            LISTENER_FIELDS,
        ),
        "docker:platform": (DOCKER_EXECUTABLE, "version", "--format", JSON_PROJECTION),
        "docker:digest": (
            DIGEST_EXECUTABLE,
            "-a",
            DIGEST_ALGORITHM,
            DOCKER_EXECUTABLE,
        ),
        "docker:image": (
            DOCKER_EXECUTABLE,
            "image",
            "inspect",
            "--format",
            JSON_PROJECTION,
            image_reference,
        ),
        "docker:publications": (
            DOCKER_EXECUTABLE,
            "ps",
            "--all",
            "--filter",
            f"publish={HOST_PORT}",
            "--format",
            JSON_PROJECTION,
        ),
        "probe:digest": (
            DIGEST_EXECUTABLE,
            "-a",
            DIGEST_ALGORITHM,
            PROBE_EXECUTABLE_PATH,
        ),
        "signature:verify": (
            SIGNATURE_EXECUTABLE,
            "-Y",
            "verify",
            "-f",
            f"{suite_root}/{ALLOWED_SIGNERS_PATH}",
            "-I",
            SIGNER,
            "-n",
            AUTHORIZATION_NAMESPACE,
            "-s",
            f"{suite_root}/{SIGNATURE_PATH}",
        ),
    }


def creation_commands(
    *,
    attempt_id: str,
    image_reference: str,
    container_name: str,
    network_name: str,
    volume_name: str,
    credential_path: str,
) -> dict[str, tuple[str, ...]]:
    """Network, volume and container creation, in the reviewed order.

    The network is `--internal`, so the container has no route off the host. The image is
    the digest-pinned reference and the pull policy forbids a fetch, so the attempt can only
    consume material that was already present and already reviewed.

    No secret value is typed into the argv. The one-attempt credential reaches the container
    as a read-only bind mount and the only environment entry is the *path* to that file, so
    the password itself is never readable in the host process table. The mount is `readonly`
    because a container that could rewrite its own credential could change what a later
    observation is checking.

    Creation and start are separate commands. `docker create` publishes nothing and runs
    nothing, so the pre-consumption listener observation still describes a host the attempt
    has not yet touched; the publication only exists once the start command is reached.
    """
    return {
        "docker:create_network": (
            DOCKER_EXECUTABLE,
            "network",
            "create",
            "--internal",
            network_name,
        ),
        "docker:create_volume": (DOCKER_EXECUTABLE, "volume", "create", volume_name),
        "docker:create_container": (
            DOCKER_EXECUTABLE,
            "create",
            "--name",
            container_name,
            f"--pull={PULL_POLICY}",
            "--network",
            network_name,
            "--publish",
            PUBLISH_SPEC,
            "--volume",
            f"{volume_name}:{DATA_DIRECTORY}",
            "--mount",
            (
                f"type=bind,src={credential_path},"
                f"dst={CONTAINER_CREDENTIAL_PATH},readonly"
            ),
            "--env",
            f"{CREDENTIAL_ENVIRONMENT_KEY}={CONTAINER_CREDENTIAL_PATH}",
            "--health-cmd",
            HEALTH_COMMAND,
            "--label",
            f"{ATTEMPT_LABEL_KEY}={attempt_id}",
            image_reference,
        ),
        "docker:start_container": (DOCKER_EXECUTABLE, "start", container_name),
    }


def observation_commands(
    *, container_name: str, network_name: str
) -> dict[str, tuple[str, ...]]:
    """The post-creation projections. Every entry reads; none creates or mutates."""
    return {
        "docker:health": (
            DOCKER_EXECUTABLE,
            "inspect",
            "--type",
            "container",
            "--format",
            HEALTH_PROJECTION,
            container_name,
        ),
        "docker:container": (
            DOCKER_EXECUTABLE,
            "inspect",
            "--type",
            "container",
            "--format",
            JSON_PROJECTION,
            container_name,
        ),
        "docker:event": (
            DOCKER_EXECUTABLE,
            "events",
            "--since",
            EVENT_WINDOW,
            "--until",
            EVENT_UNTIL,
            "--filter",
            f"container={container_name}",
            "--filter",
            "event=start",
            "--format",
            EVENT_PROJECTION,
        ),
        "docker:port": (
            DOCKER_EXECUTABLE,
            "port",
            container_name,
            CONTAINER_PORT_KEY,
        ),
        "docker:network": (
            DOCKER_EXECUTABLE,
            "network",
            "inspect",
            "--format",
            JSON_PROJECTION,
            network_name,
        ),
    }


def teardown_command_table(
    *, container_name: str, network_name: str, volume_name: str
) -> dict[str, tuple[str, ...]]:
    """Removal in the mandatory order, plus the residual re-observation."""
    return {
        "docker:remove_container": (
            DOCKER_EXECUTABLE,
            "rm",
            "--force",
            container_name,
        ),
        "docker:remove_network": (DOCKER_EXECUTABLE, "network", "rm", network_name),
        "docker:remove_volume": (DOCKER_EXECUTABLE, "volume", "rm", volume_name),
        "docker:residual": (
            DOCKER_EXECUTABLE,
            "ps",
            "--all",
            "--filter",
            f"name={container_name}",
            "--format",
            NAME_PROJECTION,
        ),
    }


def build_plan(
    *,
    attempt_id: str,
    image_reference: str,
    repository_roots: Mapping[str, str],
) -> TopologyPlan:
    """The one immutable command plan for one bounded attempt.

    The image reference must be digest-pinned. A tag is a moving target: an attempt that
    named one could consume different bytes than the reviewed selection without any argv
    changing.
    """
    attempt = exact_token(attempt_id, label="attempt_id")
    image = exact_token(image_reference, label="image_reference")
    if DIGEST_MARKER not in image:
        raise ValueError("image_reference: the reviewed image must be digest-pinned")

    container_name = f"{RESOURCE_PREFIX}-{attempt}"
    network_name = f"{RESOURCE_PREFIX}-{NETWORK_INFIX}-{attempt}"
    volume_name = f"{RESOURCE_PREFIX}-{VOLUME_INFIX}-{attempt}"
    credential_name = f"{RESOURCE_PREFIX}-{CREDENTIAL_INFIX}-{attempt}"
    # Derived, never injected: the mounted path and the path the credential adapter creates
    # are the same expression, so a bind mount cannot name a file the attempt never wrote.
    credential_path = (
        f"{CREDENTIAL_DIRECTORY}/{credential_name}{CREDENTIAL_SUFFIX}"
    )

    host_probe = (PROBE_EXECUTABLE_PATH, *PROBE_ARGV)
    commands: dict[str, tuple[str, ...]] = {
        **control_commands(repository_roots),
        **precondition_commands(
            image_reference=image,
            suite_root=repository_roots[SUITE_REPOSITORY],
        ),
        "probe:host": host_probe,
        **creation_commands(
            attempt_id=attempt,
            image_reference=image,
            container_name=container_name,
            network_name=network_name,
            volume_name=volume_name,
            credential_path=credential_path,
        ),
        **observation_commands(
            container_name=container_name, network_name=network_name
        ),
        **teardown_command_table(
            container_name=container_name,
            network_name=network_name,
            volume_name=volume_name,
        ),
    }
    for name, command in commands.items():
        for position, argument in enumerate(command):
            exact_token(argument, label=f"{name}[{position}]")

    return TopologyPlan(
        attempt_id=attempt,
        image_reference=image,
        container_name=container_name,
        network_name=network_name,
        volume_name=volume_name,
        credential_name=credential_name,
        credential_path=credential_path,
        host_ip=HOST_IP,
        host_port=HOST_PORT,
        container_port=CONTAINER_PORT,
        container_port_key=CONTAINER_PORT_KEY,
        publish_spec=PUBLISH_SPEC,
        probe_executable_path=PROBE_EXECUTABLE_PATH,
        commands=MappingProxyType(dict(commands)),
        create_commands=(
            commands["docker:create_network"],
            commands["docker:create_volume"],
            commands["docker:create_container"],
            commands["docker:start_container"],
        ),
        observe_commands=(
            commands["docker:health"],
            commands["docker:container"],
            commands["docker:event"],
            commands["docker:port"],
            commands["docker:network"],
            commands["host:listeners"],
            host_probe,
        ),
        teardown_commands=(
            commands["docker:remove_container"],
            commands["docker:remove_network"],
            commands["docker:remove_volume"],
        ),
        host_probe=host_probe,
    )
