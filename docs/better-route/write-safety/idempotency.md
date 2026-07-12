---
title: Idempotency
---

`IdempotencyMiddleware` protects write endpoints from duplicate processing by **replaying the saved response** when the same key is seen again.

:::tip Need to block concurrent execution?
`IdempotencyMiddleware` writes the cached response **after** the handler runs — two concurrent retries can both reach the handler. For side-effectful operations (charges, external calls, notifications), use [`AtomicIdempotencyMiddleware`](atomic-idempotency) instead, which reserves the key before the handler executes.
:::

## Minimal example

```php
use BetterRoute\Middleware\Write\IdempotencyMiddleware;
use BetterRoute\Middleware\Write\TransientIdempotencyStore;

$idempotency = new IdempotencyMiddleware(
    store: new TransientIdempotencyStore(),
    ttlSeconds: 300,
    requireKey: true,
    methods: ['POST', 'PATCH']
);
```

## Persistent store (v0.3.0)

`WpdbIdempotencyStore` persists state to a custom `wpdb` table — useful when the object cache flushes or doesn't survive restarts. Install the schema once (typically on plugin activation):

```php
use BetterRoute\Middleware\Write\IdempotencyMiddleware;
use BetterRoute\Middleware\Write\WpdbIdempotencyStore;

register_activation_hook(__FILE__, function (): void {
    (new WpdbIdempotencyStore())->installSchema();
});

$idempotency = new IdempotencyMiddleware(
    store: new WpdbIdempotencyStore(),
    ttlSeconds: 600,
    requireKey: true
);
```

Cross-database table names (containing `.`) are rejected at the storage boundary.

**Since 1.0.0**, `WpdbIdempotencyStore` (and `WpdbAtomicIdempotencyStore`) restrict `unserialize()` of the cached response to the library's own `Response` class (`['allowed_classes' => [Response::class]]`), as object-injection defense-in-depth — a tampered row cannot instantiate arbitrary classes.

## How it works

- reads `Idempotency-Key` header
- builds store key from route + idempotency key + identity (v0.3.0: `auth.userId` or `auth.subject`, falling back to `'guest'`)
- hashes request fingerprint (method + route + params/body/json)
- on replay with same fingerprint: returns cached response
- on replay with different fingerprint: `409 idempotency_conflict`

Pass an explicit `keyResolver` to override the default identity-aware key.

Replayed `Response` gets header:

`Idempotency-Replayed: true`

## Scenario: payment/order create endpoint

- Require idempotency key for `POST /orders`
- TTL aligned to client retry window
- Combine with optimistic locking for updates

## Common mistakes

- Setting `requireKey=false` on critical writes
- Reusing same key across different payloads intentionally
- Too short TTL for real retry behavior

## Validation checklist

- second identical request does not call handler
- conflicting payload returns `409`
- replayed response has marker header
