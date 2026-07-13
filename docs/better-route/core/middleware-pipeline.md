---
title: Middleware Pipeline
---

Pipeline execution is deterministic and test-backed.

## Order guarantee

Execution order is:

1. global middleware
2. group middleware
3. route middleware
4. handler

## Accepted middleware forms

- class implementing `BetterRoute\Middleware\MiddlewareInterface`
- callable `(RequestContext $context, callable $next): mixed`
- class-string resolvable via `middlewareFactory` or zero-arg constructor

## Short-circuit behavior

A middleware may return early and skip downstream calls. This is used for:

- auth rejection
- cached response replay
- rate-limit rejection

## Factory-based resolution example

```php
$router->middlewareFactory(function (string $class): mixed {
    if ($class === JwtAuthMiddleware::class) {
        return new JwtAuthMiddleware($verifier, ['content:*'], new WpClaimsUserMapper());
    }

    return null;
});
```

## Common mistakes

- Returning non-callable from factory
- Not handling constructor dependencies for class-string middleware
- Mutating context without returning `$next($newContext)`

## Validation checklist

- middleware with ctor args is resolved by factory
- short-circuit does not execute handler
- thrown exceptions are normalized to error envelope

## Identity-aware default keys (v0.3.0, reworked in v1.1.0)

`CachingMiddleware`, `IdempotencyMiddleware`, `AtomicIdempotencyMiddleware`, and `RateLimitMiddleware` derive default keys from the request identity.

*(v1.1.0)* Identity resolution is centralized in `BetterRoute\Support\RequestIdentity` and the resolution order is:

1. `auth.userId > 0` → provider-scoped user identity
2. `auth.subject` (non-empty) → provider-scoped subject identity
3. `userId` attribute (positive int)
4. **native WordPress user** — `get_current_user_id()`, so a logged-in user is scoped correctly even when no auth middleware is attached to the route
5. `hmac.keyId` — HMAC callers are scoped per key id
6. otherwise → `"guest"` (`RateLimitMiddleware` falls back to the resolved client IP before giving up)

Resolved identities are emitted as `identity:<sha256 of canonical JSON>` hashes rather than raw `provider:user:id` strings, so identity material does not appear verbatim in cache/transient keys.

Pass an explicit `keyResolver` to keep custom keys.
