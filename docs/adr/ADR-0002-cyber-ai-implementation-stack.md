# ADR-0002 — Cyber AI implementation stack

- Status: `PROPOSED — NOT DECIDED`
- Date raised: 2026-07-23
- Decider: Founder
- Scope: `cybrik-cyber-ai-platform` (language, framework, storage, agent tooling)

## Context

`cybrik-cyber-ai-platform` is a documentation-only scaffold. No language, framework,
database, or agent library has been chosen. Its responsibilities (model runtime abstraction,
model/prompt registry, RAG/CTI pipelines, durable agent orchestration, Investigation
Graph/Bundle, evaluation) constrain the choice.

## Decision needed

1. Primary implementation language(s) and service framework.
2. Storage: relational store, vector store, graph store (Investigation Graph) — one engine or
   several.
3. Local model runtime abstraction target(s) and how remote/API models fit behind the same
   abstraction.
4. Agent framework: build on an existing SDK vs. thin in-house orchestration layer (interacts
   with ADR-0003).
5. Alignment with the SOC stack where sharing operational knowledge reduces solo-founder
   burden.

## Options to evaluate (no selection made)

To be enumerated with evidence (benchmarks, ecosystem maturity, security posture, license
compatibility) before any choice. This brief intentionally names no candidates as decisions.

## Consequences to evaluate

Hiring/operability for a solo founder, evaluation harness compatibility, on-prem/sovereign
deployment constraints from the strategy documents, supply-chain/SBOM obligations (CRA).
