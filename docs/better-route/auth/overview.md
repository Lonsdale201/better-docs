---
title: Auth Overview
---

Built-in auth middleware provides bridge patterns for WordPress REST routes.

## Available middleware

- `BetterRoute\Middleware\Jwt\JwtAuthMiddleware`
- `BetterRoute\Middleware\Jwt\Rs256JwksJwtVerifier` *(v0.6.0)* — RS256/ES256 verifier backed by JWKS; see [JWKS (RS256 / ES256)](jwks-rs256)
- `BetterRoute\Middleware\Jwt\HttpJwksProvider` / `StaticJwksProvider` *(v0.6.0)*
- `BetterRoute\Middleware\Auth\BearerTokenAuthMiddleware`
- `BetterRoute\Middleware\Auth\HmacSignatureMiddleware` *(v0.6.0)* — HMAC request signatures with replay-window enforcement; see [HMAC Request Signatures](hmac-signatures)
- `BetterRoute\Middleware\Auth\CookieNonceAuthMiddleware`
- `BetterRoute\Middleware\Auth\ApplicationPasswordAuthMiddleware`
- `BetterRoute\Middleware\Auth\WpClaimsUserMapper`
- `BetterRoute\Middleware\Auth\OwnershipGuardMiddleware` *(v0.5.0)* — see [Ownership guards](ownership-guard)

## Context propagation

On success, middleware writes auth context attributes:

- `auth` (provider, userId, subject, scopes)
- optionally `claims`, `userId`, `user`, `scopes`
- `hmac` *(v0.6.0)* — `keyId` and `algorithm` after successful HMAC signature verification. *(v1.1.0)* HMAC verification now also writes the shared `auth` attribute (`provider: 'hmac'`, `subject: <keyId>`), so identity-scoped middleware sees HMAC callers like any other authenticated identity.
- `singleUseToken` *(v0.6.0)* — issuer-supplied context after a single-use token is consumed

*(v1.1.0)* Identity-scoped middleware (caching, idempotency, rate limiting) resolves the caller through `BetterRoute\Support\RequestIdentity`: the `auth` attribute first, then a `userId` attribute, then the **native WordPress user** (`get_current_user_id()`), then the HMAC key id. A logged-in WP user is therefore scoped correctly even when no auth middleware is attached to the route.

## Important policy note

Even with auth middleware, route registration still requires explicit `permission_callback` (by design in dispatcher integration). For middleware-authenticated routes, declare the intent with `->protectedByMiddleware(...)` (since 0.4.0). For routes guarded by HMAC or single-use tokens (no WordPress user behind them), use `->publicRoute()` and let the middleware be the gate.

*(v1.1.0)* This now applies to **every** HTTP method: raw `Router` routes — `GET` and `OPTIONS` included — deny by default until you declare intent with `->permission()`, `->protectedByMiddleware()`, or `->publicRoute()`. See [Router](../core/router).

## v1.1.0 hardening

- **All raw routes deny by default.** `GET`/`OPTIONS` are no longer public without explicit intent (see the policy note above).
- **JWT lifetime cap requires `iat` + `exp`.** With `maxLifetimeSeconds` configured, tokens missing either claim are rejected instead of skipping the check. See [JWT and Bearer](jwt-bearer).
- **JWKS refresh throttling.** Unknown-`kid` refreshes respect per-verifier and persisted provider cooldowns, run under a MySQL advisory lock, and keep the last known-good keys when a fetch fails. See [JWKS (RS256 / ES256)](jwks-rs256).
- **Shared identity resolution.** `RequestIdentity` scopes cache/idempotency/rate-limit keys by auth identity, native WP user, or HMAC key id (see Context propagation above).

## v1.0.0 hardening

- **`WpClaimsUserMapper` email/login mapping is off by default.** Only id claims and an explicit custom resolver map a WP user out of the box; email mapping is opt-in and requires a truthy `email_verified` claim. Prevents account takeover from unverified third-party-issuer email claims. See [JWT and Bearer](jwt-bearer).
- **Granted-scope wildcards are opt-in.** A trailing `*` on a token-supplied scope is treated as a literal unless `allowGrantedScopeWildcards: true`; server-defined required-scope wildcards are unchanged.
- **Optional HMAC query-string signing** via `signQueryString` (off by default). See [HMAC Request Signatures](hmac-signatures).
- **`HttpJwksProvider` uses `wp_safe_remote_get`** with bounded redirects and response size.

## v0.6.0 additions

- **Asymmetric JWT.** `Rs256JwksJwtVerifier` plus `HttpJwksProvider` and `StaticJwksProvider` for OIDC-style providers. Strict `kid` matching, algorithm pinning, private-field stripping. See [JWKS (RS256 / ES256)](jwks-rs256).
- **HMAC request signatures.** `HmacSignatureMiddleware` plus `HmacSecretProviderInterface` and `ArrayHmacSecretProvider`. Canonical input, replay window, multi-key rotation. See [HMAC Request Signatures](hmac-signatures).
- **Single-use tokens.** `SingleUseTokenMiddleware` plus three stores. See [Single-Use Tokens](../write-safety/single-use-tokens).

## v0.5.0 additions

- `OwnershipGuardMiddleware` for routes where the authenticated user may only access their own object. Default `deniedStatus` is `404` to avoid leaking existence.
- `Resource\OwnedResourcePolicy::currentUserOwns()` — Resource DSL preset that wires the URL `id`, the auth identity, and an optional `bypassCapability` together. See [Ownership guards](ownership-guard).

## v0.3.0 hardening

- `Hs256JwtVerifier` requires `exp` by default and supports `expectedIssuer`, `expectedAudience`, `maxLifetimeSeconds`, and `maxTokenLength`. See [JWT and Bearer](jwt-bearer).
- `WpClaimsUserMapper` removed `'sub'` from default `idClaims` — re-add it explicitly when needed.
- `BearerTokenAuthMiddleware` no longer leaks the verifier exception message; failed tokens uniformly return `401 invalid_token` with no `details.reason`.

## Common mistakes

- Relying on middleware alone without route permissions
- Missing `Authorization` header normalization
- Not mapping JWT/Bearer claims to WP user where needed

## Validation checklist

- `401` on missing/invalid credential
- `403` on missing required scopes
- expected auth attributes exist in `RequestContext`
