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
    bool $releaseOnThrowable = false,
    int $maxKeyLength = 200
);
```

- `store` — `AtomicIdempotencyStoreInterface` implementation. Use `WpdbAtomicIdempotencyStore` in production; `ArrayAtomicIdempotencyStore` is **for tests only**.
- `ttlSeconds` — how long a reservation / completed record lives. Set to a multiple of the client retry window.
- `requireKey` — when `true`, missing `Idempotency-Key` returns `400 idempotency_key_required`.
- `methods` — request methods the middleware activates on. Other methods short-circuit.
- `keyResolver(RequestContext, string $idempotencyKey): string` — override the default storage key. *(v1.1.0)* Default is a canonical JSON of `route + identity + idempotency-key` (`BetterRoute\Support\Canonicalizer`), identity-aware via `RequestIdentity` in the same way as `RateLimitMiddleware` / `CachingMiddleware`.
- `fingerprintResolver(RequestContext): string` — override fingerprint hashing. *(v1.1.0)* Default is SHA-1 over a **deep canonical** JSON (`Canonicalizer::json`, recursive key sort) of `route + method + identity + json + body + query` — key order in the request payload no longer changes the fingerprint.
- `releaseOnThrowable` — *(v1.1.0)* **default `false`**: a request that throws keeps its reservation until TTL expiry, so an uncertain side effect (charge attempted, outcome unknown) is not executed again by a blind retry. Set to `true` only when the handler is known to leave no side effects behind on failure and clients should be able to retry immediately.
- `maxKeyLength` — *(v1.1.0)* keys longer than this (default `200`) or containing non-printable-ASCII characters are rejected with `400 idempotency_key_invalid`.

## Behavior matrix

| Situation | Result |
|---|---|
| First request with key K, fingerprint F | Reserves `(K, F)`, runs handler, stores response |
| Second request with same K and F, first still running | `409 idempotency_in_progress` |
| Second request with same K and F, first completed | Replay saved response, adds `Idempotency-Replayed: true` |
| Second request with same K, different fingerprint | `409 idempotency_conflict` |
| Handler throws while reservation is open (default) | Reservation **kept until TTL expiry**, original exception re-thrown; retries get `409 idempotency_in_progress` *(v1.1.0)* |
| Handler throws, `releaseOnThrowable=true` | Reservation removed, original exception re-thrown |
| Handler returns a `WP_Error` | Error passes through to the normalizer; reservation stays open (outcome uncertain) *(v1.1.0)* |
| `requireKey=true` and no `Idempotency-Key` header | `400 idempotency_key_required` |
| Key too long (`maxKeyLength`) or non-printable-ASCII | `400 idempotency_key_invalid` *(v1.1.0)* |

## Stores

### `WpdbAtomicIdempotencyStore`

`wpdb`-backed store with `INSERT IGNORE` reservation semantics. Schema is dedicated and separate from `WpdbIdempotencyStore` — the two stores do not share rows.

- Default table: `better_route_atomic_idempotency` (auto-prefixed with `$wpdb->prefix` when not already prefixed).
- Cross-database table names (containing `.`) are rejected. Table names must match `^[A-Za-z_][A-Za-z0-9_]*$`.
- Records expire on `expires_at`. Expired rows are deleted opportunistically on `reserve()`.
- *(v1.1.0)* Every reservation carries an **unforgeable lease token** (`reservation_token`, 16 random bytes). `completeReservation()` / `releaseReservation()` only act when the caller presents the token of the reservation it owns — a request that lost its reservation (TTL expiry + takeover) can no longer overwrite the new owner's record. The legacy `complete()` / `release()` methods throw on this store.
- *(v1.1.0)* Responses are persisted through `StoredResponseCodec`: **data-only serialization**. Bodies containing objects are rejected at store time, and rows are decoded with `unserialize(..., ['allowed_classes' => false])` — a tampered row can never instantiate a class. (Replaces the 1.0.0 `Response::class`-allowlist approach.)
- The middleware key is hashed (`sha1`) before storage, so resolved keys of any length fit the `varchar(64)` column.
- Call `installSchema()` once on plugin activation. *(v1.1.0)* It both creates the table and **migrates** a pre-1.1 table (adds the `reservation_token` column), and throws instead of degrading when DDL fails.

```sql
CREATE TABLE wp_better_route_atomic_idempotency (
    idempotency_key varchar(64) NOT NULL,
    fingerprint varchar(64) NOT NULL,
    reservation_token varchar(64) NOT NULL,
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

In-memory store **for tests only**. State does not persist between requests. *(v1.1.0)* Implements the same lease-token protocol as the wpdb store so tests exercise production semantics.

## Custom store contract

```php
interface AtomicIdempotencyStoreInterface
{
    public function reserve(string $key, string $fingerprint, int $ttlSeconds): AtomicIdempotencyRecord;
    public function complete(string $key, string $fingerprint, mixed $response, int $ttlSeconds): void;
    public function release(string $key, string $fingerprint): void;
}
```

*(v1.1.0)* Prefer implementing the lease-aware extension — the middleware detects it and passes the reservation token through:

```php
interface LeaseAwareAtomicIdempotencyStoreInterface extends AtomicIdempotencyStoreInterface
{
    public function completeReservation(string $key, string $fingerprint, string $reservationToken, mixed $response, int $ttlSeconds): void;
    public function releaseReservation(string $key, string $fingerprint, string $reservationToken): void;
}
```

`AtomicIdempotencyRecord` carries one of `RESERVED`, `IN_PROGRESS`, `REPLAY`, `CONFLICT`, plus *(v1.1.0)* the `reservationToken` issued to the reserving request. The middleware uses these states to decide whether to run the handler, replay, or throw.

When implementing a custom backend (Redis, Memcached, external service), the hard requirements are that `reserve()` is **atomic** — only one caller may receive `RESERVED` for a given `(key, fingerprint)` pair while a record is open (`SET NX` / `INSERT … ON CONFLICT DO NOTHING` / equivalent) — and that complete/release verify the reservation token before mutating the record.

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
- Setting `releaseOnThrowable=true` on a handler that can fail *after* the side effect happened — the retry re-executes the side effect. Keep the default (`false`) unless failures are guaranteed side-effect-free.
- Expecting a failed request to be retryable immediately with the same key — since v1.1.0 the reservation is held until TTL expiry by default; clients retrying a failure should expect `409 idempotency_in_progress` until then.

## Validation checklist

- two concurrent requests with the same key and fingerprint never both run the handler;
- the same key with a different payload returns `409 idempotency_conflict`;
- the replay carries `Idempotency-Replayed: true`;
- a handler exception keeps the reservation (default) — the same key returns `409 idempotency_in_progress` until TTL expiry;
- with `releaseOnThrowable=true`, a handler exception releases the reservation for immediate retry.
