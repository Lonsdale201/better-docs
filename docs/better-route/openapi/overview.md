---
title: OpenAPI Overview
---

OpenAPI support is metadata-driven. Since `v0.2.0` it includes security scheme support and pre-built WooCommerce domain schemas.

## What is available

- contract aggregation from Router/Resource
- OpenAPI 3.1.0 document export
- optional runtime endpoint: `/openapi.json`

## Metadata fields used

- `operationId`
- `tags`
- `scopes`
- `parameters`
- `requestSchema`
- `responseSchema`
- `responses`
- `openapi.include`

`openapi.include=false` routes are excluded by default.

## What is not available yet

- full automatic schema inference from arbitrary PHP runtime types
- advanced polymorphism/discriminator generation

## What is new in v1.1.0

- Executable route `args` are exported automatically as `path`/`query` parameters (type, `default`, `enum`, `format`, `minimum`/`maximum`, `minLength`/`maxLength`, `pattern`, and `description` are carried over). List filters and pagination params no longer need a duplicate `meta.parameters` declaration.
- Explicit `meta.parameters` entries override a derived parameter with the same `name` and `in` location; derived parameters without an explicit counterpart are kept.
- `OPTIONS` operations are documented with a `204` success response (no content).
- Custom `meta.responses` entries now **replace** the generated defaults for the same status code (previously the defaults won), so a route can override the success response or the `default` error reference.

## What is new in v0.2.0

- Security scheme support: Bearer, Basic Auth, API Key, OAuth2, Cookie
- Global and per-route security requirements
- Pre-built WooCommerce domain schemas via `BetterRoute::wooOpenApiComponents()` (see WooCommerce > OpenAPI Components)

## What is new in v0.4.0

- Per-operation `security: []` overrides `globalSecurity`. Setting `security` to an empty array on an operation drops it from the document's global security requirement (useful for public health checks, webhooks, or auth endpoints inside an otherwise authenticated API).
- `RouteBuilder::publicRoute()` automatically writes `security: []` to the operation meta, so a route that opts out of WP auth also opts out of OpenAPI's global security.
- `RouteBuilder::protectedByMiddleware($security)` propagates the supplied security scheme (string or array) into the operation meta when present.

## What is new in v0.3.0

- `strictSchemas => true` exporter option — throws `InvalidArgumentException` on `$ref` to an unknown component instead of substituting a permissive placeholder
- `OpenApiRouteRegistrar::register()` defaults to `current_user_can('manage_options')` — pass `permissionCallback` to override

## Validation checklist

- every documented endpoint has stable `operationId`
- schemas referenced by `$ref` exist in components
- intentionally internal routes set `openapi.include=false`
