---
title: JWKS (RS256 / ES256)
---

`Rs256JwksJwtVerifier` *(v0.6.0)* verifies asymmetric JWTs (RS256 / ES256) using a JWKS document. Pair it with `BearerTokenAuthMiddleware` + `JwtBearerTokenVerifierAdapter` (or any other auth middleware that consumes a `JwtVerifierInterface`) to authenticate OIDC-style tokens issued by an external provider.

Use this verifier when:

- the issuer publishes a JWKS endpoint (most OIDC providers, Auth0, Keycloak, Cognito, Azure AD, …);
- tokens are signed with a private key the API never sees (asymmetric);
- key rotation must Just Work without a deploy.

For first-party JWTs signed with a shared secret, keep using [`Hs256JwtVerifier`](jwt-bearer).

## Minimal example with a remote JWKS

```php
use BetterRoute\Middleware\Jwt\HttpJwksProvider;
use BetterRoute\Middleware\Jwt\Rs256JwksJwtVerifier;

$jwks = new HttpJwksProvider(
    jwksUri: 'https://issuer.example.com/.well-known/jwks.json',
    ttlSeconds: 3600,
    issuer: 'https://issuer.example.com'
);

$verifier = new Rs256JwksJwtVerifier(
    jwks: $jwks,
    leewaySeconds: 60,
    expectedIssuer: 'https://issuer.example.com',
    expectedAudience: 'better-route',
    requireExpiration: true,
    maxLifetimeSeconds: 3600,
    maxTokenLength: 8192,
    allowedAlgorithms: ['RS256']
);
```

Plug the verifier into a `JwtAuthMiddleware`:

```php
use BetterRoute\Middleware\Jwt\JwtAuthMiddleware;
use BetterRoute\Middleware\Auth\WpClaimsUserMapper;

$jwt = new JwtAuthMiddleware(
    verifier: $verifier,
    requiredScopes: ['account:read'],
    userMapper: new WpClaimsUserMapper()
);
```

## Rs256JwksJwtVerifier constructor

```php
new Rs256JwksJwtVerifier(
    JwksProviderInterface $jwks,
    int $leewaySeconds = 60,
    ?callable $now = null,
    ?string $expectedIssuer = null,
    ?string $expectedAudience = null,
    bool $requireExpiration = true,
    ?int $maxLifetimeSeconds = null,
    int $maxTokenLength = 8192,
    array $allowedAlgorithms = ['RS256'],
    int $kidMissRefreshCooldownSeconds = 30 // v1.1.0
);
```

- `expectedIssuer` / `expectedAudience` — strict equality; `aud` may be a string or a list inside the token.
- `requireExpiration` — `true` by default. Tokens without `exp` are rejected.
- `maxLifetimeSeconds` — caps `exp - iat`. A misissued token with a 100-year lifetime is rejected before claims are trusted. *(v1.1.0)* When set, tokens must carry **both `iat` and `exp`**; a token without `iat` no longer bypasses the cap.
- `kidMissRefreshCooldownSeconds` *(v1.1.0)* — minimum seconds between unknown-`kid` triggered `refresh()` calls per verifier instance, so a flood of tokens with bogus `kid`s cannot hammer the JWKS endpoint. `0` disables the cooldown.
- `maxTokenLength` — guards against giant tokens before parsing.
- `allowedAlgorithms` — explicit list. `none` and any `HS*` value is rejected at construction even if accidentally configured. Currently supported: `RS256` and `ES256`.

## Hardening

The verifier deliberately refuses to be permissive:

- **Strict `kid` match.** Only keys whose `kid` matches the token header are considered. There is no "try every key" fallback.
- **One refresh, one retry.** If the `kid` is unknown, the JWKS provider is asked to `refresh()` and the lookup is retried once. Misses still fail closed. *(v1.1.0)* Unknown-`kid` refreshes are additionally rate-limited by `kidMissRefreshCooldownSeconds`, and `HttpJwksProvider` enforces its own persisted refresh cooldown on top.
- **Algorithm pinning.** `none` and `HS*` are rejected at construction. The token `alg` must match an entry in `allowedAlgorithms`.
- **Public-only JWK shape.** RSA keys must declare `kty=RSA` and carry `n` + `e`. ES256 keys must declare `kty=EC`, `crv=P-256`, and carry `x` + `y`. Optional `use` must be `sig`. Optional `alg` must match the token algorithm.
- **Private fields stripped.** `JwksKeySanitizer` filters JWKs through an explicit allowlist (`alg`, `crv`, `e`, `kid`, `kty`, `n`, `use`, `x`, `y`) before any provider hands them to the verifier — even if a misbehaving JWKS endpoint includes private components like `d`.
- **OpenSSL required.** Verification uses `openssl_verify`. The verifier throws if the OpenSSL extension is unavailable.

## Providers

### `HttpJwksProvider`

Fetches a remote JWKS through the WordPress HTTP API and caches it via transients.

```php
new HttpJwksProvider(
    string $jwksUri,
    int $ttlSeconds = 3600,
    ?string $cacheKey = null,
    ?string $issuer = null,
    ?callable $httpGet = null,
    ?callable $getTransient = null,
    ?callable $setTransient = null,
    ?callable $deleteTransient = null,
    int $minimumRefreshIntervalSeconds = 30, // v1.1.0
    ?callable $now = null                    // v1.1.0
);
```

- `jwksUri` **must** be `https`. *(v1.1.0)* Validation is stricter: the URI must parse with a host and must not embed `user:pass` credentials. The constructor throws otherwise.
- The default HTTP client uses `wp_safe_remote_get` with `sslverify => true` and a `10` second timeout. **Since 1.0.0** it also bounds redirects (`redirection => 1`) and caps `limit_response_size`: `wp_safe_remote_get` applies WordPress's SSRF protection (blocking internal/loopback hosts), and the bounds harden against a hostile or misbehaving issuer redirecting internally or returning an unbounded body. Non-200 responses, empty bodies, and `WP_Error` returns throw `RuntimeException`. *(v1.1.0)* `wp_safe_remote_get` is **required** — the previous fallback to plain `wp_remote_get` (no SSRF guard) was removed.
- The default cache key is `better_route_jwks_<sha1($jwksUri)>`. Pass `cacheKey` if you want a stable identifier across deploys.
- `issuer` is informational — used by the cache invalidation hook below.
- `minimumRefreshIntervalSeconds` *(v1.1.0)* — persisted cooldown between `refresh()` calls (default 30s). The cooldown is marked **before** the fetch, so failing fetches are throttled too, and it is shared across requests via a transient — a burst of unknown-`kid` tokens across PHP workers cannot stampede the issuer.

*(v1.1.0)* Refresh and cache-fill run under a MySQL advisory lock (`GET_LOCK`, 2s wait) when `$wpdb` is available, so concurrent requests do not fetch the same JWKS in parallel. If a refresh fetch fails, the provider **keeps the last known-good keys** (cached set stays intact) instead of serving an empty key set.

### `StaticJwksProvider`

In-memory provider for tests and pinned-key configurations:

```php
use BetterRoute\Middleware\Jwt\StaticJwksProvider;

$provider = new StaticJwksProvider([
    [
        'kid' => 'kid-1',
        'kty' => 'RSA',
        'n'   => '...base64url modulus...',
        'e'   => 'AQAB',
        'alg' => 'RS256',
        'use' => 'sig',
    ],
]);
```

Keys are sanitized at construction; private fields are dropped silently.

### Custom providers

Implement `BetterRoute\Middleware\Jwt\JwksProviderInterface`:

```php
interface JwksProviderInterface
{
    /** @return list<array<string, string>> */
    public function keys(): array;

    public function refresh(): void;
}
```

`refresh()` is invoked by the verifier on a `kid` miss. Make it idempotent and fast.

## Cache invalidation

`HttpJwksProvider` registers a WordPress action hook on construction:

```php
do_action('better_route/jwks_refresh');                              // refresh all
do_action('better_route/jwks_refresh', 'https://issuer.example.com'); // refresh that issuer only
```

When the provider was built with an `issuer`, the issuer-scoped variant only clears that provider. When called without an issuer, every registered provider clears its cache.

Trigger this from your auth provisioning flow when you rotate keys, or from a CLI/cron job after a webhook from the issuer.

*(v1.1.0)* The hook clears the cache **and** the refresh cooldown, so a deliberate rotation takes effect immediately. Direct `refresh()` calls, by contrast, respect `minimumRefreshIntervalSeconds` and become no-ops inside the cooldown window.

## Validation checklist

- a token with an unknown `kid` triggers a single JWKS refresh (subject to the v1.1.0 cooldowns), then `401 invalid_token`;
- a token signed with a key whose `use !== 'sig'` is rejected;
- `none` / `HS*` configured in `allowedAlgorithms` throws at construction;
- `HttpJwksProvider` rejects non-`https` URIs;
- private JWK fields (`d`, `p`, `q`, …) are not exposed to the verifier even if the JWKS endpoint includes them.

## Common mistakes

- Using `Rs256JwksJwtVerifier` for tokens signed with a shared secret — use `Hs256JwtVerifier` for that.
- Setting `expectedAudience` to a different string than the issuer expects (`aud` mismatch is a common cause of `401 invalid_token`).
- Forgetting to register the cache-invalidation hook caller when you rotate keys (cached JWKS keeps serving the old set until TTL expires).
- Loading a JWKS over HTTP — the provider rejects non-`https` URIs at construction.
