---
title: Optimistic Locking
---

`OptimisticLockMiddleware` enforces version preconditions (`If-Match` or request param).

## Minimal example

```php
use BetterRoute\Middleware\Write\CallbackOptimisticLockVersionResolver;
use BetterRoute\Middleware\Write\OptimisticLockMiddleware;

$versionResolver = new CallbackOptimisticLockVersionResolver(
    static function ($context): string|int|null {
        // Resolve current version from DB/entity
        return 'v12';
    }
);

$optimisticLock = new OptimisticLockMiddleware(
    versionResolver: $versionResolver,
    required: true,
    headerName: 'if-match',
    paramName: 'version',
    criticalSection: null // null -> WpdbOptimisticLockCriticalSection (v1.1.0)
);
```

## Behavior

- missing expected version and `required=true` -> `428 precondition_required` *(since 1.0.0; was `412`)*, thrown as `PreconditionRequiredException`
- missing current version -> `409 version_unavailable`
- mismatch -> `412 optimistic_lock_failed`
- match -> passes and stores `optimisticLock` attribute in context (includes `atomic: true` since v1.1.0)

Also accepts wildcard expected version: `If-Match: *`.

**Since 1.0.0:** a *missing* precondition returns `428 Precondition Required` (RFC 6585) via `PreconditionRequiredException`; `412 Precondition Failed` is now reserved for a precondition that was supplied but did not match.

## Critical section (v1.1.0)

Version resolution and the write handler now run **inside a per-resource critical section**. Before v1.1.0, two concurrent writes could both read the same current version, both pass the check, and both write. Now the middleware:

1. acquires a per-resource lock (derived from the route path + URL params, so `PUT /articles/17` and `PUT /articles/18` do not contend),
2. re-resolves the current version *while holding the lock*,
3. runs the precondition check and the handler,
4. releases the lock.

The default backend is `WpdbOptimisticLockCriticalSection` — a MySQL advisory lock (`GET_LOCK`, 2-second acquire timeout, configurable via its constructor). Failure to acquire the lock throws instead of proceeding unprotected. Supply a custom backend by implementing `OptimisticLockCriticalSectionInterface`, or wrap a closure with `CallbackOptimisticLockCriticalSection` (e.g. Redis-based locks):

```php
use BetterRoute\Middleware\Write\CallbackOptimisticLockCriticalSection;

$criticalSection = new CallbackOptimisticLockCriticalSection(
    static fn ($context, callable $callback): mixed => $redisLock->wrap($callback)
);
```

:::warning Cooperating writers only
The critical section serializes **better-route writes** that go through this middleware. A writer outside this protocol (wp-admin, WP-CLI, another plugin) can still race the protected write. When external writers modify the same records, have them take the same advisory lock, or enforce the version in a storage-level conditional `UPDATE ... WHERE version = %s`.
:::

## Common mistakes

- Not returning deterministic current version from resolver
- Using stale versions from cache for write checks
- Skipping lock on endpoints with concurrent edits
- Assuming the critical section also blocks non-better-route writers — it only serializes cooperating writers (see above)

## Validation checklist

- quoted ETag forms normalize correctly
- mismatch includes expected/current in error details
- successful request has `optimisticLock` context attributes
- two concurrent writes with the same expected version: exactly one succeeds, the other gets `412 optimistic_lock_failed` *(v1.1.0)*
