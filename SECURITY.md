# SECURITY.md — cybrik-suite

Status: `SCAFFOLD` / placeholder.

## Prohibited content

The following must never be committed to this repository:

- secrets of any kind: `.env` files (except `.env.example`), API keys, tokens, passwords,
  private keys, certificate private material;
- customer or production data: logs, database dumps, PCAPs, telemetry containing real
  identifiers;
- malware samples or live exploit payloads;
- model weights or other large binary artifacts.

If any such content is found in history, treat it as an incident: stop, notify the Founder,
and rotate any exposed credential. Do not attempt history rewrites without approval.

## Responsible disclosure (placeholder)

A formal disclosure policy has not been established. Until then, report suspected
vulnerabilities in any CYBRIK Suite component directly to the Founder (repository owner).
Do not open public issues for security matters. This section must be replaced with a real
policy (contact channel, SLA, safe-harbor statement) before any external release.
