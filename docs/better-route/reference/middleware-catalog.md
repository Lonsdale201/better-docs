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
- `AtomicIdempotencyMiddleware` *(v0.5.0)* — reserves the key **before** handler execution; blocks concurrent retries with `409 idempotency_in_progress`; *(v1.1.0)* keys are bounded/validated (`400 idempotency_key_invalid`), request fingerprints are deep-canonical, stored responses are serialized data-only via `StoredResponseCodec`, and a failed request stays reserved until its TTL expires by default (`releaseOnThrowable: true` opts into releasing the reservation on error; `maxKeyLength` defaults to 200)
- `AtomicIdempotencyStoreInterface` *(v0.5.0)* — store contract (`reserve` / `complete` / `release`)
- `LeaseAwareAtomicIdempotencyStoreInterface` *(v1.1.0)* — extends reservations with an unforgeable per-reservation lease token so only the reserving request can complete/release
- `StoredResponseCodec` *(v1.1.0)* — data-only replay-response serialization; never unserializes arbitrary classes
- `ArrayAtomicIdempotencyStore` *(v0.5.0)* — in-memory store, **tests only** *(v1.1.0)*
- `WpdbAtomicIdempotencyStore` *(v0.5.0)* — `wpdb` `INSERT IGNORE` reservation store; dedicated table, `installSchema()` once on activation; *(v1.1.0)* lease-aware, and `installSchema()` also migrates older tables
- `SingleUseTokenMiddleware` *(v0.6.0)* — atomic one-time token consumption (OAuth codes, magic links, password resets)
- `SingleUseTokenStoreInterface` *(v0.6.0)* — store contract (`consume` / `store` / `wasConsumed`)
- `ArraySingleUseTokenStore` *(v0.6.0)* — in-memory store for tests
- `WpdbSingleUseTokenStore` *(v0.6.0)* — `wpdb`-backed token store with TTL pruning; `installSchema()` once on activation
- `WpCacheSingleUseTokenStore` *(v0.6.0)* — object-cache lock + transient-backed records; *(v1.0.0)* requires a persistent object cache (throws otherwise) — use `WpdbSingleUseTokenStore` on default hosting
- `OptimisticLockMiddleware` — *(v1.0.0)* a missing precondition returns `428 precondition_required` (was `412`); *(v1.1.0)* version resolution + write run inside a critical section so cooperating Better Route writers cannot race between the version check and the write
- `CallbackOptimisticLockVersionResolver`
- `OptimisticLockCriticalSectionInterface` *(v1.1.0)* — critical-section contract for the optimistic-lock write window
- `WpdbOptimisticLockCriticalSection` *(v1.1.0)* — default WordPress implementation; per-resource MySQL advisory lock (`GET_LOCK`)
- `CallbackOptimisticLockCriticalSection` *(v1.1.0)* — wrap a custom locking scheme (or pass-through for single-writer setups)

## Public-client / CORS *(v0.5.0)*

- `BetterRoute\Middleware\Cors\CorsMiddleware` — applies a `CorsPolicy`, short-circuits preflight `OPTIONS` with `204`; *(v1.1.0)* implements `WordPressRouteMiddlewareInterface`, so `Router::register()` installs the WordPress CORS bridge for every route it is attached to; origins, methods, and header names are validated against response-header injection
- `BetterRoute\Middleware\Cors\CorsPolicy` — origin allowlist, methods/headers/exposed-headers, credentials, max age
- `BetterRoute\Middleware\Cors\WordPressCorsBridge` *(v1.1.0)* — installed automatically when `CorsMiddleware` is attached; handles allowed/denied preflight on `rest_pre_dispatch` (priority 9) before WordPress dispatches the route, and replaces WordPress core CORS headers on `rest_pre_serve_request` (priority 20) so the configured allowlist stays authoritative for matched routes
- `BetterRoute\Middleware\WordPressRouteMiddlewareInterface` *(v1.1.0)* — implemented by middleware that needs a WordPress-level hook per registered route (`registerWordPressRoute($namespace, $route)`)
- `Router::options()` — register explicit preflight routes when you need a custom preflight handler; *(v1.1.0)* no longer required for CORS (the bridge answers preflight), and `OPTIONS` routes now deny by default like every other method — declare intent explicitly

## Network *(v0.6.0)*

- `BetterRoute\Middleware\Network\TrustedProxyClientIpResolver` — trusted-proxy aware client IP resolution; implements `ClientIpResolverInterface`
- `BetterRoute\Middleware\Network\ClientIpResolverInterface` — minimal `resolve(?mixed $request = null): ?string` contract
- `BetterRoute\Middleware\Network\IpAllowlistMiddleware` — denies requests outside an IPv4/IPv6 CIDR allowlist
- `BetterRoute\Middleware\Network\CidrMatcher` — IPv4/IPv6 aware CIDR / single-host matcher

## Rate limiting

- `RateLimitMiddleware` — *(v0.6.0)* `clientIpResolver` now accepts either `Http\ClientIpResolver` or `Middleware\Network\ClientIpResolverInterface`; *(v1.1.0)* `429` responses carry `Retry-After` and `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` headers; `limit`/`windowSeconds` below 1 throw
- `TransientRateLimiter` — *(v1.1.0)* in its default WordPress-transient configuration the counter update runs under a MySQL advisory lock (`GET_LOCK`), so concurrent hits cannot lose increments; custom `getTransient`/`setTransient` callables accept an optional `synchronize` callable for the same guarantee
- `WpObjectCacheRateLimiter` *(v0.3.0)* — uses the WP object cache; throws `RuntimeException` if `wp_cache_*` is unavailable; *(v1.1.0)* requires a **persistent external** object cache with atomic `wp_cache_incr()` and throws instead of silently degrading to a racy read/modify/write

## Caching

- `CachingMiddleware` — *(v1.1.0)* only 2xx responses are cached; `WP_Error` and error statuses are never stored; cache keys use the canonical request identity (see below)
- `TransientCacheStore`
- `ETagMiddleware` *(v0.3.0)* — emits `ETag` headers and replies `304 Not Modified` on `If-None-Match` matches (GET/HEAD only); *(v1.1.0)* preserves WordPress REST status/data/headers (sets the header on a `WP_REST_Response` instead of unwrapping it), passes `WP_Error` through untouched, supports weak validators and `If-None-Match` lists (weak comparison per RFC 9110), and sanitizes custom resolver tags against header injection

## HTTP infrastructure

- `BetterRoute\Http\ClientIpResolver` — kept stable since v0.3.0; *(v0.6.0)* now delegates internally to `TrustedProxyClientIpResolver`. Constructor and `resolve(?array $server = null)` API unchanged. New code should prefer `TrustedProxyClientIpResolver` directly.
- `BetterRoute\Http\OAuthErrorNormalizer` *(v0.6.0)* — emits OAuth RFC 6749 style error bodies when a route opts in via `meta(['error_format' => 'oauth_rfc6749'])`. See [OAuth Error Format](../public-client/oauth-error-format).

## Support utilities *(v0.6.0)*

- `BetterRoute\Support\Crypto` — CSPRNG token generation, hex/base64/base64url encoding, strict base64url decoding, constant-time compare. See [Crypto Utilities](../support/crypto).
- `BetterRoute\Support\CryptoEncoding` — enum (`Hex`, `Base64`, `Base64Url`).
- `BetterRoute\Support\Canonicalizer` *(v1.1.0)* — deterministic deep-canonical JSON encoding; used for cache/idempotency/rate-limit keys and request fingerprints.
- `BetterRoute\Support\RequestIdentity` *(v1.1.0)* — shared identity-key derivation for the keyed middlewares (see "Default keys" below).
- `BetterRoute\Support\RestRequestParameters` *(v1.1.0)* — allowlists the WordPress global REST query parameters (`_locale`, `_fields`, `_embed`, `_envelope`, `_jsonp`) next to endpoint parameters in strict list-query parsing, so they no longer trip `400 validation_failed`.

## Observability

- `AuditMiddleware` — *(v0.5.0)* now merges `RequestContext::$attributes['audit']` into emitted events
- `AuditEnricherMiddleware` *(v0.5.0)* — adds auth provider/user/subject, hashed idempotency key, optional client IP, and static fields to the `audit` attribute
- `ErrorLogAuditLogger`
- `MetricsMiddleware` — *(v1.1.0)* sink failures are swallowed so telemetry can never mask the application result; the metric prefix is validated as a Prometheus name prefix
- `InMemoryMetricSink` — process/request-local; export or replace with a persistent backend for cross-request totals
- `PrometheusMetricSink` — process/request-local collector (same caveat)
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

## Default keys (v0.3.0, revised v1.1.0)

`CachingMiddleware`, `IdempotencyMiddleware`, and `RateLimitMiddleware` derive default keys from request identity. Since v1.1.0 the identity comes from `Support\RequestIdentity` and falls through in this order:

1. `auth.userId > 0` → hashed `identity:{sha256}` key for `provider:user:{userId}`
2. `auth.subject` (non-empty) → hashed key for `provider:subject:{subject}`
3. *(v1.1.0)* `attributes['userId']` or a logged-in WordPress user (`get_current_user_id()`) → hashed key for `wordpress:user:{id}` — a native WP identity now scopes keys even without an auth middleware attached
4. *(v1.1.0)* HMAC key id from `attributes['hmac']` → hashed key for `hmac:key:{keyId}`
5. `RateLimitMiddleware` only: client IP fallback → `"ip:{clientIp}"`
6. otherwise → `"guest"`

Composite keys are canonical-JSON encoded (`Support\Canonicalizer`), so key stability no longer depends on parameter order. Upgrading from any earlier version invalidates previously stored keys once — expect a one-time cache miss. Pass an explicit `keyResolver` to keep keys stable across upgrades.
