---
title: Middleware Catalog
---

## Auth

- `JwtAuthMiddleware` — HS256 / asymmetric JWT verification through any `JwtVerifierInterface`; *(v1.0.0)* `allowGrantedScopeWildcards` (default false) opts into trailing-`*` wildcards on granted scopes (required-scope wildcards are unaffected)
- `Rs256JwksJwtVerifier` *(v0.6.0)* — RS256 / ES256 verifier backed by JWKS; pairs with `HttpJwksProvider` / `StaticJwksProvider`
- `BearerTokenAuthMiddleware` — *(v1.0.0)* same `allowGrantedScopeWildcards` opt-in as `JwtAuthMiddleware`
- `HmacSignatureMiddleware` *(v0.6.0)* — HMAC request signatures with replay window; pairs with `HmacSecretProviderInterface` / `ArrayHmacSecretProvider`; *(v1.0.0)* `signQueryString` (default false) also signs the canonical query string
- `CookieNonceAuthMiddleware`
- `ApplicationPasswordAuthMiddleware`
- `WpClaimsUserMapper` — *(v1.0.0)* `email`/`login` claim mapping is off by default; email mapping requires an `email_verified` claim (`requireEmailVerified`, default true)
- `OwnershipGuardMiddleware` *(v0.5.0)* — route-level "current user owns this resource" guard; pairs with `OwnedResourcePolicy::currentUserOwns()` for Resource DSL

## Write safety

- `IdempotencyMiddleware` — response-replay cache (handler runs, then store writes)
- `TransientIdempotencyStore`
- `WpdbIdempotencyStore` *(v0.3.0)* — `wpdb`-backed replay store; call `installSchema()` once on activation
- `AtomicIdempotencyMiddleware` *(v0.5.0)* — reserves the key **before** handler execution; blocks concurrent retries with `409 idempotency_in_progress`
- `AtomicIdempotencyStoreInterface` *(v0.5.0)* — store contract (`reserve` / `complete` / `release`)
- `ArrayAtomicIdempotencyStore` *(v0.5.0)* — in-memory store for tests / non-production
- `WpdbAtomicIdempotencyStore` *(v0.5.0)* — `wpdb` `INSERT IGNORE` reservation store; dedicated table, `installSchema()` once on activation
- `SingleUseTokenMiddleware` *(v0.6.0)* — atomic one-time token consumption (OAuth codes, magic links, password resets)
- `SingleUseTokenStoreInterface` *(v0.6.0)* — store contract (`consume` / `store` / `wasConsumed`)
- `ArraySingleUseTokenStore` *(v0.6.0)* — in-memory store for tests
- `WpdbSingleUseTokenStore` *(v0.6.0)* — `wpdb`-backed token store with TTL pruning; `installSchema()` once on activation
- `WpCacheSingleUseTokenStore` *(v0.6.0)* — object-cache lock + transient-backed records; *(v1.0.0)* requires a persistent object cache (throws otherwise) — use `WpdbSingleUseTokenStore` on default hosting
- `OptimisticLockMiddleware` — *(v1.0.0)* a missing precondition returns `428 precondition_required` (was `412`)
- `CallbackOptimisticLockVersionResolver`

## Public-client / CORS *(v0.5.0)*

- `BetterRoute\Middleware\Cors\CorsMiddleware` — applies a `CorsPolicy`, short-circuits preflight `OPTIONS` with `204`
- `BetterRoute\Middleware\Cors\CorsPolicy` — origin allowlist, methods/headers/exposed-headers, credentials, max age
- `Router::options()` — register explicit preflight routes; `OPTIONS` permissions are public-by-default

## Network *(v0.6.0)*

- `BetterRoute\Middleware\Network\TrustedProxyClientIpResolver` — trusted-proxy aware client IP resolution; implements `ClientIpResolverInterface`
- `BetterRoute\Middleware\Network\ClientIpResolverInterface` — minimal `resolve(?mixed $request = null): ?string` contract
- `BetterRoute\Middleware\Network\IpAllowlistMiddleware` — denies requests outside an IPv4/IPv6 CIDR allowlist
- `BetterRoute\Middleware\Network\CidrMatcher` — IPv4/IPv6 aware CIDR / single-host matcher

## Rate limiting

- `RateLimitMiddleware` — *(v0.6.0)* `clientIpResolver` now accepts either `Http\ClientIpResolver` or `Middleware\Network\ClientIpResolverInterface`
- `TransientRateLimiter`
- `WpObjectCacheRateLimiter` *(v0.3.0)* — uses the WP object cache; throws `RuntimeException` if `wp_cache_*` is unavailable

## Caching

- `CachingMiddleware`
- `TransientCacheStore`
- `ETagMiddleware` *(v0.3.0)* — emits `ETag` headers and replies `304 Not Modified` on `If-None-Match` matches (GET/HEAD only)

## HTTP infrastructure

- `BetterRoute\Http\ClientIpResolver` — kept stable since v0.3.0; *(v0.6.0)* now delegates internally to `TrustedProxyClientIpResolver`. Constructor and `resolve(?array $server = null)` API unchanged. New code should prefer `TrustedProxyClientIpResolver` directly.
- `BetterRoute\Http\OAuthErrorNormalizer` *(v0.6.0)* — emits OAuth RFC 6749 style error bodies when a route opts in via `meta(['error_format' => 'oauth_rfc6749'])`. See [OAuth Error Format](../public-client/oauth-error-format).

## Support utilities *(v0.6.0)*

- `BetterRoute\Support\Crypto` — CSPRNG token generation, hex/base64/base64url encoding, strict base64url decoding, constant-time compare. See [Crypto Utilities](../support/crypto).
- `BetterRoute\Support\CryptoEncoding` — enum (`Hex`, `Base64`, `Base64Url`).

## Observability

- `AuditMiddleware` — *(v0.5.0)* now merges `RequestContext::$attributes['audit']` into emitted events
- `AuditEnricherMiddleware` *(v0.5.0)* — adds auth provider/user/subject, hashed idempotency key, optional client IP, and static fields to the `audit` attribute
- `ErrorLogAuditLogger`
- `MetricsMiddleware`
- `InMemoryMetricSink`
- `PrometheusMetricSink`
- `AuditEventFactory`

## Typical global stack

```php
$router->middleware([
    new MetricsMiddleware(new PrometheusMetricSink()),
    new AuditMiddleware(new ErrorLogAuditLogger()),
    new RateLimitMiddleware(new TransientRateLimiter(), limit: 100, windowSeconds: 60),
]);
```

Order recommendation:

1. CORS (preflight short-circuit before anything else)
2. IP allowlist (drop unauthorized networks early)
3. Metrics/Audit (outer visibility)
4. Rate limit
5. Auth (JWT, HMAC, cookie/nonce, application password)
6. Ownership / single-use token / cache / idempotency / optimistic lock
7. business handler

## Default keys (v0.3.0)

`CachingMiddleware`, `IdempotencyMiddleware`, and `RateLimitMiddleware` derive default keys from request identity:

- `auth.userId > 0` → `"{provider}:user:{userId}"`
- `auth.subject` (non-empty) → `"{provider}:sub:{subject}"`
- `RateLimitMiddleware` only: client IP fallback → `"ip:{clientIp}"`
- otherwise → `"guest"`

If you previously relied on the v0.2.0 route-only defaults, expect a one-time cache miss after upgrade. Pass an explicit `keyResolver` to keep keys stable.
