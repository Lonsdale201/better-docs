---
title: better-route Documentation
sidebar_position: 1
---

`better-route` is a Composer-first WordPress REST contract layer for teams that need stable, versioned APIs.

## Status

- Baseline documentation target: `v1.0.0`
- Latest release: [`v1.0.0`](release-notes/v1.0.0)
- Previous release: [`v0.6.0`](release-notes/v0.6.0)
- Packagist: published — `composer require better-route/better-route:^1.0`

## What you get

- Fluent router on top of `register_rest_route()`, with explicit `OPTIONS` route support for preflight
- Middleware pipeline with deterministic order: `global -> group -> route`
- Resource DSL for CPT and custom table endpoints, with write-validation schemas, field-level policies, and `ResourcePolicy` / `OwnedResourcePolicy` presets
- Strict query contract (`unknown params => 400`)
- Unified error envelope with `requestId` (no internal exception leakage on 5xx), plus opt-in OAuth RFC 6749 error format per route *(v0.6.0)*
- Built-in auth, write-safety, and observability middleware
- Identity primitives *(v0.6.0)*: `Rs256JwksJwtVerifier` for OIDC providers (RS256/ES256), `HmacSignatureMiddleware` for signed webhooks, `SingleUseTokenMiddleware` for OAuth codes / magic links, `Crypto` helper for tokens and constant-time compare
- Network primitives *(v0.6.0)*: `TrustedProxyClientIpResolver` and `IpAllowlistMiddleware` with IPv4/IPv6 CIDR matching
- Public-client primitives *(v0.5.0)*: `CorsMiddleware` / `CorsPolicy`, `AtomicIdempotencyMiddleware` with `wpdb` reservation store, `OwnershipGuardMiddleware`, and `AuditEnricherMiddleware`
- OpenAPI MVP exporter with security scheme support, `strictSchemas` mode, and optional `openapi.json` endpoint (admin-only by default)
- WooCommerce integration: Orders, Products, Customers, Coupons with full CRUD, query parsing, HPOS guard, capability-checked writes, protected meta keys, configurable `deleteMode`, and pre-built OpenAPI component schemas

## Who this is for

- WordPress teams building headless APIs
- Plugin/app teams that want contract-first endpoints
- Integrations where schema, error shape, and policy behavior must stay predictable
- Teams wrapping OIDC or OAuth providers, signed webhook callers, or partner integrations with strict network boundaries
- WooCommerce stores that need a typed, middleware-aware REST layer over core WC data

## What this is not

- Not a UI plugin with admin pages
- Not a no-code endpoint builder
- Not a WooCommerce replacement — it exposes WC data through a stricter contract
- Not a token issuer / refresh-token rotator / login flow — `better-route` verifies credentials supplied by another layer

## Documentation map

Start with:

1. `Getting Started` for install + first route/resource
2. `Core` for router, middleware lifecycle, error contract
3. `Resources` for CPT/table DSL and query safety
4. `Auth` for JWT (HS256 + JWKS), HMAC signatures, application passwords, cookie/nonce, bearer token, ownership guard
5. `Write Safety` for idempotency (replay + atomic), single-use tokens, and optimistic locking
6. `Network` for trusted-proxy IP resolution and CIDR allowlists
7. `Public-Client APIs` for CORS, preflight, and the OAuth error format
8. `Support` for shared crypto utilities
9. `WooCommerce` for orders, products, customers, coupons integration
10. `OpenAPI` for schema export, security schemes, and endpoint publishing
11. `Reference` for API tables and middleware catalog
12. `AI Agent Skills` for structured skills an AI agent can use to work with the library
13. `Release Notes` for what changed in each version
