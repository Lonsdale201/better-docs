---
title: Public-Client APIs
---

`better-route` 0.5.0 introduced a set of primitives for **public-client** and **account-style** APIs — APIs called from a browser SPA, a mobile app, or a partner webview. These callers behave differently from a server-to-server integration:

- they retry aggressively on flaky networks (idempotency must block concurrent execution, not just replay responses);
- they speak CORS (the WP REST defaults are not enough);
- they only see their own data (ownership must be enforced explicitly, not by capability);
- they need correlated audit trails (request IDs, idempotency keys, auth provider/subject).

The pieces below are not tied to WooCommerce — they are general primitives for any account-owned REST surface.

## Building blocks

| Concern | Tool | Page |
|---|---|---|
| Browser/mobile origin contract | `CorsMiddleware`, `CorsPolicy`, `WordPressCorsBridge` *(v1.1.0)* | [CORS / preflight](cors) |
| Concurrent retries on side-effectful writes | `AtomicIdempotencyMiddleware` + atomic store | [Atomic idempotency](../write-safety/atomic-idempotency) |
| One-time grants (OAuth codes, magic links) *(v0.6.0)* | `SingleUseTokenMiddleware` + store | [Single-use tokens](../write-safety/single-use-tokens) |
| OAuth-shaped error responses *(v0.6.0)* | `OAuthErrorNormalizer` (route metadata opt-in) | [OAuth error format](oauth-error-format) |
| Customer-only access to their own row | `OwnershipGuardMiddleware`, `OwnedResourcePolicy` | [Ownership guards](../auth/ownership-guard) |
| Correlated audit events | `AuditEnricherMiddleware` + `AuditMiddleware` | [Audit](../observability/audit) |
| Header preservation when handlers return arrays | `RateLimitMiddleware` (auto-wrap) | [Middleware Catalog](../reference/middleware-catalog) |

## Recommended pipeline order

For a typical authenticated public-client write route:

```php
$router->middleware([
    new CorsMiddleware($corsPolicy),
    new RateLimitMiddleware($limiter, limit: 60, windowSeconds: 60),
    new MetricsMiddleware($metricSink),
    new AuditEnricherMiddleware(['resource' => 'account']),
    new AuditMiddleware($logger),
]);

$router->group('/account', function (Router $r) use ($jwt, $idempotencyStore): void {
    $r->middleware([$jwt]);

    // (v1.1.0) No explicit OPTIONS route needed: with CorsMiddleware attached,
    // the WordPress CORS bridge answers preflight before dispatch.

    $r->get('/orders/(?P<id>\d+)', $showOrder)
        ->middleware([
            new OwnershipGuardMiddleware(
                ownerResolver: fn ($ctx) => resolve_order_owner_id($ctx->request),
                bypassCapability: 'manage_woocommerce'
            ),
        ])
        ->protectedByMiddleware('bearerAuth');

    $r->post('/orders/(?P<id>\d+)/cancel', $cancelOrder)
        ->middleware([
            new OwnershipGuardMiddleware(
                ownerResolver: fn ($ctx) => resolve_order_owner_id($ctx->request)
            ),
            new AtomicIdempotencyMiddleware($idempotencyStore, ttlSeconds: 900, requireKey: true),
        ])
        ->protectedByMiddleware('bearerAuth');
});
```

Order matters. CORS must run first so preflight can short-circuit before auth or rate limit. Auth must run before ownership and idempotency so the key resolver sees the auth context. Audit enricher must run before `AuditMiddleware` so the merged `audit` attribute is in place when the event is emitted.

## v1.1.0 hardening

- **Preflight before dispatch.** `CorsMiddleware` registers the [WordPress CORS bridge](cors) for every route it is attached to when `Router::register()` runs. Allowed *and* denied preflight is answered on `rest_pre_dispatch` — before WordPress evaluates the route's `permission_callback` — and WordPress core CORS headers are replaced for matched routes, so the configured allowlist stays authoritative. An explicit `Router::options()` preflight route is no longer required; if you do register one (custom preflight logic), remember that `OPTIONS` routes now deny by default like every other method.
- **Rate limiting cannot silently race.** `WpObjectCacheRateLimiter` requires a persistent external object cache with atomic `wp_cache_incr()`; `TransientRateLimiter` updates its counter under a MySQL advisory lock in its default WordPress configuration. `429` responses include `Retry-After` and `X-RateLimit-*` headers.
- **Conditional reads are REST-faithful.** `ETagMiddleware` preserves WordPress REST status/data/headers, supports weak validators and `If-None-Match` lists, and produces correct `304` responses; `CachingMiddleware` never stores `WP_Error` or non-2xx responses.

## What 0.5.0 explicitly does not handle

- **Token issuance / refresh / login.** Auth middlewares verify credentials supplied by another layer (a JWT issuer, an OAuth provider, WP cookies). 0.5.0 does not add a login endpoint or refresh-token rotation.
- **WooCommerce customer-facing APIs.** The Woo registrar still produces admin/integration CRUD routes. For a customer-facing surface, use raw `Router` routes with the building blocks above and read from the WC data layer directly.
- **CSRF tokens for cookie-auth public clients.** Cookie auth still uses `X-WP-Nonce`. CORS exposes that header but does not generate it.
