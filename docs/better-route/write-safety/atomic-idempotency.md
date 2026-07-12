---
title: Atomic Idempotency
---

`AtomicIdempotencyMiddleware` *(v0.5.0)* protects side-effectful write endpoints (charges, external API calls, notifications, customer-visible mutations) from concurrent duplicate execution.

## When to use which

- [`IdempotencyMiddleware`](idempotency) — **response replay cache**. The store write happens after the handler runs. Two concurrent retries can both reach the handler before either one finishes; the second only gets a replay if it arrives after the first has stored its response.
- `AtomicIdempotencyMiddleware` — **reservation before execution**. The first request reserves the key; identical concurrent retries get `409 idempotency_in_progress` instead of a second handler invocation.

Pick atomic when "running the handler twice" would charge a customer twice, send two emails, or push two webhooks. Pick the replay cache when the handler is naturally safe to retry but you still want to avoid recomputing the response.

## Minimal example

```php
use BetterRoute\Middleware\Write\AtomicIdempotencyMiddleware;
use BetterRoute\Middleware\Write\WpdbAtomicIdempotencyStore;

register_activation_hook(__FILE__, function (): void {
    (new WpdbAtomicIdempotencyStore())->installSchema();
});

$store = new WpdbAtomicIdempotencyStore();

$router->post('/actions/charge', $handler)
    ->middleware([
        new AtomicIdempotencyMiddleware(
            store: $store,
            ttlSeconds: 900,
            requireKey: true
        ),
    ])
    ->protectedByMiddleware('bearerAuth');
```

## Constructor

```php
new AtomicIdempotencyMiddleware(
    AtomicIdempotencyStoreInterface $store,
    int $ttlSeconds = 300,
    bool $requireKey = true,
    array $methods = ['POST', 'PUT', 'PATCH', 'DELETE'],
    ?callable $keyResolver = null,
    ?callable $fingerprintResolver = null,
    bool $releaseOnThrowable = true
);
```

- `store` — `AtomicIdempotencyStoreInterface` implementation. Use `WpdbAtomicIdempotencyStore` in production, `ArrayAtomicIdempotencyStore` in tests.
- `ttlSeconds` — how long a reservation / completed record lives. Set to a multiple of the client retry window.
- `requireKey` — when `true`, missing `Idempotency-Key` returns `400 idempotency_key_required`.
- `methods` — request methods the middleware activates on. Other methods short-circuit.
- `keyResolver(RequestContext, string $idempotencyKey): string` — override the default storage key. Default is `routePath | identity | idempotency-key`, identity-aware in the same way as `RateLimitMiddleware` / `CachingMiddleware`.
- `fingerprintResolver(RequestContext): string` — override fingerprint hashing. Default uses sorted SHA-1 over `route + method + identity + json + body + query`.
- `releaseOnThrowable` — when `true` (default), a thrown handler exception releases the reservation so the client can retry. Set to `false` only if you want errors to permanently consume the key.

## Behavior matrix

| Situation | Result |
|---|---|
| First request with key K, fingerprint F | Reserves `(K, F)`, runs handler, stores response |
| Second request with same K and F, first still running | `409 idempotency_in_progress` |
| Second request with same K and F, first completed | Replay saved response, adds `Idempotency-Replayed: true` |
| Second request with same K, different fingerprint | `409 idempotency_conflict` |
| Handler throws while reservation is open, `releaseOnThrowable=true` | Reservation removed, original exception re-thrown |
| `requireKey=true` and no `Idempotency-Key` header | `400 idempotency_key_required` |

## Stores

### `WpdbAtomicIdempotencyStore`

`wpdb`-backed store with `INSERT IGNORE` reservation semantics. Schema is dedicated and separate from `WpdbIdempotencyStore` — the two stores do not share rows.

- Default table: `better_route_atomic_idempotency` (auto-prefixed with `$wpdb->prefix` when not already prefixed).
- Cross-database table names (containing `.`) are rejected. Table names must match `^[A-Za-z_][A-Za-z0-9_]*$`.
- Records expire on `expires_at`. Expired rows are deleted opportunistically on `reserve()`.
- **Since 1.0.0** the completed response is restored with `unserialize()` restricted to the library's `Response` class (`['allowed_classes' => [Response::class]]`), as object-injection defense-in-depth.
- Call `installSchema()` once on plugin activation.

```sql
CREATE TABLE wp_better_route_atomic_idempotency (
    idempotency_key varchar(64) NOT NULL,
    fingerprint varchar(64) NOT NULL,
    status varchar(20) NOT NULL,
    response longtext NOT NULL,
    expires_at bigint unsigned NOT NULL,
    updated_at bigint unsigned NOT NULL,
    PRIMARY KEY (idempotency_key),
    KEY fingerprint (fingerprint),
    KEY status (status),
    KEY expires_at (expires_at)
);
```

### `ArrayAtomicIdempotencyStore`

In-memory store for tests and non-production local use. State does not persist between requests.

## Custom store contract

```php
interface AtomicIdempotencyStoreInterface
{
    public function reserve(string $key, string $fingerprint, int $ttlSeconds): AtomicIdempotencyRecord;
    public function complete(string $key, string $fingerprint, mixed $response, int $ttlSeconds): void;
    public function release(string $key, string $fingerprint): void;
}
```

`AtomicIdempotencyRecord` carries one of `RESERVED`, `IN_PROGRESS`, `REPLAY`, `CONFLICT`. The middleware uses these states to decide whether to run the handler, replay, or throw.

When implementing a custom backend (Redis, Memcached, external service), the only hard requirement is that `reserve()` is **atomic** — only one caller may receive `RESERVED` for a given `(key, fingerprint)` pair while a record is open. Use `SET NX` / `INSERT … ON CONFLICT DO NOTHING` / equivalent.

## Combining with other middleware

Recommended order (outer → inner):

1. CORS
2. Auth (so `auth` context is set before the key is identity-scoped)
3. Audit enricher → audit logger
4. Rate limit
5. **Atomic idempotency**
6. Optimistic lock (for updates)
7. business handler

The default key resolver already incorporates auth identity, so authenticated retries from the same user against the same route with the same key collapse into a single execution.

## Common mistakes

- Using `IdempotencyMiddleware` for charges or notifications — it does not block concurrent execution.
- Setting `ttlSeconds` shorter than the client retry window — late retries miss the replay and re-execute.
- Forgetting `installSchema()` on activation — the store throws on first reserve.
- `releaseOnThrowable=false` combined with non-deterministic handler errors — the key is permanently consumed.

## Validation checklist

- two concurrent requests with the same key and fingerprint never both run the handler;
- the same key with a different payload returns `409 idempotency_conflict`;
- the replay carries `Idempotency-Replayed: true`;
- handler exceptions release the reservation when `releaseOnThrowable=true`.
