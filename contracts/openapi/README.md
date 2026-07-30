# contracts/openapi

Status: `PROPOSED` packet present — **NOT ACCEPTED**. Format pin: OpenAPI 3.1.x (ADR-0001 D4).

REST API contracts. `cybrik-fabric-control-plane.v1.openapi.yaml` binds the packet's shared
schemas onto REST resources as **mapping notes** (statused `PROPOSED — NOT ACCEPTED`, version
0.1.0). Deliberately **no `servers` block**: no operational endpoints, hostnames, or secrets are
declared — this packet binds shapes to verbs, it does not decide a deployment. Moving out of
`PROPOSED` requires explicit Founder approval.
