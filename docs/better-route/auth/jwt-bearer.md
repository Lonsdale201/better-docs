---
title: JWT and Bearer
---

`better-route` ships two JWT verifiers:

- [`Hs256JwtVerifier`](#jwt-with-hs256-verifier) — symmetric (shared secret), since 0.3.0.
- [`Rs256JwksJwtVerifier`](jwks-rs256) — asymmetric (RS256/ES256) backed by JWKS, since 0.6.0.

Both implement `JwtVerifierInterface` and plug into `JwtAuthMiddleware` the same way. Pick HS256 for first-party tokens you sign yourself; pick the JWKS verifier for OIDC providers that publish a key set.

## JWT with HS256 verifier

```php
use BetterRoute\Middleware\Jwt\Hs256JwtVerifier;
use BetterRoute\Middleware\Jwt\JwtAuthMiddleware;
use BetterRoute\Middleware\Auth\WpClaimsUserMapper;

$verifier = new Hs256JwtVerifier(
    secret: $_ENV['JWT_SECRET'],
    leewaySeconds: 30,
    expectedIssuer: 'https://issuer.example.com',
    expectedAudience: 'myapp',
    requireExpiration: true,        // v0.3.0 default — set false to allow tokens without `exp`
    maxLifetimeSeconds: 3600,       // optional cap on `exp - iat`; requires both `iat` and `exp` (v1.1.0)
    maxTokenLength: 8192             // v0.3.0 default
);

$jwtMiddleware = new JwtAuthMiddleware(
    verifier: $verifier,
    requiredScopes: ['content:*'],
    userMapper: new WpClaimsUserMapper()
);
```

### v0.6.0 internals

`Hs256JwtVerifier` was rewired to use the shared [`Crypto`](../support/crypto) helper for constant-time signature comparison and base64url decoding. Public behavior is unchanged — the same shared crypto primitives are now reusable outside the verifier.

### v0.3.0 hardening

`Hs256JwtVerifier` enforces (defaults in parentheses):

- **`exp` required** by default (`requireExpiration: true`). Tokens without `exp` are rejected unless explicitly disabled.
- **`expectedIssuer` / `expectedAudience`** for strict `iss` / `aud` validation when set. `aud` matches against either a string or a list of audiences in the token.
- **`maxLifetimeSeconds`** rejects tokens whose `exp - iat` exceeds the cap. *(v1.1.0)* When the cap is configured, tokens must carry **both `iat` and `exp`** — previously a token without `iat` skipped the lifetime check entirely; now it is rejected (`401 invalid_token`). Applies to `Hs256JwtVerifier` and `Rs256JwksJwtVerifier` alike.
- **`maxTokenLength`** (`8192` bytes) rejects oversized tokens before parsing.

`WpClaimsUserMapper` defaults changed: `idClaims` is now `['user_id', 'uid', 'wp_user_id']`. Re-add `'sub'` explicitly if your tokens use it as the WP user identifier.

**Since 1.0.0:** `WpClaimsUserMapper` no longer maps `email` or `login`/`username` claims by default — `$emailClaims` and `$loginClaims` default to empty, so only id claims and an explicit `$customResolver` resolve a WP user out of the box. When you opt into email mapping it requires a truthy `email_verified` claim (`$requireEmailVerified`, default `true`). This prevents account takeover from a validly signed third-party token carrying an unverified `email`; prefer a first-party `user_id` claim or an issuer-scoped custom resolver.

## JWT with RS256/ES256 (JWKS) verifier

For tokens issued by an OIDC provider, use [`Rs256JwksJwtVerifier`](jwks-rs256) with `HttpJwksProvider`:

```php
use BetterRoute\Middleware\Jwt\HttpJwksProvider;
use BetterRoute\Middleware\Jwt\Rs256JwksJwtVerifier;

$jwks = new HttpJwksProvider(
    jwksUri: 'https://issuer.example.com/.well-known/jwks.json',
    issuer: 'https://issuer.example.com'
);

$verifier = new Rs256JwksJwtVerifier(
    jwks: $jwks,
    expectedIssuer: 'https://issuer.example.com',
    expectedAudience: 'better-route',
    allowedAlgorithms: ['RS256']
);
```

The full hardening rules (strict `kid` matching, algorithm pinning, private-field stripping) live on the dedicated [JWKS RS256 / ES256](jwks-rs256) page.

## Bearer middleware with custom verifier

```php
use BetterRoute\Middleware\Auth\BearerTokenAuthMiddleware;

$bearer = new BearerTokenAuthMiddleware(
    verifier: $customVerifier,
    requiredScopes: ['api:read'],
    userMapper: new WpClaimsUserMapper(),
    provider: 'partner_bearer'
);
```

## Scope matching

Server-defined **required**-scope wildcards are always honored:

- required `content:*` matches granted `content:read`

**Since 1.0.0:** a trailing `*` on a **granted** (token-supplied) scope is treated as a literal by default, so token data cannot widen its own authority. To honor hierarchical wildcard grants (e.g. granted `content:*` satisfying required `content:read`), opt in with `allowGrantedScopeWildcards: true` on `JwtAuthMiddleware` / `BearerTokenAuthMiddleware`:

```php
$jwtMiddleware = new JwtAuthMiddleware(
    verifier: $verifier,
    requiredScopes: ['content:read'],
    allowGrantedScopeWildcards: true, // honor a granted `content:*`
);
```

`BearerTokenAuthMiddleware` and `JwtAuthMiddleware` accept both array `scope` claims and OIDC-style space-delimited strings. 0.6.0 adds regression coverage for the string-shape behavior.

## Common mistakes

- Empty JWT secret
- Using a non-HS256 token with `Hs256JwtVerifier` — switch to `Rs256JwksJwtVerifier` for RS256/ES256
- Expecting scopes from an unsupported claim shape
- *(v0.3.0)* issuing tokens without `exp` while `requireExpiration` is on
- *(v0.3.0)* relying on `sub` for WP user mapping without re-adding it to `WpClaimsUserMapper::$idClaims`
- *(v1.1.0)* issuing tokens without `iat` while `maxLifetimeSeconds` is configured — the lifetime cap now requires both `iat` and `exp`

## Validation checklist

- malformed token -> `401 invalid_token`
- scope mismatch -> `403 insufficient_scope`
- mapped WP user is set when mapper resolves userId
