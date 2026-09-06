# CYBRIK Go Client SDK (`cybrik-sdk-go`)

Official Go client library for the CYBRIK Autonomous Cyber Defense Platform.

## Features

- **Typed Domain Models**: Strongly typed platform data structures with JSON tags (`Alert`, `Case`, `ContainmentAction`, `Receipt`, `HealthStatus`).
- **Resilient HTTP Client**: Circuit-breaker protected client with support for Bearer and API-Key authentication.
- **Fail-Fast Circuit Breaker**: Thread-safe `sync.RWMutex`-backed circuit breaker (`Closed`, `Open`, `HalfOpen`) isolating downstream outages.
- **Functional Options**: Composable query filters, pagination, and header overrides.

## Installation

```bash
go get github.com/hoangclinh/cybrik-suite/packages/cybrik-sdk-go
```

## Quickstart

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/hoangclinh/cybrik-suite/packages/cybrik-sdk-go/client"
)

func main() {
	c, err := client.New(client.Config{
		BaseURL:     "https://api.cybrik.example",
		BearerToken: "your-access-token",
		Timeout:     10 * time.Second,
	})
	if err != nil {
		log.Fatalf("failed to create client: %v", err)
	}

	ctx := context.Background()

	// Fetch health
	health, err := c.Health(ctx)
	if err != nil {
		log.Fatalf("health check failed: %v", err)
	}
	fmt.Printf("Platform Status: %s (version %s)\n", health.Status, health.Version)

	// List active critical alerts
	alerts, err := c.ListAlerts(ctx, client.WithStatus("open"), client.WithSeverity("CRITICAL"), client.WithLimit(10))
	if err != nil {
		log.Fatalf("failed to list alerts: %v", err)
	}
	for _, alert := range alerts {
		fmt.Printf("[%s] %s (%s)\n", alert.Severity, alert.Title, alert.ID)
	}
}
```
